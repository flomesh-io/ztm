//
// Mesh Filesystem
//
// /home
//   /<username>
//     /apps
//       /<provider>
//         /<appname>
// /shared
//   /<username>
//     /pkg
//     /apps
//       /<provider>
//         /<appname>
//

export default function(storeDir) {
  var pathMap = {}
  var hashMap = {}

  storeDir = os.path.resolve(storeDir)

  var st = os.stat(storeDir)
  if (st) {
    if (!st.isDirectory()) {
      throw `directory path already exists as a regular file: ${storeDir}`
    }
  } else {
    os.mkdir(storeDir, { recursive: true })
  }

  os.readDir(storeDir).forEach(name => {
    if (!name.endsWith('.meta')) return
    var hash = name.substring(0, name.length - 5)
    var filename = os.path.join(storeDir, name)
    try {
      var meta = JSON.decode(os.read(filename))
      var time = meta.timestamp
      var path = meta.pathname
      if (path.startsWith('/') && typeof time === 'number') {
        var stat = os.stat(os.path.join(storeDir, hash))
        if (stat.isFile()) {
          var size = meta.deleted ? -1 : stat.size
          var ent = makeEntry(path, hash, size, time)
          if (time > (pathMap[path]?.time || 0)) pathMap[path] = ent
          hashMap[hash] = ent
        }
      }
    } catch {
      println(`ztm: corrupted metadata file: ${filename}`)
    }
  })

  function makeEntry(pathname, hash, size, time) {
    return {
      pathname,
      hash,
      size,
      time,
    }
  }

  function list(dirname) {
    var prefix = os.path.normalize(dirname || '')
    if (!prefix.endsWith('/')) prefix += '/'
    return Object.keys(pathMap).filter(p => p.startsWith(prefix)).sort()
  }

  function stat(filename) {
    var path = os.path.normalize(filename)
    var meta = pathMap[path]
    return meta ? {
      pathname: meta.pathname,
      hash: meta.hash,
      size: meta.size,
      time: meta.time,
    } : null
  }

  function read(filename) {
    var path = os.path.normalize(filename)
    var meta = pathMap[path]
    if (!meta) return
    try {
      return os.read(os.path.join(storeDir, meta.hash))
    } catch {}
  }

  function write(filename, data) {
    var path = os.path.normalize(filename)
    var t = Date.now()
    var h = hash(path, data)
    var meta = { pathname: path, timestamp: t }
    os.write(os.path.join(storeDir, h), data)
    os.write(os.path.join(storeDir, h + '.meta'), JSON.encode(meta))
    pathMap[path] = hashMap[h] = makeEntry(path, h, data.size, t)
    return true
  }

  function tombstone(filename) {
    var path = os.path.normalize(filename)
    var t = Date.now()
    var h = hash(path, new Data, -1)
    var meta = { pathname: path, timestamp: t, deleted: true }
    os.write(os.path.join(storeDir, h), new Data)
    os.write(os.path.join(storeDir, h + '.meta'), JSON.encode(meta))
    pathMap[path] = hashMap[h] = makeEntry(path, h, -1, t)
    return true
  }

  function remove(filename) {
    var path = os.path.normalize(filename)
    Object.values(hashMap).forEach(meta => {
      if (meta.pathname === path) {
        os.rm(os.path.join(storeDir, meta.hash), { force: true })
        os.rm(os.path.join(storeDir, meta.hash + '.meta'), { force: true })
        delete hashMap[meta.hash]
      }
    })
    if (path in pathMap) {
      delete pathMap[path]
      return true
    }
    return false
  }

  function raw(hash) {
    var meta = hashMap[hash]
    if (!meta) return
    return os.read(os.path.join(storeDir, hash))
  }

  function hash(path, data, size) {
    size = size || data.size
    var h = new crypto.Hash('sha256')
    h.update(data)
    h.update(size.toString())
    h.update(path)
    return h.digest().toString('hex')
  }

  return {
    list,
    stat,
    read,
    write,
    tombstone,
    remove,
    raw,
    hash,
  }
}
