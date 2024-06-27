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
    CREATE TABLE IF NOT EXISTS storage (
      mesh TEXT NOT NULL,
      name TEXT NOT NULL,
      tag TEXT NOT NULL,
      provider TEXT NOT NULL,
      path TEXT NOT NULL,
      data TEXT NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      mesh TEXT NOT NULL,
      name TEXT NOT NULL,
      protocol TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      users TEXT NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS ports (
      mesh TEXT NOT NULL,
      ip TEXT NOT NULL,
      port INTEGER NOT NULL,
      protocol TEXT NOT NULL,
      endpoint TEXT,
      service TEXT NOT NULL
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
      .map(recordToMesh)[0]
  )
}

function setApp(mesh, provider, name, tag, app) {
  var old = getApp(name)
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

function recordToService(rec) {
  return {
    name: rec.name,
    protocol: rec.protocol,
    host: rec.host,
    port: Number.parseInt(rec.port),
    users: JSON.parse(rec.users),
  }
}

function allServices(mesh) {
  if (mesh) {
    return (
      db.sql('SELECT * FROM services WHERE mesh = ?')
        .bind(1, mesh)
        .exec()
        .map(recordToService)
    )
  } else {
    return (
      db.sql('SELECT * FROM services')
        .exec()
        .map(recordToService)
    )
  }
}

function getService(mesh, proto, name) {
  return (
    db.sql('SELECT * FROM services WHERE mesh = ? AND name = ? AND protocol = ?')
      .bind(1, mesh)
      .bind(2, name)
      .bind(3, proto)
      .exec()
      .slice(0, 1)
      .map(recordToService)[0]
  )
}

function setService(mesh, proto, name, service) {
  var old = getService(mesh, proto, name)
  if (old) {
    service = { ...old, ...service }
    db.sql('UPDATE services SET host = ?, port = ?, users = ? WHERE mesh = ? AND name = ? AND protocol = ?')
      .bind(1, service.host)
      .bind(2, service.port)
      .bind(3, JSON.stringify(service.users || null))
      .bind(4, mesh)
      .bind(5, name)
      .bind(6, proto)
      .exec()
  } else {
    db.sql('INSERT INTO services(mesh, name, protocol, host, port, users) VALUES(?, ?, ?, ?, ?, ?)')
      .bind(1, mesh)
      .bind(2, name)
      .bind(3, proto)
      .bind(4, service.host)
      .bind(5, service.port)
      .bind(6, JSON.stringify(service.users || null))
      .exec()
  }
}

function delService(mesh, proto, name) {
  db.sql('DELETE FROM services WHERE mesh = ? AND name = ? AND protocol = ?')
    .bind(1, mesh)
    .bind(2, name)
    .bind(3, proto)
    .exec()
}

function recordToPort(rec) {
  return {
    protocol: rec.protocol,
    listen: {
      ip: rec.ip,
      port: Number.parseInt(rec.port),
    },
    target: {
      endpoint: rec.endpoint,
      service: rec.service,
    }
  }
}

function allPorts(mesh) {
  if (mesh) {
    return (
      db.sql('SELECT * FROM ports WHERE mesh = ?')
        .bind(1, mesh)
        .exec()
        .map(recordToPort)
    )
  } else {
    return (
      db.sql('SELECT * FROM ports')
        .exec()
        .map(recordToPort)
    )
  }
}

function getPort(mesh, ip, proto, port) {
  return (
    db.sql('SELECT * FROM ports WHERE mesh = ? AND ip = ? AND protocol = ? AND port = ?')
      .bind(1, mesh)
      .bind(2, ip)
      .bind(3, proto)
      .bind(4, port)
      .exec()
      .slice(0, 1)
      .map(recordToPort)[0]
  )
}

function setPort(mesh, ip, proto, port, { target }) {
  var old = getPort(mesh, ip, proto, port)
  if (old) {
    db.sql('UPDATE ports SET endpoint = ?, service = ? WHERE mesh = ? AND ip = ? AND protocol = ? AND port = ?')
      .bind(1, target.endpoint)
      .bind(2, target.service)
      .bind(3, mesh)
      .bind(4, ip)
      .bind(5, proto)
      .bind(6, port)
      .exec()
  } else {
    db.sql('INSERT INTO ports(mesh, ip, protocol, port, endpoint, service) VALUES(?, ?, ?, ?, ?, ?)')
      .bind(1, mesh)
      .bind(2, ip)
      .bind(3, proto)
      .bind(4, port)
      .bind(5, target.endpoint)
      .bind(6, target.service)
      .exec()
  }
}

function delPort(mesh, ip, proto, port) {
  db.sql('DELETE FROM ports WHERE mesh = ? AND ip = ? AND protocol = ? AND port = ?')
    .bind(1, mesh)
    .bind(2, ip)
    .bind(3, proto)
    .bind(4, port)
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
  allServices,
  getService,
  setService,
  delService,
  allPorts,
  getPort,
  setPort,
  delPort,
}
