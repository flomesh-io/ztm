import db from './db.js'
import Mesh from './mesh.js'

//
// Data sources:
//   Local storage:
//     - Meshes
//     - Services (self)
//     - Ports
//   Mesh:
//     - Endpoints
//     - Services (others)
//

var rootDir = ''
var meshes = {}

function findMesh(name) {
  var m = meshes[name]
  if (m) return m
  throw `Mesh not found: ${name}`
}

function init(dirname) {
  rootDir = os.path.resolve(dirname)
  db.allMeshes().forEach(
    function (mesh) {
      meshes[mesh.name] = Mesh(
        os.path.join(rootDir, 'meshes', mesh.name),
        mesh
      )
    }
  )
}

function allMeshes() {
  return Object.values(meshes).map(
    (mesh) => mesh.getStatus()
  )
}

function getMesh(name) {
  var mesh = meshes[name]
  if (mesh) return mesh.getStatus()
  return null
}

function getMeshLog(name) {
  var mesh = meshes[name]
  return mesh ? mesh.getLog() : null
}

function setMesh(name, mesh) {
  db.setMesh(name, mesh)
  var old = meshes[name]
  if (old) {
    old.leave()
    delete meshes[name]
  }
  mesh = db.getMesh(name)
  meshes[name] = Mesh(
    os.path.join(rootDir, 'meshes', mesh.name),
    mesh
  )
  return getMesh(name)
}

function delMesh(name) {
  db.delMesh(name)
  var old = meshes[name]
  if (old) {
    old.leave()
    delete meshes[name]
  }
}

function allEndpoints(mesh) {
  var m = meshes[mesh]
  if (!m) return Promise.resolve([])
  var id = m.config.agent.id
  return m.discoverEndpoints().then(
    list => list.map(ep => ({ ...ep, isLocal: (ep.id === id) }))
  )
}

function getEndpoint(mesh, ep) {
  var m = meshes[mesh]
  if (!m) return Promise.resolve(null)
  return m.findEndpoint(ep).then(
    ep => ({ ...ep, isLocal: (ep.id === m.config.agent.id) })
  )
}

function getEndpointLog(mesh, ep) {
  var m = meshes[mesh]
  if (!m) return Promise.resolve(null)
  if (!ep || ep === m.config.agent.id) {
    return Promise.resolve(m.getLog())
  } else {
    return m.remoteQueryLog(ep)
  }
}

function allFiles(mesh) {
  var m = meshes[mesh]
  if (!m) return Promise.resolve(null)
  return m.discoverFiles()
}

function getFileInfo(mesh, pathname) {
  var m = meshes[mesh]
  if (!m) return Promise.resolve(null)
  return m.findFile(pathname)
}

function getFileData(mesh, pathname) {
  var m = meshes[mesh]
  if (!m) return Promise.resolve(null)
  return m.syncFile(pathname)
}

function getFileDataFromEP(mesh, ep, hash) {
  var m = meshes[mesh]
  if (!m) return Promise.resolve(null)
  return m.downloadFile(ep, hash)
}

function allApps(mesh, ep) {
  var m = meshes[mesh]
  if (!m) return Promise.resolve([])
  return m.discoverApps(ep)
}

function getApp(mesh, ep, provider, app) {
  var m = findMesh(mesh)
  if (!m) return Promise.resolve(null)
  return m.findApp(ep, provider, app)
}

function setApp(mesh, ep, provider, app, state) {
  var m = findMesh(mesh)
  if (!m) return Promise.resolve(null)
  return m.findApp(ep, provider, app).then(ret => {
    if (ret) return
    return m.installApp(ep, provider, app)
  }).then(() => {
    if (!('isRunning' in state)) return
    if (state.isRunning) {
      return m.startApp(ep, provider, app)
    } else {
      return m.stopApp(ep, provider, app)
    }
  }).then(() => {
    if (!('isPublished' in state)) return
    if (state.isPublished) {
      return m.publishApp(ep, provider, app)
    } else {
      return m.unpublishApp(ep, provider, app)
    }
  }).then(() => m.findApp(ep, provider, app))
}

function delApp(mesh, ep, provider, app) {
  var m = findMesh(mesh)
  if (!m) return Promise.resolve()
  return m.uninstallApp(ep, provider, app)
}

