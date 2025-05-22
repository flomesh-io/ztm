import cmdline from './cmdline.js'
import service, { response, responder, cliResponder } from './service.js'

export default function (rootDir, mountName, epInfo, meshEnv) {
  rootDir = os.path.resolve(rootDir)

  var st = os.stat(rootDir)
  if (st) {
    if (!st.isDirectory()) {
      throw `directory path already exists as a regular file: ${rootDir}`
    }
  } else {
    os.mkdir(rootDir, { recursive: true })
  }

  pipy.unmount(mountName)
  pipy.mount(mountName, rootDir)

  var dataDir = os.path.resolve(rootDir, '..', 'appdata')

  function listRecursive(path, base, list) {
    os.readDir(path).forEach(name => {
      if (name.endsWith('/')) {
        listRecursive(
          os.path.join(path, name),
          os.path.join(base, name),
          list
        )
      } else {
        list.push(os.path.join(base, name))
      }
    })
  }

  function listBuiltin() {
    var all = {}
    pipy.list('/apps').forEach(pathname => {
      var segs = pathname.split('/')
      if (segs.length !== 3) return
      if (segs[2] !== 'main.js' && segs[2] !== 'main.ztm.js') return
      var provider = segs[0]
      var name = segs[1]
      all[`${provider}/${name}`] = { name, provider }
    })
    return Object.values(all)
  }

  function listDownloaded() {
    var list = []
    os.readDir(rootDir).forEach(name => {
      if (!name.endsWith('/')) return
      var provider = name.substring(0, name.length - 1)
      var dirname = os.path.join(rootDir, provider)
      os.readDir(dirname).forEach(name => {
        if (name.startsWith('.') || !name.endsWith('/')) return
        if (
          os.stat(os.path.join(dirname, name, 'main.js'))?.isFile?.() ||
          os.stat(os.path.join(dirname, name, 'main.ztm.js'))?.isFile?.()
        ) {
          list.push({
            name: name.substring(0, name.length - 1),
            provider,
          })
        }
      })
    })
    return list
  }

  function listRunning() {
    return apps.filter(app => app.isRunning()).map(
      app => ({
        name: app.appname,
        provider: app.provider,
        username: app.username,
      })
    )
  }

  function isBuiltin(provider, appname) {
    var dirname = os.path.join('/apps', provider, appname)
    return Boolean(
      pipy.load(os.path.join(dirname, 'main.js')) ||
      pipy.load(os.path.join(dirname, 'main.ztm.js'))
    )
  }

  function isDownloaded(provider, appname) {
    var dirname = os.path.join(rootDir, provider, appname)
    var st = os.stat(dirname)
    if (!st?.isDirectory?.()) return false
    if (
      !os.stat(os.path.join(dirname, 'main.js'))?.isFile?.() &&
      !os.stat(os.path.join(dirname, 'main.ztm.js'))?.isFile?.()
    ) return false
    return true
  }

  function isRunning(provider, appname) {
    var app = findApp(provider, appname)
    return app ? app.isRunning() : false
  }

  function pack(provider, appname) {
    var dirname = os.path.join(rootDir, provider, appname)
    var filenames = []
    listRecursive(dirname, '/', filenames)

    if (filenames.length === 0) {
      return Promise.reject('No files to pack')
    }

    filenames.sort()

    var outputBuffer = new Data

    var encodeFile = pipeline($=>$
      .onStart(path => new MessageStart({ method: 'POST', path }))
      .replaceStreamEnd(new MessageEnd)
      .encodeHTTPRequest()
      .handleData(data => outputBuffer.push(data))
      .replaceMessage(new StreamEnd)
    )

    function packFile() {
      if (filenames.length == 0) {
        return Promise.resolve(outputBuffer)
      }
      var filename = filenames.shift()
      var fullpath = os.path.join(dirname, filename)
      return pipy.read(fullpath, encodeFile, filename).then(packFile)
    }

    return packFile()
  }

  function unpack(provider, appname, data) {
    remove(provider, appname)
    var dirname = os.path.join(rootDir, provider, appname)
    return pipeline($=>$
      .onStart([data, new StreamEnd])
      .decodeHTTPRequest()
      .handleMessage(msg => {
        var path = os.path.normalize(msg.head.path)
        path = os.path.join(dirname, path)
        os.mkdir(os.path.dirname(path), { recursive: true, force: true })
        os.write(path, msg.body)
      })
    ).spawn()
  }

  var apps = []

  function findApp(provider, appname) {
    return apps.find(
      a => a.appname === appname && (!provider || a.provider === provider)
    )
  }

  function start(provider, appname, username) {
    var app = findApp(provider, appname)
    if (!app) {
      var builtin = isBuiltin(provider, appname)
      var downloaded = isDownloaded(provider, appname)
      if (downloaded || builtin) {
        app = App(
          provider, appname, username,
          builtin && !downloaded
        )
        apps.push(app)
      } else {
        throw `app ${provider}/${appname} not found`
      }
    }
    app.start()
  }

  function stop(provider, appname) {
    var app = findApp(provider, appname)
    if (app) {
      app.stop()
    }
  }

  function connect(provider, appname) {
    var app = findApp(provider, appname)
    return app ? app.connect() : null
  }

  function log(provider, appname) {
    var app = findApp(provider, appname)
    return app ? app.log() : null
  }

  function remove(provider, appname) {
    stop(provider, appname)
    var dirname = os.path.join(rootDir, provider, appname)
    os.rmdir(dirname, { recursive: true, force: true })
  }

  function App(provider, appname, username, isBuiltin) {
    var appRootDir = (isBuiltin
      ? os.path.join('/apps', provider, appname)
      : os.path.join('/', mountName, provider, appname)
    )
    var appLog = []
    var entryPipeline = null
    var exitCallbacks = []

    function start() {
      if (entryPipeline) return

      var mainFilename = (
        checkExistence(os.path.join(appRootDir, 'main.ztm.js')) ||
        checkExistence(os.path.join(appRootDir, 'main.js'))
      )

      var mainFunc = pipy.import(mainFilename).default
      if (typeof mainFunc !== 'function') {
        throw `The default export from ${provider}/${appname} main script is not a function`
      }

      var connect = meshEnv.connect(provider, appname)

      var $target
      var $response

      var httpPipeline = pipeline($=>$
        .onStart((ep, req) => {
          $target = ep
          return req
        })
        .muxHTTP(() => $target, { version: 2 }).to($=>$
          .pipe(() => connect($target, { dedicated: true }))
        )
        .replaceMessage(res => {
          $response = res
          return new StreamEnd
        })
        .onEnd(() => $response)
      )

      var request = function (ep, req) {
        return httpPipeline.spawn(ep, req)
      }

      entryPipeline = mainFunc({
        app: {
          executable: pipy.argv[0],
          name: appname,
          root: appRootDir,
          dataDir: os.path.join(dataDir, provider, username),
          url: os.path.join(meshEnv.url, 'apps', URL.encodeComponent(provider), URL.encodeComponent(appname)),
          path: os.path.join(meshEnv.path, 'apps', URL.encodeComponent(provider), URL.encodeComponent(appname)),
          provider,
          username,
          endpoint: { ...epInfo },
          log,
          onExit,
        },
        mesh: {
          name: meshEnv.name,
          discoverUsers: meshEnv.discoverUsers(provider, appname),
          discover: meshEnv.discover(provider, appname),
          connect,
          request,
          ...meshEnv.fs(provider, appname),
        },
        utils: {
          parseArgv: cmdline,
          createServer: service,
          createResponse: response,
          createResponder: responder,
          createCLIResponder: cliResponder,
        },
      })
    }

    function stop() {
      exitCallbacks.forEach(f => {
        try { f() } catch {}
      })
      entryPipeline = null
    }

    var logHeader = `[${provider}/${appname}]`

    function log(msg) {
      if (appLog.length > 100) {
        appLog.splice(0, appLog.length - 100)
      }
      appLog.push({
        time: new Date().toISOString(),
        message: msg,
      })
      console.info(logHeader, msg)
    }

    function onExit(cb) {
      if (typeof cb !== 'function') throw 'onExit() expects a function as argument'
      exitCallbacks.push(cb)
    }

    function checkExistence(path) {
      if (pipy.load(path)) {
        return path
      }
    }

    return {
      provider,
      appname,
      username,
      start,
      stop,
      isBuiltin: () => isBuiltin,
      isRunning: () => Boolean(entryPipeline),
      connect: () => entryPipeline,
      log: () => appLog,
    }
  }

  return {
    listBuiltin,
    listDownloaded,
    listRunning,
    isBuiltin,
    isDownloaded,
    isRunning,
    pack,
    unpack,
    start,
    stop,
    connect,
    log,
    remove,
  }
}
