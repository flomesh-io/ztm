import db from './db.js'
import Mesh from './mesh.js'

var rootDir = ''
var agentListen = ''
var meshes = {}

function findMesh(name) {
  var m = meshes[name]
  if (m) return m
  throw `Mesh not found: ${name}`
}

function init(dirname, listen) {
  rootDir = os.path.resolve(dirname)
  agentListen = listen
  db.allMeshes().forEach(
    function (mesh) {
      var name = mesh.name
      meshes[name] = Mesh(
        os.path.join(rootDir, 'meshes', name),
        agentListen, mesh,
        function (newMesh) {
          db.setMesh(name, newMesh)
        }
      )
      if (!mesh.agent?.offline) {
        meshes[name].start()
      }
    }
  )
}

function setIdentity(pem) {
  var key = new crypto.PrivateKey(pem)
  db.setKey('agent', key.toPEM().toString())
}

function getIdentity() {
  var keyData = db.getKey('agent')
  var key = keyData ? new crypto.PrivateKey(keyData) : new crypto.PrivateKey({ type: 'rsa', bits: 2048 })
  if (!keyData) db.setKey('agent', key.toPEM().toString())
  return new crypto.PublicKey(key).toPEM().toString()
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
  mesh.agent ??= {}
  mesh.agent.listen = agentListen
  meshes[name] = Mesh(
    os.path.join(rootDir, 'meshes', mesh.name),
    agentListen, mesh,
    function (newMesh) {
      db.setMesh(name, newMesh)
    }
  )
  if (!mesh.agent.offline) {
    meshes[name].start()
  }
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

function getPermit(mesh, username, identity) {
  var m = meshes[mesh]
  if (!m) return Promise.resolve(null)
  return m.issuePermit(username, identity)
}

function allEndpoints(mesh, id, name, user, keyword, offset, limit) {
  var m = meshes[mesh]
  if (!m) return Promise.resolve([])
  var idLocal = m.config.agent.id
  return m.discoverEndpoints(id, name, user, keyword, offset, limit).then(
    list => list.map(ep => ({ ...ep, isLocal: (ep.id === idLocal) }))
  )
}

function getEndpoint(mesh, ep) {
  var m = meshes[mesh]
  if (!m) return Promise.resolve(null)
  return m.findEndpoint(ep).then(
    ep => ({ ...ep, isLocal: (ep.id === m.config.agent.id) })
  )
}

function getEndpointLabels(mesh, ep) {
  var m = meshes[mesh]
  if (!m) return Promise.resolve(null)
  if (!ep || ep === m.config.agent.id) {
    return Promise.resolve(m.getLabels())
  } else {
    return m.remoteGetLabels(ep)
  }
}

function setEndpointLabels(mesh, ep, labels) {
  var m = meshes[mesh]
  if (!m) return Promise.resolve(null)
  if (!ep || ep === m.config.agent.id) {
    return Promise.resolve(m.setLabels(labels))
  } else {
    return m.remoteSetLabels(ep, labels)
  }
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

function allUsers(mesh, name, keyword, offset, limit) {
  var m = meshes[mesh]
  if (!m) return Promise.resolve([])
  return m.discoverUsers(name, keyword, offset, limit).then(
    results => {
      var idLocal = m.config.agent.id
      results.forEach(user => {
        user.endpoints?.instances?.forEach?.(
          ep => {
            if (ep.id === idLocal) ep.isLocal = true
          }
        )
      })
      return results
    }
  )
}

function delUser(mesh, name) {
  var m = meshes[mesh]
  if (!m) return Promise.resolve([])
  return m.evictUser(name)
}

function allFiles(mesh, since) {
  var m = meshes[mesh]
  if (!m) return Promise.resolve(null)
  return m.discoverFiles(since)
}

function getFileInfo(mesh, pathname) {
  var m = meshes[mesh]
  if (!m) return Promise.resolve(null)
  return m.findFile(pathname)
}

function delFileInfo(mesh, pathname) {
  var m = meshes[mesh]
  if (!m) return Promise.resolve(false)
  return Promise.resolve(m.deleteFile(pathname))
}

function getFileData(mesh, pathname) {
  var m = meshes[mesh]
  if (!m) return Promise.resolve(null)
  return m.syncFile(pathname)
}

function setFileData(mesh, pathname, data) {
  var m = meshes[mesh]
  if (!m) return Promise.resolve(false)
  return Promise.resolve(m.publishFile(pathname, data))
}

function delFileData(mesh, pathname) {
  var m = meshes[mesh]
  if (!m) return Promise.resolve(false)
  return Promise.resolve(m.unpublishFile(pathname))
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
  return m.connectApp(provider, app, m.username)
}

function getEndpointStats(mesh, ep) {
  var m = findMesh(mesh)
  if (!m) return null
  return m.getEndpointStats(ep)
}

export default {
  init,
  setIdentity,
  getIdentity,
  allMeshes,
  getMesh,
  getMeshLog,
  setMesh,
  delMesh,
  getPermit,
  allEndpoints,
  getEndpoint,
  getEndpointLabels,
  setEndpointLabels,
  getEndpointLog,
  allUsers,
  delUser,
  allFiles,
  getFileInfo,
  delFileInfo,
  getFileData,
  setFileData,
  delFileData,
  getFileDataFromEP,
  allApps,
  getApp,
  setApp,
  delApp,
  getAppLog,
  connectApp,
  getEndpointStats,
}
