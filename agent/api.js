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
      mesh.agent ??= {}
      mesh.agent.listen = agentListen
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
  mesh.agent ??= {}
  mesh.agent.listen = agentListen
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

function getPermit(mesh, username) {
  var m = meshes[mesh]
  if (!m) return Promise.resolve(null)
  return m.issuePermit(username)
}

function delPermit(mesh, username) {
  var m = meshes[mesh]
  if (!m) return Promise.resolve(false)
  return m.revokePermit(username)
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

export default {
  init,
  allMeshes,
  getMesh,
  getMeshLog,
  setMesh,
  delMesh,
  getPermit,
  delPermit,
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
}
