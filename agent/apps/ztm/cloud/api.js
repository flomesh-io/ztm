var CHUNK_SIZE = 2*1024*1024
var DOWNLOAD_CONCURRENCY = 5

//
// Cloud view:
//   /users
//     /<username>
//       ...
//
// In the local directory:
//   /users/<username>/...  <-- Identical to the cloud view
//   /cache/<username>/
//     {
//       time: 1789123456789,
//       size: 1024,
//       hash: [
//         '0123456789abcdef',
//         '0123456789abcdef',
//       ]
//     }
//   /download/<username>/
//     <filename>.all
//     <filename>.<num>
//
// On the mesh:
//   /shared/<username>/stat/
//     {
//       time: 1789123456789,
//       size: 1024,
//       hash: [
//         '0123456789abcdef',
//         '0123456789abcdef',
//       ]
//     }
//   /shared/<username>/hash/
//     <filename>.all
//     <filename>.<num>
//

export default function ({ app, mesh }) {
  var localDir

  applyConfig()

  function applyConfig() {
    return getLocalConfig().then(
      config => {
        localDir = config.localDir
        if (localDir.startsWith('~/')) {
          localDir = os.home() + localDir.substring(1)
        }
      }
    )
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
        config.mirrors ??= []
        return config
      }
    )
  }

  function setLocalConfig(config) {
    mesh.write('/local/config.json', JSON.encode(config))
    return applyConfig()
  }

  var matchPathCloud = new http.Match('/users/{username}/*')
  var matchPathChunk = new http.Match('/api/chunks/*')

  var downloadQueue = []
  var downloadFiles = {}
  var downloadLanes = []
  var downloadError = {}

  function continueDownloading() {
    var vacantLanes = DOWNLOAD_CONCURRENCY - downloadLanes.length
    new Array(vacantLanes).fill().forEach(() => {
      var file = downloadQueue[0]
      if (file) {
        var chunk = file.chunks.shift()
        if (file.chunks.length === 0) {
          downloadQueue.shift()
          delete downloadFiles[file.path]
        }
        if (chunk) {
          downloadLanes.push(chunk)
          var path = chunk[0]
          var hash = chunk[1]
          var params = matchPathCloud(path)
          var username = params.username
          var filename = params['*']
          var pathname = os.path.join('/shared', username, 'hash', filename)
          mesh.stat(pathname).then(
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
    var outputPath = os.path.join(localDir, 'download', path)
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
      if (!downloaded) return
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
        return downloadChunkFrom(path, hash, sources)
      }
    })
  }

  function finalizeChunk(path) {
    downloadLanes = downloadLanes.filter(([p]) => p !== path)
    return continueDownloading()
  }

  function getFileStat(pathname) {
    pathname = os.path.normalize(pathname)
    var params = matchPathCloud(pathname)
    if (!params) return Promise.resolve(null)
    var username = params.username
    var filename = params['*']
    return Promise.all([
      getLocalStat(username, filename),
      mesh.read(os.path.join('/shared', username, 'stat', filename)).then(data => data ? JSON.decode(data) : getMeshDir(username, filename)),
      mesh.stat(os.path.join('/shared', username, 'hash', filename + '.all')),
    ]).then(
      ([statEndp, statMesh, statHash]) => {
        if (!statEndp && !statMesh) return null
        if (statEndp instanceof Array) {
          if (statMesh instanceof Array) {
            statMesh.forEach(name => {
              if (!statEndp.includes(name)) {
                statEndp.push(name)
              }
            })
          }
          return { state: 'dir', filenames: statEndp }
        } else if (statMesh instanceof Array) {
          statMesh = null
        }
        var timeEndp = statEndp?.time || 0
        var timeMesh = statMesh?.time || 0
        var time = 0
        var size = 0
        var hash = null
        var state = 'synced'
        if (timeEndp < timeMesh) {
          time = timeMesh
          size = statMesh.size
          hash = statMesh.hash
          state = statEndp ? 'outdated' : 'missing'
        } else if (timeEndp > timeMesh) {
          time = timeEndp
          size = statEndp.size
          hash = statEndp.hash
          state = statMesh ? 'changed' : 'new'
        } else if (
          statEndp.size !== statMesh.size ||
          statEndp.hash.length !== statMesh.hash?.length ||
          statEndp.hash.some((h, i) => (h !== statMesh.hash?.[i]))
        ) {
          state = 'corrupt'
          hash = statEndp.hash
        }
        return {
          state,
          size,
          time,
          hash,
          sources: statHash?.sources || [],
        }
      }
    )
  }

  function setFileStat(pathname, stat) {
    pathname = os.path.normalize(pathname)
    var params = matchPathCloud(pathname)
    if (!params) return Promise.resolve(null)
    var username = params.username
    var filename = params['*']
    var meshStatPath = os.path.join('/shared', username, 'stat', filename)
    var meshHashPath = os.path.join('/shared', username, 'hash', filename)
    return getFileStat(pathname).then(
      statLocal => {
        if (stat?.state === 'synced') {
          if (!statLocal) return null
          if (statLocal.state === 'dir') return null
          if (statLocal.state === 'synced') return statLocal
          if (statLocal.state !== 'changed' && statLocal.state !== 'new') return statLocal
          stat = {
            time: statLocal.time,
            size: statLocal.size,
            hash: statLocal.hash,
          }
          mesh.write(meshStatPath, JSON.encode(stat))
          mesh.write(meshHashPath + '.all', stat.hash.join('\n'))
          var queue = [...stat.hash]
          function writeHash(i) {
            if (queue.length > 0) {
              return mesh.write(`${meshHashPath}.${i}`, queue.shift()).then(
                () => writeHash(i + 1)
              )
            } else {
              return getFileStat(pathname)
            }
          }
          // stat.hash.forEach(
          //   (hash, i) => mesh.write(`${meshHashPath}.${i}`, hash)
          // )
          return writeHash(0)
        } else {
          return Promise.resolve(statLocal)
        }
      }
    )
  }

  function listDownloads() {
    return Promise.resolve(
      downloadQueue.map(
        file => ({
          filename: file.path
        })
      )
    )
  }

  function downloadFile(pathname) {
    pathname = os.path.normalize(pathname)
    var params = matchPathCloud(pathname)
    if (!params) return Promise.resolve(null)
    var username = params.username
    var filename = params['*']
    return mesh.read(os.path.join('/shared', username, 'stat', filename)).then(
      data => {
        if (!data) return false
        var statMesh = JSON.decode(data)
        if (pathname in downloadFiles) return true
        var file = {
          path: pathname,
          chunks: statMesh.hash.map((hash, i) => [`${pathname}.${i}`, hash])
        }
        downloadFiles[pathname] = file
        downloadQueue.push(file)
        continueDownloading()
        return true
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
    var time = Math.floor(statLocal.mtime * 1000)
    if (!statCache || statCache.time !== time) {
      var chunks = []
      var hasher = new crypto.Hash('sha256')
      var hashSize = 0
      var fileSize = 0

      function append(chunk) {
        hashSize += chunk.size
        fileSize += chunk.size
        hasher.update(chunk)
        if (hashSize === CHUNK_SIZE) {
          chunks.push(hasher.digest('hex'))
          hasher = new crypto.Hash('sha256')
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
          chunks.push(hasher.digest('hex'))
        }
        var stat = { time, size: fileSize, hash: chunks }
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
    return mesh.dir(pathname).then(filenames => {
      if (filenames.length === 0) return null
      var names = {}
      filenames.forEach(path => {
        var name = path.substring(pathname.length + 1)
        var i = name.indexOf('/')
        if (i < 0) i = name.length; else i++
        names[name.substring(0, i)] = true
      })
      return Object.values(names)
    })
  }

  var $ctx

  var serveChunk = pipeline($=>$
    .onStart(c => { $ctx = c })
    .pipe(
      function (req) {
        if (req instanceof MessageStart) {
          var params = matchPathChunk(req.head.path)
          if (!params) return serveChunkReject
          var url = new URL(req.head.path)
          var chunkNum = url.searchParams.get('chunk')
          if (!chunkNum) return serveChunkReject
          var filename = '/' + params['*']
          if (!matchPathCloud(filename)) return serveChunkReject
          var path = os.path.join(localDir, filename)
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
    setFileStat,
    listDownloads,
    downloadFile,
    serveChunk,
  }
}
