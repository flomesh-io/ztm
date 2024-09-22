import MIME from './mime.js'

var CHUNK_SIZE = 2*1024*1024
var DOWNLOAD_CONCURRENCY = 5

//
// Cloud view:
//   /users
//     /<username>
//       ...
//
// In the local directory:
//   /users  <-- Identical to the cloud view
//     /<username>
//       ...
//   /cache/<username>/
//     /<filename>
//       {
//         time: 1789123456789,
//         size: 1024,
//         hash: [
//           '0123456789abcdef',
//           '0123456789abcdef',
//         ]
//       }
//   /downloads/users/<username>/
//     <filename>.<num>
//
// On the mesh:
//   /shared/<username>/stat/
//     /<filename>
//       {
//         time: 1789123456789,
//         size: 1024,
//         hash: [
//           '0123456789abcdef',
//           '0123456789abcdef',
//         ]
//       }
//   /shared/<username>/hash/
//     /<hash>
//       content is the hash too
//   /users/<username>/acl/
//     /<dirname>
//       {
//         all: null | "readonly" | "block",
//         users: {
//           [username]: "readonly" | "block",
//         },
//       }
//

var matchPathUser = new http.Match('/users/{username}')
var matchPathUserFile = new http.Match('/users/{username}/*')
var matchPathSharedFile = new http.Match('/shared/{username}/stat/*')
var matchPathChunk = new http.Match('/api/chunks/users/{username}/*')

