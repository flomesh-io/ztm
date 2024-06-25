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

  os.readDir(storeDir).forEach(username => {
    if (username.startsWith('.') || !username.endsWith('/')) return
    var dirname = os.path.join(storeDir, username)
    var pathPrefix = `/home/${username}`
    os.readDir(dirname).forEach(name => {
      if (!name.endsWith('.meta')) return
      var hash = name.substring(0, name.length - 5)
      var filename = os.path.join(dirname, name)
      try {
        var meta = JSON.decode(os.read(filename))
        var time = meta.timestamp
        var path = meta.pathname
        if (path.startsWith(pathPrefix) && typeof time === 'number') {
          var stat = os.stat(os.path.join(dirname, hash))
          if (stat.isFile()) {
            var ent = makeEntry(path, hash, stat.size, time)
            if (time > (pathMap[path]?.time || 0)) pathMap[path] = ent
            hashMap[hash] = ent
          }
        }
      } catch {
        println(`ztm: corrupted metadata file: ${filename}`)
      }
    })
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
    var prefix = os.path.normalize(dirname) + '/'
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

    var username = path.split('/')[2]
    var dirname = os.path.join(storeDir, username)

    try {
      return os.read(os.path.join(dirname, meta.hash))
    } catch {}
  }

  function write(filename, data) {
    var path = os.path.normalize(filename)
    if (!path.startsWith('/home/')) return

    var username = path.split('/')[2]
    var dirname = os.path.join(storeDir, username)

    os.mkdir(dirname, { recursive: true })

    var t = Date.now()
    var h = hash(path, data)
    var meta = { pathname: path, timestamp: t }

    os.write(os.path.join(dirname, h), data)
    os.write(os.path.join(dirname, h + '.meta'), JSON.encode(meta))

    pathMap[path] = hashMap[h] = makeEntry(path, h, data.size, t)
  }

  function remove(filename) {
    var path = os.path.normalize(filename)
    if (!path.startsWith('/home/')) return

    var username = path.split('/')[2]
    var dirname = os.path.join(storeDir, username)

    Object.values(hashMap).forEach(meta => {
      if (meta.pathname === path) {
        os.rm(os.path.join(dirname, meta.hash), { force: true })
        os.rm(os.path.join(dirname, meta.hash + '.meta'), { force: true })
        delete hashMap[meta.hash]
      }
    })

    delete pathMap[path]
  }

  function raw(hash) {
    var meta = hashMap[hash]
    if (!meta) return

    var path = meta.pathname
    var username = path.split('/')[2]
    var dirname = os.path.join(storeDir, username)

    return os.read(os.path.join(dirname, hash))
  }

  function hash(path, data) {
    var h = new crypto.Hash('sha256')
    h.update(data)
    h.update(data.size.toString())
    h.update(path)
    return h.digest().toString('hex')
  }

  return {
    list,
    stat,
    read,
    write,
    remove,
    raw,
    hash,
  }
}
