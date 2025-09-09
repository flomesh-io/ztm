var db = null

function open(pathname) {
  db = sqlite(pathname)

  db.exec(`
    CREATE TABLE IF NOT EXISTS hubs (
      id TEXT PRIMARY KEY,
      zone TEXT NOT NULL,
      info TEXT NOT NULL,
      updated_at REAL NOT NULL
    )
  `)

  try {
    db.exec(`
      ALTER TABLE hubs
      ADD COLUMN updated_at REAL NOT NULL DEFAULT 0
    `)
  } catch {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS certificates (
      name TEXT PRIMARY KEY,
      data TEXT NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS keys (
      name TEXT PRIMARY KEY,
      data TEXT NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY,
      hash TEXT NOT NULL,
      size INTEGER NOT NULL,
      time REAL NOT NULL,
      since REAL NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS acl (
      path TEXT PRIMARY KEY,
      access TEXT NOT NULL,
      since REAL NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS evictions (
      username TEXT PRIMARY KEY,
      evicted_at REAL NOT NULL,
      expires_at REAL NOT NULL
    )
  `)
}

function allHubs() {
  var t = Date.now() - 30 * 24 * 60 * 60 * 1000
  var all = {}
  db.sql('SELECT id, info FROM hubs WHERE updated_at >= ?')
    .bind(1, t)
    .exec()
    .forEach(r => {
      try {
        all[r.id] = {
          zone: r.zone,
          ...JSON.parse(r.info),
        }
      } catch {}
    })
  return all
}

function setHubs(hubs) {
  var t = Date.now()
  var old = {}
  db.sql('SELECT id FROM hubs')
    .exec()
    .forEach(r => old[r.id] = true)
  Object.entries(hubs).forEach(
    ([id, hub]) => {
      var info = JSON.stringify({ ports: hub.ports, version: hub.version })
      if (id in old) {
        db.sql('UPDATE hubs SET zone = ?, info = ?, updated_at = ? WHERE id = ?')
          .bind(1, hub.zone)
          .bind(2, info)
          .bind(3, t)
          .bind(4, id)
          .exec()
      } else {
        db.sql('INSERT INTO hubs(id, zone, info, updated_at) VALUES(?, ?, ?, ?)')
          .bind(1, id)
          .bind(2, hub.zone)
          .bind(3, info)
          .bind(4, t)
          .exec()
      }
    }
  )
  // Object.keys(old).forEach(
  //   id => {
  //     if (!(id in hubs)) {
  //       db.sql('DELETE FROM hubs WHERE id = ?')
  //         .bind(1, id)
  //         .exec()
  //     }
  //   }
  // )
}

function getHub(id) {
  return (
    db.sql('SELECT zone, info FROM hubs WHERE id = ?')
      .bind(1, id)
      .exec()
      .map(r => {
        try {
          var hub = JSON.parse(r.info)
        } catch {
          var hub = {}
        }
        return { zone: r.zone, ...hub }
      })[0]
  )
}

function setHub(id, hub) {
  var t = Date.now()
  var old = getHub(id)
  if (old) {
    var zone = hub.zone || old.zone
    var info = {
      ports: hub.ports || old.ports,
      version: hub.version || old.version,
    }
    db.sql('UPDATE hubs SET zone = ?, info = ?, updated_at = ? WHERE id = ?')
      .bind(1, zone)
      .bind(2, JSON.stringify(info))
      .bind(3, t)
      .bind(4, id)
      .exec()
  } else {
    var zone = hub.zone
    var info = {
      ports: hub.ports,
      version: hub.version,
    }
    db.sql('INSERT INTO hubs(id, zone, info, updated_at) VALUES(?, ?, ?, ?)')
      .bind(1, id)
      .bind(2, zone)
      .bind(3, JSON.stringify(info))
      .bind(4, t)
      .exec()
  }
}

function getCert(name) {
  return db.sql(`SELECT data FROM certificates WHERE name = ?`)
    .bind(1, name)
    .exec()[0]?.data
}

function setCert(name, data) {
  if (getCert(name)) {
    db.sql(`UPDATE certificates SET data = ? WHERE name = ?`)
      .bind(1, data)
      .bind(2, name)
      .exec()
  } else {
    db.sql(`INSERT INTO certificates(name, data) VALUES(?, ?)`)
      .bind(1, name)
      .bind(2, data)
      .exec()
  }
}

function delCert(name) {
  db.sql(`DELETE FROM certificates WHERE name = ?`)
    .bind(1, name)
    .exec()
}

function allKeys() {
  return db.sql(`SELECT name, data FROM keys`).exec()
}

function getKey(name) {
  return db.sql(`SELECT data FROM keys WHERE name = ?`)
    .bind(1, name)
    .exec()[0]?.data
}

function setKey(name, data) {
  if (getKey(name)) {
    db.sql(`UPDATE keys SET data = ? WHERE name = ?`)
      .bind(1, data)
      .bind(2, name)
      .exec()
  } else {
    db.sql(`INSERT INTO keys(name, data) VALUES(?, ?)`)
      .bind(1, name)
      .bind(2, data)
      .exec()
  }
}

function delKey(name) {
  db.sql(`DELETE FROM keys WHERE name = ?`)
    .bind(1, name)
    .exec()
}

function recordToFile(rec) {
  return {
    pathname: rec.path,
    hash: rec.hash,
    size: +rec.size,
    time: rec.time,
    since: rec.since,
  }
}

function allFiles() {
  return (
    db.sql('SELECT * FROM files')
      .exec()
      .map(recordToFile)
  )
}

function getFile(pathname) {
  return (
    db.sql('SELECT * FROM files WHERE path = ?')
      .bind(1, pathname)
      .exec()
      .map(recordToFile)[0]
  )
}

function setFile(pathname, file) {
  var obj = getFile(pathname)
  if (obj) {
    Object.assign(obj, file)
    db.sql('UPDATE files SET hash = ?, size = ?, time = ?, since = ? WHERE path = ?')
      .bind(1, obj.hash)
      .bind(2, obj.size)
      .bind(3, obj.time)
      .bind(4, obj.since)
      .bind(5, pathname)
      .exec()
  } else {
    db.sql('INSERT INTO files(path, hash, size, time, since) VALUES(?, ?, ?, ?, ?)')
      .bind(1, pathname)
      .bind(2, file.hash)
      .bind(3, file.size)
      .bind(4, file.time)
      .bind(5, file.since)
      .exec()
  }
}

function recordToACL(rec) {
  try {
    var access = JSON.parse(rec.access)
  } catch {
    var access = {}
  }
  return {
    pathname: rec.path,
    access,
    since: rec.since,
  }
}

function allACL() {
  return (
    db.sql('SELECT * FROM acl')
      .exec()
      .map(recordToACL)
  )
}

function getACL(pathname) {
  return (
    db.sql('SELECT * FROM acl WHERE path = ?')
      .bind(1, pathname)
      .exec()
      .map(recordToACL)[0]
  )
}

function setACL(pathname, access, since) {
  var obj = getACL(pathname)
  if (obj) {
    db.sql('UPDATE acl SET access = ?, since = ? WHERE path = ?')
      .bind(1, JSON.stringify(access))
      .bind(2, since)
      .bind(3, pathname)
      .exec()
  } else {
    db.sql('INSERT INTO acl(path, access, since) VALUES(?, ?, ?)')
      .bind(1, pathname)
      .bind(2, JSON.stringify(access))
      .bind(3, since)
      .exec()
  }
}

function recordToEviction(rec) {
  return {
    username: rec.username,
    time: rec.evicted_at,
    expiration: rec.expires_at,
  }
}

function allEvictions() {
  return (
    db.sql('SELECT * FROM evictions')
      .exec()
      .map(recordToEviction)
  )
}

function getEviction(username) {
  return (
    db.sql('SELECT * FROM evictions WHERE username = ?')
      .bind(1, username)
      .exec()
      .map(recordToEviction)[0]
  )
}

function setEviction(username, time, expiration) {
  var obj = getEviction(username)
  if (obj) {
    db.sql('UPDATE evictions SET evicted_at = ?, expires_at = ? WHERE username = ?')
      .bind(1, time)
      .bind(2, expiration)
      .bind(3, username)
      .exec()
  } else {
    db.sql('INSERT INTO evictions(username, evicted_at, expires_at) VALUES(?, ?, ?)')
      .bind(1, username)
      .bind(2, time)
      .bind(3, expiration)
      .exec()
  }
}

function delEviction(username) {
  db.sql(`DELETE FROM evictions WHERE username = ?`)
    .bind(1, username)
    .exec()
}

export default {
  open,
  allHubs,
  setHubs,
  getHub,
  setHub,
  getCert,
  setCert,
  delCert,
  allKeys,
  getKey,
  setKey,
  delKey,
  allFiles,
  getFile,
  setFile,
  allACL,
  getACL,
  setACL,
  allEvictions,
  getEviction,
  setEviction,
  delEviction,
}
