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
}

function close() {
  db.close()
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

export default {
  open,
  close,
  getCert,
  setCert,
  delCert,
  getKey,
  setKey,
  delKey,
}
