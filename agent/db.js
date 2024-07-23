var db = null

function open(pathname) {
  db = sqlite(pathname)

  db.exec(`
    CREATE TABLE IF NOT EXISTS meshes (
      name TEXT PRIMARY KEY,
      ca TEXT NOT NULL,
      agent TEXT NOT NULL,
      bootstraps TEXT NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS apps (
      mesh TEXT NOT NULL,
      name TEXT NOT NULL,
      tag TEXT NOT NULL,
      provider TEXT NOT NULL,
      username TEXT NOT NULL,
      state TEXT NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      mesh TEXT NOT NULL,
      provider TEXT NOT NULL,
      app TEXT NOT NULL,
      path TEXT NOT NULL,
      data TEXT NOT NULL
    )
  `)
}

function recordToMesh(rec) {
  return {
    name: rec.name,
    ca: rec.ca,
    agent: JSON.parse(rec.agent),
    bootstraps: rec.bootstraps.split(','),
  }
}

function allMeshes() {
  return (
    db.sql('SELECT * FROM meshes')
      .exec()
      .map(recordToMesh)
  )
}

function getMesh(name) {
  return (
    db.sql('SELECT * FROM meshes WHERE name = ?')
      .bind(1, name)
      .exec()
      .slice(0, 1)
      .map(recordToMesh)[0]
  )
}

function setMesh(name, mesh) {
  var old = getMesh(name)
  if (old) {
    mesh = { ...old, ...mesh }
    var agent = { ...old.agent, ...mesh.agent }
    agent.id = old.agent.id
    db.sql('UPDATE meshes SET ca = ?, agent = ?, bootstraps = ? WHERE name = ?')
      .bind(1, mesh.ca || '')
      .bind(2, JSON.stringify(agent))
      .bind(3, mesh.bootstraps.join(','))
      .bind(4, name)
      .exec()
  } else {
    var agent = mesh.agent
    agent.id = algo.uuid()
    db.sql('INSERT INTO meshes(name, ca, agent, bootstraps) VALUES(?, ?, ?, ?)')
      .bind(1, name)
      .bind(2, mesh.ca || '')
      .bind(3, JSON.stringify(agent))
      .bind(4, mesh.bootstraps.join(','))
      .exec()
  }
}

function delMesh(name) {
  db.sql('DELETE FROM ports WHERE mesh = ?')
    .bind(1, name)
    .exec()
  db.sql('DELETE FROM services WHERE mesh = ?')
    .bind(1, name)
    .exec()
  db.sql('DELETE FROM apps WHERE mesh = ?')
    .bind(1, name)
    .exec()
  db.sql('DELETE FROM meshes WHERE name = ?')
    .bind(1, name)
    .exec()
}

function recordToApp(rec) {
  return {
    provider: rec.provider,
    name: rec.name,
    tag: rec.tag,
    username: rec.username,
    state: rec.state,
  }
}

function allApps(mesh) {
  return (
    db.sql('SELECT * FROM apps WHERE mesh = ?')
      .bind(1, mesh)
      .exec()
      .map(recordToApp)
  )
}

function getApp(mesh, provider, name, tag) {
  return (
    db.sql('SELECT * FROM apps WHERE mesh = ? AND provider = ? AND name = ? AND tag = ?')
      .bind(1, mesh)
      .bind(2, provider)
      .bind(3, name)
      .bind(4, tag)
      .exec()
      .slice(0, 1)
      .map(recordToApp)[0]
  )
}

function setApp(mesh, provider, name, tag, app) {
  var old = getApp(mesh, provider, name, tag)
  if (old) {
    db.sql('UPDATE apps SET username = ?, state = ? WHERE mesh = ? AND provider = ? AND name = ? AND tag = ?')
      .bind(1, 'username' in app ? app.username : old.username)
      .bind(2, 'state' in app ? app.state : old.state)
      .bind(3, mesh)
      .bind(4, provider)
      .bind(5, name)
      .bind(6, tag)
      .exec()
  } else {
    db.sql('INSERT INTO apps(mesh, provider, name, tag, username, state) VALUES(?, ?, ?, ?, ?, ?)')
      .bind(1, mesh)
      .bind(2, provider)
      .bind(3, name)
      .bind(4, tag)
      .bind(5, app.username || '')
      .bind(6, app.state || '')
      .exec()
  }
}

function delApp(mesh, provider, name, tag) {
  db.sql('DELETE FROM apps WHERE mesh = ? AND provider = ? AND name = ? AND tag = ?')
    .bind(1, mesh)
    .bind(2, provider)
    .bind(3, name)
    .bind(4, tag)
    .exec()
}

function allFiles(mesh, provider, app, path) {
  return (
    db.sql('SELECT path FROM files WHERE mesh = ? AND provider = ? AND app = ?')
      .bind(1, mesh)
      .bind(2, provider)
      .bind(3, app)
      .exec()
      .map(rec => rec.path)
  )
}

function getFile(mesh, provider, app, path) {
  var sql = db.sql('SELECT data FROM files WHERE mesh = ? AND provider = ? AND app = ? AND path = ?')
    .bind(1, mesh)
    .bind(2, provider)
    .bind(3, app)
    .bind(4, path)
  if (sql.step()) return null
  return sql.column(0)
}

function setFile(mesh, provider, app, path, data) {
  if (getFile(mesh, provider, app, path)) {
    db.sql('UPDATE files SET data = ? WHERE mesh = ? AND provider = ? AND app = ? AND path = ?')
      .bind(1, data)
      .bind(2, mesh)
      .bind(3, provider)
      .bind(4, app)
      .bind(5, path)
      .exec()
  } else {
    db.sql('INSERT INTO files(mesh, provider, app, path, data) VALUES(?, ?, ?, ?, ?)')
      .bind(1, mesh)
      .bind(2, provider)
      .bind(3, app)
      .bind(4, path)
      .bind(5, data)
      .exec()
  }
}

function delFile(mesh, provider, app, path) {
  db.sql('DELETE FROM files WHERE mesh = ? AND provider = ? AND app = ? AND path = ?')
    .bind(1, mesh)
    .bind(2, provider)
    .bind(3, app)
    .bind(4, path)
    .exec()
}

export default {
  open,
  allMeshes,
  getMesh,
  setMesh,
  delMesh,
  allApps,
  getApp,
  setApp,
  delApp,
  allFiles,
  getFile,
  setFile,
  delFile,
}
