var db = null

function open(pathname) {
  db = sqlite(pathname)

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
}

function getCert(name) {
  return db.sql(`SELECT data FROM certificates WHERE name = ?`)
    .bind(1, name)
    .exec()[0]?.data
}

function setCert(name, data) {
  if (getKey(name)) {
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

export default {
  open,
  getCert,
  setCert,
  delCert,
  getKey,
  setKey,
  delKey,
  allFiles,
  getFile,
  setFile,
  allACL,
  getACL,
  setACL,
}
