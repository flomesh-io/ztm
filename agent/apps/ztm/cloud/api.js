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
  var mirrorPaths

  applyConfig().then(
    () => resumeDownloads()
  ).then(
    () => initMirrors()
  ).then(
    () => watchMirrors()
  )

  mesh.acl(`/shared/${app.username}/stat`, { all: 'block' })

  function applyConfig() {
    return getLocalConfig().then(
      config => {
        localDir = config.localDir
        mirrorPaths = config.mirrorPaths
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
            var stat = JSON.decode(data)
            var chunks = stat.chunks.map((hash, i) => {
              var filename = `${pathname}.${i}`
              try {
                var hasher = new crypto.Hash('sha256')
                hasher.update(os.read(os.path.join(rootDir, filename)))
                if (hasher.digest('hex') === hash) return null
              } catch {}
              return [filename, hash]
            }).filter(s=>s)
            if (chunks.length === 0) {
              finalizeDownload(pathname, stat.hash)
              clearDownload(pathname)
            } else {
              appendDownload(pathname, stat, chunks.filter(s=>s))
              continueDownloading()
            }
          } catch {}
        }
      )
    }))
  }

  function initMirrors() {
    if (mirrorPaths instanceof Array && mirrorPaths.length > 0) {
      return mesh.list('/shared').then(files => {
        var mirrors = mirrorPaths.map(path => path.endsWith('/') ? path : path + '/')
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
                if (stat.state !== 'synced' && stat.state !== 'updated') {
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
    if (mirrorPaths instanceof Array && mirrorPaths.length > 0) {
      mesh.watch('/shared/').then(pathnames => {
        try {
          var mirrors = mirrorPaths.map(path => path.endsWith('/') ? path : path + '/')
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
      )).then(res => res ? JSON.decode(res.body) : null)
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

  function getLocalConfig() {
    return mesh.read('/local/config.json').then(
      data => {
        try {
          var config = JSON.decode(data) || {}
        } catch {
          var config = {}
        }
        config.localDir ??= '~/ztmCloud'
        config.mirrorPaths ??= []
        return config
      }
    )
  }

  function setLocalConfig(config) {
    mesh.write('/local/config.json', JSON.encode(config))
    return applyConfig().then(
      () => initMirrors()
    )
  }

  var downloadQueue = []
  var downloadFiles = {}
  var downloadLanes = []
  var downloadError = {}
  var uploadFiles = {}

  function appendDownload(pathname, stat, chunks) {
    chunks = chunks || stat.chunks.map((hash, i) => [`${pathname}.${i}`, hash])
    var download = {
      path: pathname,
      size: stat.size,
      hash: stat.hash,
      chunks,
      counter: chunks.length,
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
          var params = matchPathUserFile(path)
          var username = params.username
          mesh.stat(os.path.join('/shared', username, 'hash', file.hash)).then(
            stat => downloadChunk(path, hash, stat?.sources || [])
          )
        }
      }
    })
  }

  function downloadChunk(path, hash, sources) {
    if (sources.length === 0) {
      app.log(downloadError[path] = `Chunk ${path} not found`)
      return finalizeChunk(path)
    }
    var i = path.lastIndexOf('.')
    var filename = path.substring(0,i)
    var chunkNum = path.substring(i+1)
    var outputPath = os.path.join(localDir, 'downloads', path)
    os.mkdir(os.path.dirname(outputPath), { recursive: true })
    var ep = sources.splice(Math.floor(Math.random() * sources.length), 1)[0]
    var downloaded = null
    app.log(`Downloading chunk ${path}...`)
    return pipeline($=>$
      .onStart(
        new Message({
          method: 'GET',
          path: os.path.join('/api/chunks', filename) + '?chunk=' + chunkNum,
        })
      )
      .muxHTTP().to($=>$
        .pipe(mesh.connect(ep))
      )
      .replaceMessage(res => {
        var status = res?.head?.status
        if (status === 200) {
          downloaded = res.body
        } else {
          app.log(`Downloading ${filename} from ep ${ep} returned status ${status}`)
        }
        return new StreamEnd
      })
    ).spawn().then(() => {
      if (!downloaded) return '' // no hash
      os.write(outputPath, downloaded)
      var hasher = new crypto.Hash('sha256')
      return pipy.read(outputPath, $=>$
        .handleData(data => hasher.update(data))
      ).then(() => hasher.digest('hex'))
    }).then(h => {
      if (h === hash) {
        return finalizeChunk(path)
      } else {
        app.log(`Chunk ${path} from ep ${ep} was corrupt`)
        return downloadChunk(path, hash, sources)
      }
    })
  }

  function finalizeChunk(path) {
    var i = path.lastIndexOf('.')
    var filename = path.substring(0, i)
    var f = downloadFiles[filename]
    if (f && f.counter === 1) {
      return finalizeDownload(filename, f.hash).then(() => {
        clearDownload(filename)
        delete downloadFiles[filename]
        delete downloadError[filename]
        next()
      })
    }
    f.counter--
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
      if (stat.hash === hash) {
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
    if (pathname === '/') return Promise.resolve(['users/'])
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
        return list.sort()
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
        return list.sort()
      }
    )
  }

  function getFileStatByUser(username, filename) {
    return Promise.all([
      getLocalStat(username, filename),
      mesh.read(os.path.join('/shared', username, 'stat', filename)).then(
        data => data ? JSON.decode(data) : getMeshDir(username, filename)
      ),
      getACL(os.path.join('/users', username, filename))
    ]).then(
      ([statEndp, statMesh, access]) => {
        if (statEndp instanceof Array) {
          if (statMesh instanceof Array) {
            var s = new Set
            var l = []
            statEndp.concat(statMesh).forEach(
              name => {
                var k = name.endsWith('/') ? name.substring(0, name.length - 1) : name
                if (!s.has(k)) {
                  s.add(k)
                  l.push(name)
                }
              }
            )
          }
          return l.sort()
        } else if (statMesh instanceof Array) {
          statMesh = null
        }
        if (!statEndp && !statMesh) return null
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
          time = timeMesh
          size = statEndp.size
          hash = statEndp.hash
          chunks = statEndp.chunks
          state = 'synced'
        }
        var path = os.path.join('/users', username, filename)
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
          var n = Math.ceil(f.size / CHUNK_SIZE)
          stat.downloading = (n - f.counter) / n
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
    return Promise.resolve(
      Object.values(downloadFiles).map(
        f => {
          var n = Math.ceil(f.size / CHUNK_SIZE)
          return {
            path: f.path,
            size: f.size,
            hash: f.hash,
            downloading: (n - f.counter) / n,
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
        appendDownload(pathname, stat)
        continueDownloading()
        return true
      }
    )
  }

  function uploadFile(pathname) {
    pathname = os.path.normalize(pathname)
    if (pathname in uploadFiles) return Promise.resolve(true)
    if (pathname in downloadFiles) return Promise.resolve(false)
    var params = matchPathUserFile(pathname)
    if (!params) return Promise.resolve(false)
    var username = params.username
    var filename = params['*']
    return getFileStatByUser(username, filename).then(
      statLocal => {
        if (!statLocal) return false
        if (statLocal instanceof Array) return false
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
        Promise.all([
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
  var $filename

  var serveChunk = pipeline($=>$
    .onStart(c => { $ctx = c })
    .handleMessageStart(
      function (req) {
        var params = matchPathChunk(req.head.path)
        if (!params) return
        var username = params.username
        var filename = params['*']
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
          if (!$filename) return serveChunkReject
          var url = new URL(req.head.path)
          var chunkNum = url.searchParams.get('chunk')
          if (!chunkNum) return serveChunkReject
          if (!matchPathUserFile($filename)) return serveChunkReject
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

  var serveChunkReject = pipeline($=>$
    .replaceData()
    .replaceMessage(new Message({ status: 404 }))
  )

  return {
    allEndpoints,
    getEndpointConfig,
    setEndpointConfig,
    getFileStat,
    getACL,
    setACL,
    listDownloads,
    listUploads,
    downloadFile,
    uploadFile,
    serveChunk,
  }
}