export default function ({ app, mesh }) {
  var localDir
  var autoDownloadPaths
  var autoUploadPaths

  applyConfig().then(
    () => resumeDownloads()
  ).then(
    () => applyMirrors()
  ).then(
    () => initMirrors()
  ).then(
    () => watchMirrors()
  )

  mesh.acl(`/shared/${app.username}/stat`, { all: 'block' })

  function applyConfig() {
    return readLocalConfig().then(
      config => {
        localDir = config.localDir
        if (localDir.startsWith('~/')) {
          localDir = os.home() + localDir.substring(1)
        }
        try {
          os.mkdir(os.path.join(localDir, 'users', app.username), { recursive: true })
        } catch (e) {
          app.log(e.message || e.toString())
        }
      }
    )
  }

  function applyMirrors() {
    return readLocalConfig().then(
      config => {
        var mirrors = config.mirrors
        if (mirrors) {
          var entries = Object.entries(mirrors)
          autoDownloadPaths = entries.filter(([_, v]) => v.download).map(([k]) => k)
          autoUploadPaths = entries.filter(([_, v]) => v.upload).map(([k]) => k)
        } else {
          autoDownloadPaths = []
          autoUploadPaths = []
        }
      }
    )
  }

  function resumeDownloads() {
    var rootDir = os.path.join(localDir, 'downloads')
    var downloads = {}
    findDownloads('/')
    function findDownloads(dirname) {
      var names = os.readDir(os.path.join(rootDir, dirname))
      names.forEach(name => {
        if (name.endsWith('/')) {
          findDownloads(os.path.join(dirname, name))
        } else {
          var i = name.lastIndexOf('.')
          var n = Number.parseInt(name.substring(i + 1))
          name = name.substring(0, i)
          if (!name || Number.isNaN(n)) return
          var path = os.path.join(dirname, name)
          downloads[path] = true
        }
      })
    }
    return Promise.all(Object.keys(downloads).map(pathname => {
      var params = matchPathUserFile(pathname)
      if (!params) return Promise.resolve()
      var username = params.username
      var filename = params['*']
      return mesh.read(os.path.join('/shared', username, 'stat', filename)).then(
        data => {
          if (!data) return
          try {
            var downloadedSize = 0
            var stat = JSON.decode(data)
            var chunks = stat.chunks.map((hash, i) => {
              var filename = `${pathname}.${i}`
              try {
                var hasher = new crypto.Hash('sha256')
                var data = os.read(os.path.join(rootDir, filename))
                hasher.update(data)
                if (hasher.digest('hex') === hash) {
                  downloadedSize += data.size
                  return null
                }
              } catch {}
              return [filename, hash]
            }).filter(s=>s)
            if (chunks.length === 0) {
              finalizeDownload(pathname, stat.hash)
              clearDownload(pathname)
            } else {
              appendDownload(pathname, stat, downloadedSize, chunks.filter(s=>s))
              continueDownloading()
            }
          } catch {}
        }
      )
    }))
  }

  function initMirrors() {
    if (autoDownloadPaths instanceof Array && autoDownloadPaths.length > 0) {
      return mesh.list('/shared').then(files => {
        var mirrors = autoDownloadPaths.map(path => path.endsWith('/') ? path : path + '/')
        Object.keys(files).forEach(
          pathname => {
            var params = matchPathSharedFile(pathname)
            if (!params) return
            var username = params.username
            var filename = params['*']
            var path = os.path.join('/users', username, filename)
            if (!mirrors.some(p => path.startsWith(p))) return
            return getFileStatByUser(username, filename).then(
              stat => {
                if (stat && !stat.list && stat.state !== 'synced' && stat.state !== 'updated') {
                  downloadFile(path)
                }
              }
            )
          }
        )}
      )
    } else {
      return Promise.resolve()
    }
  }

  function watchMirrors() {
    if (autoDownloadPaths instanceof Array && autoDownloadPaths.length > 0) {
      mesh.watch('/shared/').then(pathnames => {
        try {
          var mirrors = autoDownloadPaths.map(path => path.endsWith('/') ? path : path + '/')
          pathnames.forEach(pathname => {
            var params = matchPathSharedFile(pathname)
            if (!params) return
            var username = params.username
            var filename = params['*']
            var path = os.path.join('/users', username, filename)
            if (mirrors.some(p => path.startsWith(p))) {
              downloadFile(path)
            }
          })
        } catch (e) {
          app.log(`Cannot update mirrors: ${e.message || e}`)
        }
        watchMirrors()
      })
    } else {
      new Timeout(5).wait().then(watchMirrors)
    }
  }

  function allEndpoints() {
    return mesh.discover()
  }

  function getEndpointConfig(ep) {
    if (ep === app.endpoint.id) {
      return getLocalConfig()
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'GET',
          path: `/api/config`,
        }
      )).then(res => res?.head?.status === 200 ? JSON.decode(res.body) : null)
    }
  }

  function setEndpointConfig(ep, config) {
    if (ep === app.endpoint.id) {
      return setLocalConfig(config)
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'POST',
          path: `/api/config`,
        },
        JSON.encode(config)
      )).then(res => {
        var status = res?.head?.status
        if (!(200 <= status && status <= 299)) throw res.head.statusText
      })
    }
  }

  function allEndpointMirrors(ep) {
    if (ep === app.endpoint.id) {
      return allLocalMirrors()
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'GET',
          path: '/api/mirrors',
        }
      )).then(res => res ? JSON.decode(res.body) : null)
    }
  }

  function getEndpointMirror(ep, pathname) {
    if (ep === app.endpoint.id) {
      return getLocalMirror(pathname)
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'GET',
          path: os.path.join('/api/mirrors', encodePathname(pathname)),
        }
      )).then(res => res?.head?.status === 200 ? JSON.decode(res.body) : null)
    }
  }

  function setEndpointMirror(ep, pathname, mirror) {
    if (ep === app.endpoint.id) {
      return setLocalMirror(pathname, mirror)
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'POST',
          path: os.path.join('/api/mirrors', encodePathname(pathname)),
        },
        JSON.encode(mirror)
      )).then(res => {
        var status = res?.head?.status
        if (!(200 <= status && status <= 299)) throw res.head.statusText
      })
    }
  }

  function readLocalConfig() {
    return mesh.read('/local/config.json').then(
      data => {
        try {
          return JSON.decode(data) || {}
        } catch {
          return {}
        }
      }
    )
  }

  function writeLocalConfig(config) {
    return mesh.write('/local/config.json', JSON.encode(config))
  }

  function getLocalConfig() {
    return readLocalConfig().then(
      config => {
        var localDir = config.localDir || '~/ztmCloud'
        return { localDir }
      }
    )
  }

  function setLocalConfig(config) {
    var newConfig = config
    return readLocalConfig().then(
      config => {
        if (newConfig.localDir) {
          config.localDir = newConfig.localDir
        }
        return writeLocalConfig(config).then(applyConfig)
      }
    )
  }

  function allLocalMirrors() {
    return readLocalConfig().then(
      config => {
        return config.mirrors || {}
      }
    )
  }

  function getLocalMirror(pathname) {
    pathname = os.path.normalize(pathname)
    return readLocalConfig().then(
      config => {
        return config.mirrors?.[pathname] || null
      }
    )
  }

  function setLocalMirror(pathname, mirror) {
    pathname = os.path.normalize(pathname)
    return readLocalConfig().then(
      config => {
        config.mirrors ??= {}
        var m = config.mirrors[pathname] || {}
        if (mirror?.download !== undefined) m.download = Boolean(mirror.download)
        if (mirror?.upload !== undefined) m.upload = Boolean(mirror.upload)
        if (m.download || m.upload) {
          config.mirrors[pathname] = m
        } else {
          delete config.mirrors[pathname]
        }
        return writeLocalConfig(config).then(applyMirrors)
      }
    )
  }

  var downloadQueue = []
  var downloadFiles = {}
  var downloadLanes = []
  var downloadError = {}
  var uploadFiles = {}

  function appendDownload(pathname, stat, downloadedSize, chunks) {
    downloadedSize = downloadedSize || 0
    chunks = chunks || stat.chunks.map((hash, i) => [`${pathname}.${i}`, hash])
    var download = {
      path: pathname,
      size: stat.size,
      hash: stat.hash,
      username: matchPathUserFile(pathname).username,
      chunks,
      counter: chunks.length,
      speed: 0,
      receivedSince: Date.now(),
      receivedSize: 0,
      downloadedSize,
    }
    downloadFiles[pathname] = download
    downloadQueue.push(download)
  }

  function continueDownloading() {
    var vacantLanes = DOWNLOAD_CONCURRENCY - downloadLanes.length
    new Array(vacantLanes).fill().forEach(() => {
      var file = downloadQueue[0]
      if (file) {
        var chunk = file.chunks.shift()
        if (file.chunks.length === 0) {
          downloadQueue.shift()
        }
        if (chunk) {
          downloadLanes.push(chunk)
          var path = chunk[0]
          var hash = chunk[1]
          mesh.stat(os.path.join('/shared', file.username, 'hash', file.hash)).then(
            stat => downloadChunk(path, hash, file, stat?.sources || [])
          )
        }
      }
    })
  }

  function downloadChunk(path, hash, file, sources) {
    if (!(file.path in downloadFiles)) {
      return finalizeChunk(path)
    }
    if (sources.length === 0) {
      app.log(downloadError[file.path] = `Chunk ${path} not found, will try again in 10 seconds`)
      return new Timeout(10).wait().then(
        () => mesh.stat(os.path.join('/shared', file.username, 'hash', file.hash))
      ).then(
        stat => downloadChunk(path, hash, file, stat?.sources || [])
      )
    }
    var i = path.lastIndexOf('.')
    var filename = path.substring(0,i)
    var chunkNum = path.substring(i+1)
    var outputPath = os.path.join(localDir, 'downloads', path)
    os.mkdir(os.path.dirname(outputPath), { recursive: true })
    var ep = sources.splice(Math.floor(Math.random() * sources.length), 1)[0]
    var downloadedData = null
    app.log(`Downloading chunk ${path}...`)
    delete downloadError[file.path]
    return pipeline($=>$
      .onStart(
        new Message({
          method: 'GET',
          path: os.path.join('/api/chunks', encodePathname(filename)) + '?chunk=' + chunkNum,
        })
      )
      .muxHTTP().to($=>$
        .pipe(mesh.connect(ep))
      )
      .replaceData(
        data => {
          if (file.path in downloadFiles) {
            var t = Date.now()
            var d = t - file.receivedSince
            if (d >= 1000) {
              file.speed = Math.round((file.receivedSize + data.size) / (d/1000))
              file.receivedSize = 0
              file.receivedSince = t
            } else {
              file.receivedSize += data.size
            }
            file.downloadedSize += data.size
            return data
          } else {
            return new MessageEnd
          }
        }
      )
      .replaceMessage(res => {
        var status = res?.head?.status
        if (status === 200 && res.body) {
          var hasher = new crypto.Hash('sha256')
          hasher.update(res.body)
          if (hasher.digest('hex') === hash) {
            downloadedData = res.body
            return new StreamEnd
          }
        }
        file.downloadedSize -= res?.body?.size || 0
        app.log(`Downloading ${filename} from ep ${ep} failed with status ${status}`)
        return new StreamEnd
      })
    ).spawn().then(() => {
      if (!downloadedData) return '' // no hash
      os.write(outputPath, downloadedData)
      var hasher = new crypto.Hash('sha256')
      return pipy.read(outputPath, $=>$
        .handleData(data => hasher.update(data))
      ).then(() => hasher.digest('hex'))
    }).then(h => {
      if (h === hash || !(file.path in downloadFiles)) {
        return finalizeChunk(path)
      } else {
        file.downloadedSize -= downloadedData?.size || 0
        app.log(`Chunk ${path} from ep ${ep} was corrupt`)
        return downloadChunk(path, hash, file, sources)
      }
    })
  }

  function finalizeChunk(path) {
    var i = path.lastIndexOf('.')
    var filename = path.substring(0, i)
    var f = downloadFiles[filename]
    if (f) {
      if (f.counter === 1) {
        return finalizeDownload(filename, f.hash).then(() => {
          clearDownload(filename)
          delete downloadFiles[filename]
          delete downloadError[filename]
          next()
        })
      }
      f.counter--
    } else {
      clearDownload(filename)
      delete downloadError[filename]
    }
    function next() {
      downloadLanes = downloadLanes.filter(([p]) => p !== path)
      continueDownloading()
    }
    next()
    return Promise.resolve()
  }

  function finalizeDownload(filename, hash) {
    var params = matchPathUserFile(filename)
    var outputFilename = os.path.join(localDir, filename)
    var inputFilename = os.path.join(localDir, 'downloads', filename + '.0')
    var i = 0
    if (!os.stat(inputFilename)?.isFile?.()) return Promise.resolve()
    return pipeline($=>$
      .onStart(new Data)
      .repeat(() => {
        inputFilename = os.path.join(localDir, 'downloads', `${filename}.${++i}`)
        return os.stat(inputFilename)?.isFile?.()
      }).to($=>$
        .read(() => inputFilename)
        .replaceStreamStart(evt => [new MessageStart, evt])
        .replaceStreamEnd(new MessageEnd)
        .mux().to($=>$
          .tee(outputFilename)
        )
        .replaceMessageEnd(new StreamEnd)
      )
    ).spawn().then(
      () => getFileStatByUser(params.username, params['*'])
    ).then(stat => {
      if (stat && !stat.list && stat.hash === hash) {
        mesh.write(os.path.join('/shared', params.username, 'hash', hash), hash)
      }
    })
  }

  function clearDownload(filename) {
    var basename = os.path.basename(filename)
    var dirname = os.path.dirname(filename)
    var dir = os.path.join(localDir, 'downloads', dirname)
    os.readDir(dir).forEach(
      name => {
        var i = name.lastIndexOf('.')
        if (name.substring(0, i) === basename) {
          os.rm(os.path.join(dir, name))
        }
      }
    )
  }

  function getFileStat(pathname) {
    pathname = os.path.normalize(pathname)
    if (pathname === '/') return Promise.resolve({ path: '/', list: ['users/']})
    if (pathname === '/users') return getUserList()
    var params = matchPathUser(pathname)
    if (params) return getFileListByUser(params.username)
    var params = matchPathUserFile(pathname)
    if (params) return getFileStatByUser(params.username, params['*'])
    return Promise.resolve(null)
  }

  function getUserList() {
    return mesh.dir('/shared').then(
      meshNames => {
        var s = new Set
        var list = []
        os.readDir(os.path.join(localDir, 'users')).concat(meshNames).forEach(
          name => {
            if (name.endsWith('/') && !s.has(name)) {
              s.add(name)
              list.push(name)
            }
          }
        )
        return { path: '/users', list: list.sort() }
      }
    )
  }

  function getFileListByUser(username) {
    return mesh.dir(os.path.join('/shared', username, 'stat')).then(
      meshNames => {
        var s = new Set
        var list = []
        os.readDir(os.path.join(localDir, 'users', username)).concat(meshNames).forEach(
          name => {
            var k = name.endsWith('/') ? name.substring(0, name.length - 1) : name
            if (!s.has(k)) {
              s.add(k)
              list.push(name)
            }
          }
        )
        return { path: os.path.join('/users', username), list: list.sort() }
      }
    )
  }

  function getFileStatByUser(username, filename) {
    var path = os.path.join('/users', username, filename)
    return Promise.all([
      getLocalStat(username, filename),
      mesh.read(os.path.join('/shared', username, 'stat', filename)).then(
        data => data ? JSON.decode(data) : getMeshDir(username, filename)
      ),
      getACL(os.path.join('/users', username, filename))
    ]).then(
      ([statEndp, statMesh, access]) => {
        if (statEndp instanceof Array) {
          var s = new Set
          var l = []
          var combined = statEndp
          if (statMesh instanceof Array) combined = combined.concat(statMesh)
          combined.forEach(
            name => {
              var k = name.endsWith('/') ? name.substring(0, name.length - 1) : name
              if (!s.has(k)) {
                s.add(k)
                l.push(name)
              }
            }
          )
          return {
            path,
            list: l.sort(),
            access,
          }
        } else if (statMesh instanceof Array) {
          statMesh = null
        }
        if (!statEndp && !statMesh) {
          if (access) {
            return { path, list: [], access }
          } else {
            return null
          }
        }
        var time = 0
        var size = 0
        var hash = ''
        var chunks = null
        var state = ''
        if (
          statEndp?.hash !== statMesh?.hash ||
          statEndp?.size !== statMesh?.size ||
          statEndp?.chunks?.length !== statMesh?.chunks?.length ||
          statEndp?.chunks?.some?.((h, i) => (h !== statMesh?.chunks?.[i]))
        ) {
          var timeEndp = statEndp?.time || 0
          var timeMesh = statMesh?.time || 0
          if (timeEndp < timeMesh) {
            time = timeMesh
            size = statMesh.size
            hash = statMesh.hash
            chunks = statMesh.chunks
            state = statEndp ? 'outdated' : 'missing'
          } else {
            time = timeEndp
            size = statEndp.size
            hash = statEndp.hash
            chunks = statEndp.chunks
            state = statMesh ? 'changed' : 'new'
          }
        } else {
          time = statMesh.time
          size = statEndp.size
          hash = statEndp.hash
          chunks = statEndp.chunks
          state = 'synced'
        }
        var stat = {
          path,
          state,
          size,
          time,
          hash,
          chunks,
        }
        if (path in downloadFiles) {
          var f = downloadFiles[path]
          stat.downloading = f.downloadedSize / f.size
        }
        return mesh.stat(os.path.join('/shared', username, 'hash', hash)).then(
          s => ({ ...stat, sources: s?.sources || [], access })
        )
      }
    )
  }

  function getACL(pathname) {
    pathname = os.path.normalize(pathname)
    var params = matchPathUserFile(pathname)
    if (!params) return Promise.resolve(null)
    var username = params.username
    var filename = params['*']
    if (username !== app.username) return null
    return mesh.read(`/users/${username}/acl/${filename}`).then(
      data => {
        try {
          return JSON.decode(data)
        } catch {
          return null
        }
      }
    )
  }

  function setACL(pathname, acl) {
    pathname = os.path.normalize(pathname)
    var params = matchPathUserFile(pathname)
    if (!params) return Promise.resolve(false)
    var username = params.username
    var filename = params['*']
    if (username !== app.username) return false
    var data = {
      all: acl.all || null,
      users: acl.users || null,
    }
    return mesh.write(
      `/users/${username}/acl/${filename}`, JSON.encode(data)
    ).then(
      () => mesh.acl(`/shared/${username}/stat/${filename}`, data)
    ).then(data)
  }

  function listDownloads() {
    var t = Date.now()
    return Promise.resolve(
      Object.values(downloadFiles).map(
        f => {
          var d = t - f.receivedSince
          if (d >= 1000) {
            f.speed = Math.round(f.receivedSize / (d/1000))
            f.receivedSize = 0
            f.receivedSince = t
          }
          return {
            path: f.path,
            size: f.size,
            hash: f.hash,
            downloading: f.downloadedSize / f.size,
            speed: f.speed,
            error: downloadError[f.path] || null,
          }
        }
      )
    )
  }

  function listUploads() {
    return Promise.resolve(
      Object.keys(uploadFiles)
    )
  }

  function downloadFile(pathname) {
    pathname = os.path.normalize(pathname)
    if (pathname in downloadFiles) return Promise.resolve(true)
    if (pathname in uploadFiles) return Promise.resolve(false)
    var params = matchPathUserFile(pathname)
    if (!params) return Promise.resolve(false)
    var username = params.username
    var filename = params['*']
    return mesh.read(os.path.join('/shared', username, 'stat', filename)).then(
      data => {
        if (!data) return false
        if (pathname in downloadFiles) return true
        var stat = JSON.decode(data)
        if (stat.size === 0 || !stat.chunks?.length) {
          pathname = os.path.join(localDir, pathname)
          os.mkdir(os.path.dirname(pathname), { recursive: true })
          os.write(pathname, new Data)
        } else {
          appendDownload(pathname, stat)
          continueDownloading()
        }
        return true
      }
    )
  }

  function cancelDownload(pathname) {
    pathname = os.path.normalize(pathname)
    delete downloadFiles[pathname]
    downloadQueue = downloadQueue.filter(f => f.pathname !== pathname)
    return Promise.resolve()
  }

  function uploadFile(pathname) {
    pathname = os.path.normalize(pathname)
    if (pathname in uploadFiles) return Promise.resolve(true)
    if (pathname in downloadFiles) return Promise.resolve(false)
    var params = matchPathUserFile(pathname)
    if (!params) return Promise.resolve(false)
    var username = params.username
    var filename = params['*']
    if (username !== app.username) throw 'No permission'
    return getFileStatByUser(username, filename).then(
      statLocal => {
        if (!statLocal) return false
        if (statLocal.list) return false
        if (statLocal.state === 'synced') return true
        if (statLocal.state !== 'changed' && statLocal.state !== 'new') return false
        var stat = {
          time: statLocal.time,
          size: statLocal.size,
          hash: statLocal.hash,
          chunks: statLocal.chunks,
        }
        uploadFiles[pathname] = stat
        var statData = JSON.encode(stat)
        return Promise.all([
          mesh.write(os.path.join('/shared', username, 'stat', filename), statData),
          mesh.write(os.path.join('/shared', username, 'hash', stat.hash), stat.hash),
        ]).then(() => {
          delete uploadFiles[pathname]
          return true
        })
      }
    )
  }

  function getLocalStat(username, filename) {
    var localPathname = os.path.join(localDir, 'users', username, filename)
    var cachePathname = os.path.join(localDir, 'cache', username, filename)
    try {
      var statLocal = os.stat(localPathname)
      var statCache = JSON.decode(os.read(cachePathname))
    } catch {}
    if (!statLocal) return Promise.resolve(null)
    if (statLocal.isDirectory()) return os.readDir(localPathname)
    if (os.path.join('/users', username, filename) in downloadFiles) return statCache || null
    var time = Math.floor(statLocal.mtime * 1000)
    if (!statCache || statCache.time !== time) {
      var hasher = new crypto.Hash('sha256')
      var chunkHasher = new crypto.Hash('sha256')
      var chunks = []
      var hashSize = 0
      var fileSize = 0

      function append(chunk) {
        hashSize += chunk.size
        fileSize += chunk.size
        chunkHasher.update(chunk)
        hasher.update(chunk)
        if (hashSize === CHUNK_SIZE) {
          chunks.push(chunkHasher.digest('hex'))
          chunkHasher = new crypto.Hash('sha256')
          hashSize = 0
        }
      }

      return pipy.read(localPathname, $=>$
        .handleData(data => {
          append(data.shift(CHUNK_SIZE - hashSize))
          new Array(Math.floor(data.size / CHUNK_SIZE)).fill().forEach(
            () => append(data.shift(CHUNK_SIZE))
          )
          if (data.size > 0) append(data)
        })
      ).then(() => {
        if (hashSize > 0) {
          chunks.push(chunkHasher.digest('hex'))
        }
        var stat = { time, size: fileSize, hash: hasher.digest('hex'), chunks }
        try {
          os.mkdir(os.path.dirname(cachePathname), { recursive: true })
          os.write(cachePathname, JSON.encode(stat))
        } catch (err) {
          app.log(`cannot cache file stat for ${os.path.join('/', username, filename)}: ${err.message}`)
        }
        return stat
      })
    } else {
      return Promise.resolve(statCache)
    }
  }

  function getMeshDir(username, filename) {
    var pathname = os.path.join('/shared', username, 'stat', filename)
    return mesh.dir(pathname)
  }

  var $ctx
  var $params
  var $filename
  var $contentType
  var $chunks
  var $sources
  var $sourcesLB

  var streamFile = pipeline($=>$
    .onStart(p => { $params = p })
    .handleMessageStart(
      function () {
        var params = matchPathUserFile('/' + $params['*'])
        if (!params) return
        var username = URL.decodeComponent(params.username)
        var filename = URL.decodeComponent(params['*'])
        return getFileStatByUser(username, filename).then(stat => {
          if (stat && !stat.list) {
            if (stat.state === 'new') return
            $filename = os.path.join('/users', username, filename)
            var i = $filename.lastIndexOf('.')
            if (i > 0) {
              $contentType = MIME[$filename.substring(i)]
            }
            if (stat.state !== 'synced') {
              $chunks = stat.chunks
              $sources = new Set(stat.sources)
              $sourcesLB = new algo.LoadBalancer(stat.sources)
            }
          }
        })
      }
    )
    .pipe(
      () => {
        if ($sourcesLB) return 'remote'
        if ($filename) return 'local'
        return response404
      }, {
        'local': ($=>$
          .read(() => os.path.join(localDir, $filename))
          .replaceStreamStart(data => [new MessageStart({ status: 200, headers: { 'content-type': $contentType }}), data])
          .replaceStreamEnd(new MessageEnd)
        ),
        'remote': ($=>$
          .replaceMessage(
            () => [
              ...$chunks.map((hash, index) => new Message({ index, hash })),
              new StreamEnd
            ]
          )
          .replaceMessage(
            function (msg) {
              var tryNextSource = () => {
                var ep = $sourcesLB.allocate(undefined, ep => $sources.has(ep))?.target
                if (!ep) return Promise.resolve(new StreamEnd)
                return mesh.request(
                  ep, new Message({
                    method: 'GET',
                    path: os.path.join('/api/chunks', encodePathname($filename)) + '?chunk=' + msg.head.index,
                  })
                ).then(res => {
                  if (res?.head?.status === 200 && res.body) {
                    var hasher = new crypto.Hash('sha256')
                    hasher.update(res.body)
                    if (hasher.digest('hex') === msg.head.hash) {
                      return res.body
                    }
                  }
                  $sources.delete(ep)
                  return tryNextSource()
                })
              }
              return tryNextSource()
            }
          )
          .replaceStreamStart(data => [new MessageStart({ status: 200, headers: { 'content-type': $contentType }}), data])
          .replaceStreamEnd(new MessageEnd)
        ),
      }
    )
  )

  var serveChunk = pipeline($=>$
    .onStart(c => { $ctx = c })
    .handleMessageStart(
      function (req) {
        var params = matchPathChunk(req.head.path)
        if (!params) return
        var username = URL.decodeComponent(params.username)
        var filename = URL.decodeComponent(params['*'])
        return mesh.access(os.path.join('/shared', username, 'stat', filename), $ctx.peer.username).then(
          ret => {
            if (ret) {
              $filename = os.path.join('/users', username, filename)
            }
          }
        )
      }
    )
    .pipe(
      function (req) {
        if (req instanceof MessageStart) {
          if (!$filename) return response404
          var url = new URL(req.head.path)
          var chunkNum = url.searchParams.get('chunk')
          if (!chunkNum) return response404
          if (!matchPathUserFile($filename)) return response404
          var path = os.path.join(localDir, $filename)
          var seek = Number.parseInt(chunkNum) * CHUNK_SIZE
          return pipeline($=>$
            .read(path, { seek, size: CHUNK_SIZE })
            .replaceStreamStart(evt => [new MessageStart, evt])
            .replaceStreamEnd(evt => [new MessageEnd, evt])
          )
        }
      }
    )
  )

  var response404 = pipeline($=>$
    .replaceData()
    .replaceMessage(new Message({ status: 404 }))
  )

  return {
    allEndpoints,
    getEndpointConfig,
    setEndpointConfig,
    allEndpointMirrors,
    getEndpointMirror,
    setEndpointMirror,
    getFileStat,
    getACL,
    setACL,
    listDownloads,
    listUploads,
    downloadFile,
    cancelDownload,
    uploadFile,
    streamFile,
    serveChunk,
  }
}

function encodePathname(pathname) {
  return pathname.split('/').map(s => URL.encodeComponent(s)).join('/')
}
