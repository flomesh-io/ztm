var db = null

function open(pathname) {
  db = sqlite(pathname)

  if (db.exec(
    `SELECT * FROM sqlite_schema WHERE type = 'table' AND name = 'users'`
  ).length === 0) {
    db.exec(`
      CREATE TABLE users (
        name TEXT PRIMARY KEY,
        cert TEXT NOT NULL,
        key TEXT NOT NULL,
        roles TEXT NOT NULL
      )
    `)
  }
}

function getUser(name) {
  return db.sql(
    `SELECT name, cert, key, roles from users WHERE name = ?`
  )
  .bind(1, name)
  .exec()[0]
}

function setUser(name, obj) {
  var old = getUser(name)
  if (old) {
    Object.assign(old, obj)
    db.sql(
      `UPDATE users SET cert = ?, key = ?, roles = ? WHERE name = ?`
    )
    .bind(1, obj.cert)
    .bind(2, obj.key || '')
    .bind(3, JSON.stringify(obj.roles || {}))
    .bind(4, name)
    .exec()
  } else {
    db.sql(
      `INSERT INTO users(name, cert, key, roles) VALUES(?, ?, ?, ?)`
    )
    .bind(1, name)
    .bind(2, obj.cert)
    .bind(3, obj.key || '')
    .bind(4, JSON.stringify(obj.roles || {}))
    .exec()
  }
}

function delUser(name) {
  db.sql(
    `DELETE FROM users WHERE name = ?`
  )
  .bind(1, name)
  .exec()
}

export default {
  open,
  getUser,
  setUser,
  delUser,
}
