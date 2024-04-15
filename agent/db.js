var db = null

function open(pathname, reset) {
  if (reset) {
    os.rm(pathname)
  }

  db = sqlite(pathname)

  if (db.exec(
    `SELECT * FROM sqlite_schema WHERE type = 'table' AND name = 'meshes'`
  ).length === 0) {
    db.exec(`
      CREATE TABLE meshes (
        name TEXT PRIMARY KEY,
        agent TEXT NOT NULL,
        bootstraps TEXT NOT NULL
      )
    `)
    db.exec(`
      CREATE TABLE services (
        mesh TEXT NOT NULL,
        name TEXT NOT NULL,
        protocol TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL
      )
    `)
    db.exec(`
      CREATE TABLE ports (
        mesh TEXT NOT NULL,
        ip TEXT NOT NULL,
        port INTEGER NOT NULL,
        protocol TEXT NOT NULL,
        endpoint TEXT,
        service TEXT NOT NULL
      )
    `)
  }
}

function recordToMesh(rec) {
  return {
    name: rec.name,
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
    db.sql('UPDATE meshes SET agent = ?, bootstraps = ? WHERE name = ?')
      .bind(1, JSON.stringify(agent))
      .bind(2, mesh.bootstraps.join(','))
      .bind(3, name)
      .exec()
  } else {
    var agent = mesh.agent
    agent.id = algo.uuid()
    db.sql('INSERT INTO meshes(name, agent, bootstraps) VALUES(?, ?, ?)')
      .bind(1, name)
      .bind(2, JSON.stringify(agent))
      .bind(3, mesh.bootstraps.join(','))
      .exec()
  }
}

function delMesh(name) {
  db.sql('DELETE FROM meshes WHERE name = ?')
    .bind(1, name)
    .exec()
}

function recordToService(rec) {
  return {
    mesh: rec.mesh,
    name: rec.name,
    protocol: rec.protocol,
    host: rec.host,
    port: Number.parseInt(rec.port),
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
    db.sql('UPDATE services SET host = ?, port = ? WHERE mesh = ? AND name = ? AND protocol = ?')
      .bind(1, service.host)
      .bind(2, service.port)
      .bind(3, mesh)
      .bind(4, name)
      .bind(5, proto)
      .exec()
  } else {
    db.sql('INSERT INTO services(mesh, name, protocol, host, port) VALUES(?, ?, ?, ?, ?)')
      .bind(1, mesh)
      .bind(2, name)
      .bind(3, proto)
      .bind(4, service.host)
      .bind(5, service.port)
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
    mesh: rec.mesh,
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
  var old = getPort(ip, proto, port)
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
  allServices,
  getService,
  setService,
  delService,
  allPorts,
  getPort,
  setPort,
  delPort,
}
