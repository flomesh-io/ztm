export default function (rootDir) {
  rootDir = os.path.resolve(rootDir)

  var st = os.stat(rootDir)
  if (st) {
    if (!st.isDirectory()) {
      throw `directory path already exists as a regular file: ${rootDir}`
    }
  } else {
    os.mkdir(rootDir, { recursive: true })
  }

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

  function listProviders() {
    return os.readDir(rootDir)
      .filter(name => name.endsWith('/'))
      .map(name => name.substring(0, name.length - 1))
  }

  function list(provider) {
    var dirname = os.path.join(rootDir, provider)
    return os.readDir(dirname).filter(name => {
      if (name.startsWith('.') || !name.endsWith('/')) return false
      if (os.stat(os.path.join(dirname, name, 'main.js'))?.isFile?.()) {
        return true
      }
      return false
    }).map(
      name => name.substring(0, name.length - 1)
    )
  }

  function pack(provider, app) {
    var dirname = os.path.join(rootDir, provider, app)
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

  function unpack(provider, app, data) {
    remove(provider, app)
    var dirname = os.path.join(rootDir, provider, app)
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

  function start(provider, app) {
  }

  function stop(provider, app) {
  }

  function remove(provider, app) {
    stop(provider, app)
    var dirname = os.path.join(rootDir, provider, app)
    os.rmdir(dirname, { recursive: true, force: true })
  }

  return {
    listProviders,
    list,
    pack,
    unpack,
    start,
    stop,
    remove,
  }
}