function getAppLog(mesh, ep, provider, app) {
  var m = findMesh(mesh)
  if (!m) return Promise.resolve()
  return m.dumpAppLog(ep, provider, app)
}

function connectApp(mesh, provider, app) {
  var m = findMesh(mesh)
  if (!m) return null
  return m.connectApp(provider, app)
}

function allServices(mesh, ep) {
  var m = findMesh(mesh)
  if (!m) return Promise.resolve([])
  if (ep) {
    if (ep === m.config.agent.id) {
      return Promise.resolve(db.allServices(mesh))
    } else {
      return m.remoteQueryServices(ep)
    }
  } else {
    return m.discoverServices(ep).then(
      function (list) {
        list.forEach(svc => {
          svc.isDiscovered = true
          svc.isLocal = false
        })
        if (!ep || ep === m.config.agent.id) {
          db.allServices().forEach(
            function (local) {
              var name = local.name
              var protocol = local.protocol
              var svc = list.find(s => s.name === name && s.protocol === protocol)
              if (svc) {
                svc.isLocal = true
                svc.host = local.host
                svc.port = local.port
              } else {
                list.push({
                  name,
                  protocol,
                  endpoints: [{
                    id: m.config.agent.id,
                    name: m.config.agent.name,
                  }],
                  isDiscovered: false,
                  isLocal: true,
                  host: local.host,
                  port: local.port,
                })
              }
            }
          )
        }
        var id = m.config.agent.id
        list.forEach(svc => (
          svc.endpoints.forEach(ep => {
            if (ep.id === id) ep.isLocal = true
          })
        ))
        return list
      }
    )
  }
}

function getService(mesh, ep, proto, name) {
  return allServices(mesh, ep).then(
    list => list.find(s => s.name === name && s.protocol === proto) || null
  )
}

function setService(mesh, ep, proto, name, service) {
  var m = findMesh(mesh)
  if (ep === m.config.agent.id) {
    db.setService(mesh, proto, name, service)
    var s = db.getService(mesh, proto, name)
    m.publishService(proto, name, s.host, s.port, s.users)
    return Promise.resolve(s)
  } else {
    return m.remotePublishService(ep, proto, name, service.host, service.port, service.users)
  }
}

function delService(mesh, ep, proto, name) {
  var m = findMesh(mesh)
  if (ep === m.config.agent.id) {
    m.deleteService(proto, name)
    db.delService(mesh, proto, name)
    return Promise.resolve()
  } else {
    return m.remoteDeleteService(ep, proto, name)
  }
}

function allPorts(mesh, ep) {
  var m = findMesh(mesh)
  if (!m) return Promise.resolve([])
  if (ep === m.config.agent.id) {
    return Promise.resolve(
      db.allPorts(mesh).map(
        p => Object.assign(p, m.checkPort(p.listen.ip, p.protocol, p.listen.port))
      )
    )
  } else {
    return m.remoteQueryPorts(ep)
  }
}

function getPort(mesh, ep, ip, proto, port) {
  return allPorts(mesh, ep).then(
    list => list.find(p => p.listen.port === port && p.listen.ip === ip && p.protocol === proto) || null
  )
}

function setPort(mesh, ep, ip, proto, port, target) {
  var m = findMesh(mesh)
  if (ep === m.config.agent.id) {
    m.openPort(ip, proto, port, target.service, target.endpoint)
    db.setPort(mesh, ip, proto, port, { target })
    return getPort(mesh, ep, ip, proto, port)
  } else {
    return m.remoteOpenPort(ep, ip, proto, port, target)
  }
}

function delPort(mesh, ep, ip, proto, port) {
  var m = findMesh(mesh)
  if (ep === m.config.agent.id) {
    m.closePort(ip, proto, port)
    db.delPort(mesh, ip, proto, port)
    return Promise.resolve()
  } else {
    return m.remoteClosePort(ep, ip, proto, port)
  }
}

export default {
  init,
  allMeshes,
  getMesh,
  getMeshLog,
  setMesh,
  delMesh,
  allEndpoints,
  getEndpoint,
  getEndpointLog,
  allFiles,
  getFileInfo,
  getFileData,
  getFileDataFromEP,
  allApps,
  getApp,
  setApp,
  delApp,
  getAppLog,
  connectApp,
  allServices,
  getService,
  setService,
  delService,
  allPorts,
  getPort,
  setPort,
  delPort,
}
