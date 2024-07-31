import db from './db.js'
import initFilesystem from './fs.js'
import initApps from './apps.js'

export default function (rootDir, config) {
  var meshName = config.name
  var username
  var caCert
  var agentCert
  var agentKey
  var agentLog = []
  var meshErrors = []
  var fs = null
  var apps = null
  var exited = false

  var epEnv = {
    id: config.agent.id,
    name: config.agent.name,
  }

  var meshEnv = {
    name: meshName,
    url: `http://${config.agent.listen}/api/meshes/${meshName}`,
    discover: discoverFromApp,
    connect: connectFromApp,
    fs: makeAppFilesystem,
  }

  if (config.ca) {
    try {
      caCert = new crypto.Certificate(config.ca)
    } catch {
      meshError('Invalid CA certificate')
    }
  } else {
    meshError('Missing CA certificate')
  }

  if (config.agent.certificate) {
    try {
      agentCert = new crypto.Certificate(config.agent.certificate)
      username = agentCert.subject?.commonName
    } catch {
      meshError('Invalid agent certificate')
    }
  } else {
    meshError('Missing agent certificate')
  }

  var key = (username === 'root' ? config.agent.privateKey : db.getKey('agent'))
  if (key) {
    try {
      agentKey = new crypto.PrivateKey(key)
    } catch {
      meshError('Invalid agent private key')
    }
  } else {
    meshError('Missing agent private key')
  }

  try {
    fs = initFilesystem(os.path.join(rootDir, 'fs'))
    apps = initApps(
      os.path.join(rootDir, 'apps'),
      `mount-mesh-${meshName}`,
      epEnv, meshEnv,
    )
  } catch (e) {
    meshError(e.toString())
  }

  var tlsOptions = {
    certificate: agentCert && agentKey ? {
      cert: agentCert,
      key: agentKey,
    } : null,
    trusted: caCert ? [caCert] : null,
  }

  var hubAddresses = config.bootstraps.map(
    function (addr) {
      if (addr.startsWith('localhost:')) addr = '127.0.0.1:' + addr.substring(10)
      return addr
    }
  )

  //
  // Class Hub
  // Management of the interaction with a single hub instance
  //

  function Hub(address) {
    var connections = new Set
    var closed = false

    //
    //    requestHub ---\
    //                   \-->
    //                        hubSession <---> Hub
    //                   /---
    // reverseServer <--/
    //

    var $response

    // Long-lived agent-to-hub connection, multiplexed with HTTP/2
    var hubSession = pipeline($=>$
      .muxHTTP(() => '', { version: 2 }).to($=>$
        .connectTLS({
          ...tlsOptions,
          onState: (session) => {
            var err = session.error
            if (err) meshError(err)
          }
        }).to($=>$
          .onStart(() => { meshErrors.length = 0 })
          .connect(address, {
            onState: function (conn) {
              if (conn.state === 'connected') {
                logInfo(`Connected to hub ${address}`)
                meshErrors.length = 0
                connections.add(conn)
                advertiseFilesystem(filesystemLatest)
                advertiseAppStates(appStateLatest)
              } else if (conn.state === 'closed') {
                logInfo(`Connection to hub ${address} closed`)
                connections.delete(conn)
              }
            }
          })
          .handleStreamEnd(
            (eos) => meshError(`Connection to hub ${address} closed, error = ${eos.error}`)
          )
        )
      )
    )

    // Send a request to the hub
    var requestHub = pipeline($=>$
      .onStart(msg => msg)
      .pipe(hubSession)
      .handleMessage(msg => $response = msg)
      .replaceMessage(new StreamEnd)
      .onEnd(() => $response)
    )

    // Hook up to the hub and receive orders
    var reverseServer = pipeline($=>$
      .onStart(new Data)
      .repeat(() => new Timeout(5).wait().then(() => !closed)).to($=>$
        .loop($=>$
          .connectHTTPTunnel(
            new Message({
              method: 'CONNECT',
              path: `/api/endpoints/${config.agent.id}`,
            })
          )
          .to(hubSession)
          .pipe(serveHub)
        )
      )
    )

    // Establish a pull session to the hub
    reverseServer.spawn()

    // Start advertising filesystem
    var filesystemLatest = null
    var filesystemUpdate = null
    var filesystemSending = null
    sendFilesystemUpdate()

    function sendFilesystemUpdate() {
      if (closed) return
      new Timeout(1).wait().then(() => {
        if (filesystemUpdate) {
          filesystemSending = filesystemUpdate
          filesystemUpdate = null
        }
        if (filesystemSending) {
          var size = Object.keys(filesystemSending).length
          logInfo(`Sending filesystem to ${address} (size = ${size})...`)
          requestHub.spawn(
            new Message(
              {
                method: 'POST',
                path: '/api/filesystem',
              },
              JSON.encode(filesystemSending)
            )
          ).then(res => {
            if (res && res.head.status === 201) {
              logInfo(`Sent filesystem to ${address} (size = ${size})`)
              filesystemSending = null
            } else {
              logError(`Unable to send filesystem to ${address} (status = ${res?.head?.status})`)
            }
            sendFilesystemUpdate()
          })
        } else {
          sendFilesystemUpdate()
        }
      })
    }

    // Start advertising app states
    var appStateLatest = null
    var appStateUpdate = null
    var appStateSending = null
    sendAppStateUpdate()

    function sendAppStateUpdate() {
      if (closed) return
      new Timeout(1).wait().then(() => {
        if (appStateUpdate) {
          appStateSending = appStateUpdate
          appStateUpdate = null
        }
        if (appStateSending) {
          var size = appStateSending.length
          logInfo(`Sending app states to ${address} (size = ${size})...`)
          requestHub.spawn(
            new Message(
              {
                method: 'POST',
                path: '/api/apps',
              },
              JSON.encode(appStateSending)
            )
          ).then(res => {
            if (res && res.head.status === 201) {
              logInfo(`Sent app states to ${address} (size = ${size})`)
              appStateSending = null
            } else {
              logError(`Unable to send app states to ${address} (status = ${res?.head?.status})`)
            }
            sendAppStateUpdate()
          })
        } else {
          sendAppStateUpdate()
        }
      })
    }

    function heartbeat() {
      if (closed) return
      requestHub.spawn(
        new Message(
          { method: 'POST', path: '/api/status' },
          JSON.encode({ name: config.agent.name })
        )
      )
    }

    function advertiseFilesystem(files) {
      filesystemLatest = files
      filesystemUpdate = files
    }

    function advertiseAppStates(apps) {
      appStateLatest = apps
      appStateUpdate = apps
    }

    function discoverEndpoints() {
      return requestHub.spawn(
        new Message({ method: 'GET', path: '/api/endpoints' })
      ).then(
        function (res) {
          if (res && res.head.status === 200) {
            return JSON.decode(res.body)
          } else {
            return []
          }
        }
      )
    }

    function discoverFiles() {
      return requestHub.spawn(
        new Message({ method: 'GET', path: '/api/filesystem' })
      ).then(
        function (res) {
          if (res && res.head.status === 200) {
            return Object.fromEntries(
              Object.entries(JSON.decode(res.body)).map(
                ([k, v]) => [
                  k, {
                    size: v['$'],
                    time: v['T'],
                    hash: v['#'],
                  }
                ]
              )
            )
          } else {
            return {}
          }
        }
      )
    }

    function issuePermit(username, identity) {
      return requestHub.spawn(
        new Message({ method: 'POST', path: `/api/sign/${username}`}, identity)
      ).then(
        function (res) {
          if (res && res.head.status === 201) {
            return {
              ca: config.ca,
              agent: {
                certificate: res.body.toString(),
              },
              bootstraps: [...config.bootstraps],
            }
          } else {
            return null
          }
        }
      )
    }

    function revokePermit(username) {
      return Promise.resolve(true)
    }

    function findEndpoint(ep) {
      return requestHub.spawn(
        new Message({ method: 'GET', path: `/api/endpoints/${ep}`})
      ).then(
        function (res) {
          if (res && res.head.status === 200) {
            return JSON.decode(res.body)
          } else {
            return null
          }
        }
      )
    }

    function findFile(pathname) {
      return requestHub.spawn(
        new Message({ method: 'GET', path: os.path.join('/api/filesystem', pathname) })
      ).then(
        function (res) {
          if (res && res.head.status === 200) {
            var meta = JSON.decode(res.body)
            return {
              size: meta['$'],
              time: meta['T'],
              hash: meta['#'],
              sources: meta['@'],
            }
          } else {
            return null
          }
        }
      )
    }

    function findApp(provider, app) {
      return requestHub.spawn(
        new Message({
          method: 'GET',
          path: provider ? `/api/apps/${provider}/${app}` : `/api/apps/${app}`
        })
      ).then(
        function (res) {
          if (res && res.head.status === 200) {
            return JSON.decode(res.body)
          } else {
            return null
          }
        }
      )
    }

    function leave() {
      closed = true
      connections.forEach(
        conn => conn.close()
      )
    }

    return {
      isConnected: () => connections.size > 0,
      address,
      heartbeat,
      advertiseFilesystem,
      advertiseAppStates,
      discoverEndpoints,
      discoverFiles,
      issuePermit,
      revokePermit,
      findEndpoint,
      findFile,
      findApp,
      leave,
    }

  } // End of class Hub

  var matchServices = new http.Match('/api/services/{proto}/{svc}')
  var matchApp = new http.Match('/api/apps/{app}')
  var matchProviderApp = new http.Match('/api/apps/{provider}/{app}')
  var response200 = new Message({ status: 200 })
  var response404 = new Message({ status: 404 })

  var $requestedApp
  var $requestedAppPipeline
  var $requestedAppPeer
  var $selectedEp
  var $selectedHub

  //
  // Agent serving requests from the hubs
  //
  //   Hub ----\
  //   Hub -----)----> Agent
  //   Hub ----/
  //

  var serveHub = pipeline($=>$
    .demuxHTTP().to($=>$
      .pipe(
        function (evt) {
          if (evt instanceof MessageStart) {
            if (evt.head.method === 'CONNECT') {
              var path = evt.head.path
              if (matchProviderApp(path) || matchApp(path)) {
                return toLocalApp
              } else if (matchServices(path)) {
                return proxyToLocal
              }
            }
            return serveOtherAgents
          }
        }
      )
    )
  )

  //
  // Agent handling hub-forwarded requests from other agents
  //
  //   Remote Agent ----> Hub ----\
  //   Remote Agent ----> Hub -----)----> Agent
  //   Remote Agent ----> Hub ----/
  //

  var serveOtherAgents = (function() {
    var routes = Object.entries({

      '/api/ping': {
        'GET': () => response(200)
      },

      '/api/log': {
        'GET': function () {
          return response(200, getLog())
        }
      },

      '/api/file-data/{hash}': {
        'GET': function ({ hash }) {
          var data = fs.raw(hash)
          return data ? response(200, data) : response(404)
        },
      },

      '/api/apps': {
        'GET': function () {
          return discoverApps(config.agent.id).then(
            ret => response(200, ret)
          )
        }
      },

      '/api/apps/{provider}/{app}': {
        'GET': function ({ provider, app }) {
          return findApp(config.agent.id, provider, app).then(
            ret => ret ? response(200, ret) : response(404)
          )
        },

        'POST': function ({ provider, app }, req) {
          var ep = config.agent.id
          var state = JSON.decode(req.body)
          return findApp(ep, provider, app).then(ret => {
            if (!ret) return installApp(ep, provider, app)
          }).then(() => {
            if ('isRunning' in state) {
              if (state.isRunning) {
                return startApp(ep, provider, app).then(response(201))
              } else {
                return stopApp(ep, provider, app).then(response(201))
              }
            }
            return response(201)
          }).then(() => {
            if ('isPublished' in state) {
              if (state.isPublished) {
                return publishApp(ep, provider, app)
              } else {
                return unpublishApp(ep, provider, app)
              }
            }
          }).then(response(201))
        },

        'DELETE': function ({ provider, app }) {
          return uninstallApp(config.agent.id, provider, app).then(response(204))
        },
      },

      '/api/apps/{provider}/{app}/log': {
        'GET': function ({ provider, app }) {
          return dumpAppLog(config.agent.id, provider, app).then(
            ret => ret ? response(200, ret) : response(404)
          )
        },
      },

    }).map(
      function ([path, methods]) {
        var match = new http.Match(path)
        var handler = function (params, req) {
          var f = methods[req.head.method]
          if (f) return f(params, req)
          return response(405)
        }
        return { match, handler }
      }
    )

    return pipeline($=>$
      .replaceMessage(
        function (req) {
          var params
          var path = req.head.path
          var route = routes.find(r => Boolean(params = r.match(path)))
          if (route) {
            try {
              var res = route.handler(params, req)
              return res instanceof Promise ? res.catch(responseError) : res
            } catch (e) {
              return responseError(e)
            }
          }
          return response(404)
        }
      )
    )
  })()

  //
  // Agent proxying to local apps: mesh -> local
  //
  //   Remote App ----> Remote Agent ----> Hub ----\                  /----> Local App
  //   Remote App ----> Remote Agent ----> Hub -----)----> Agent ----(-----> Local App
  //   Remote App ----> Remote Agent ----> Hub ----/                  \----> Local App
  //

  var toLocalApp = pipeline($=>$
    .acceptHTTPTunnel(
      function (req) {
        var path = req.head.path
        var params = matchApp(path) || matchProviderApp(path)
        if (params) {
          var q = new URL(path).searchParams.toObject()
          var username = URL.decodeComponent(q.username)
          $requestedApp = params.app
          $requestedAppPeer = {
            id: q.src,
            ip: q.ip,
            port: q.port,
            username,
          }
          return connectApp(params.provider, $requestedApp).then(p => {
            if (p) {
              logInfo(`Proxy to local app ${$requestedApp}`)
              $requestedAppPipeline = p
              return response200
            }
            logError(`Local app ${$requestedApp} not found`)
            return response404
          })
        }
        return response404
      }
    ).to($=>$
      .pipe(() => $requestedAppPipeline, () => ({ source: 'peer', peer: $requestedAppPeer }))
      .onEnd(() => logInfo(`Proxy to local app ${$requestedApp} ended`))
    )
  )

  //
  // Agent proxying to remote apps: local -> mesh
  //
  //   Local App ----\                  /----> Hub ----> Remote Agent ----> Remote App
  //   Local App -----)----> Agent ----(-----> Hub ----> Remote Agent ----> Remote App
  //   Local App ----/                  \----> Hub ----> Remote Agent ----> Remote App
  //

  var toRemoteApp = (ep, provider, app, connectOptions) => pipeline($=>$
    .onStart(() => {
      $selectedEp = ep
      return selectHub(ep).then(hub => {
        $selectedHub = hub
        return new Data
      })
    })
    .pipe(() => $selectedHub ? 'proxy' : 'deny', {
      'proxy': ($=>$
        .onStart(() => logInfo(`Proxy to ${app} at endpoint ${ep} via ${$selectedHub}`))
        .connectHTTPTunnel(() => {
          var q = `?src=${config.agent.id}`
          return new Message({
            method: 'CONNECT',
            path: provider ? `/api/endpoints/${ep}/apps/${provider}/${app}${q}` : `/api/endpoints/${ep}/apps/${app}${q}`,
          })
        }).to($=>$
          .muxHTTP(() => $selectedHub, {
            version: 2,
            ping: () => new Timeout(10).wait().then(new Data),
          }).to($=>$
            .connectTLS(tlsOptions).to($=>$
              .connect(() => $selectedHub, connectOptions)
            )
          )
        )
        .onEnd(() => logInfo(`Proxy to ${app} at endpoint ${ep} via ${$selectedHub} ended`))
      ),
      'deny': ($=>$
        .onStart(() => logError(`No route to endpoint ${ep}`))
        .replaceData(new StreamEnd)
      ),
    })
  )

  // HTTP agents for ad-hoc agent-to-hub sessions
  var httpAgents = new algo.Cache(
    target => new http.Agent(target, { tls: tlsOptions })
  )

  // Connect to all hubs
  var hubs = config.bootstraps.map(
    addr => Hub(addr)
  )

  // Start sending heartbeats
  heartbeat()
  function heartbeat() {
    if (!exited) {
      hubs.forEach(h => h.heartbeat())
      new Timeout(15).wait().then(heartbeat)
    }
  }

  // Advertise the filesystem & app states
  advertiseFilesystem()
  advertiseAppStates()

  // Start apps
  db.allApps(meshName).forEach(app => {
    if (app.state === 'running' && app.username === username) {
      var appname = app.name
      if (app.tag) appname += '@' + app.tag
      startApp(config.agent.id, app.provider, appname)
    }
  })

  logInfo(`Joined ${meshName} as ${config.agent.name} (uuid = ${config.agent.id})`)

  function selectHub(ep) {
    return hubs[0].findEndpoint(ep).then(
      function (endpoint) {
        if (!endpoint) return null
        var addresses = endpoint.hubs || []
        return addresses.find(addr => hubAddresses.indexOf(addr) >= 0) || hubs[0].address
      }
    )
  }

  function selectHubWithThrow(ep) {
    return selectHub(ep).then(hub => {
      if (!hub) throw `No hub for endpoint ${ep}`
      return hub
    })
  }

  function advertiseFilesystem() {
    var files = {}
    fs.list().forEach(filename => {
      var stat = fs.stat(filename)
      if (stat) {
        files[filename] = {
          'T': stat.time,
          '#': stat.hash,
          '$': stat.size,
        }
      }
    })
    hubs[0].advertiseFilesystem(files)
  }

  function advertiseAppStates() {
    var list = []
    ;[...apps.listBuiltin(), ...apps.listDownloaded()].forEach(app => {
      if (!list.some(a => a.provider === app.provider && a.name === app.name)) {
        list.push(app)
      }
    })
    hubs[0].advertiseAppStates(list)
  }

  function issuePermit(username, identity) {
    return hubs[0].issuePermit(username, identity)
  }

  function revokePermit(username) {
    return hubs[0].revokePermit(username)
  }

  function findEndpoint(ep) {
    return hubs[0].findEndpoint(ep)
  }

  function findFile(pathname) {
    return hubs[0].findFile(pathname)
  }

  function findApp(ep, provider, app) {
    if (ep === config.agent.id) {
      var isBuiltin = apps.isBuiltin(provider, app)
      var isDownloaded = apps.isDownloaded(provider, app)
      var isPublished = Boolean(fs.stat(`/home/${provider}/pub/apps/pkg/${app}`))
      if (isPublished || isDownloaded || isBuiltin) {
        return Promise.resolve({
          ...getAppNameTag(app),
          provider,
          isBuiltin: isBuiltin && !isDownloaded,
          isDownloaded,
          isPublished,
          isRunning: apps.isRunning(provider, app),
        })
      } else {
        return Promise.resolve(null)
      }
    } else {
      return selectHubWithThrow(ep).then(
        (hub) => httpAgents.get(hub).request(
          'GET', `/api/forward/${ep}/apps/${provider}/${app}`
        ).then(
          res => {
            return res.head?.status === 200 ? JSON.decode(res.body) : null
          }
        )
      )
    }
  }

  function discoverEndpoints() {
    return hubs[0].discoverEndpoints()
  }

  function discoverFiles() {
    return hubs[0].discoverFiles()
  }

  function discoverApps(ep) {
    if (ep === config.agent.id) {
      var list = []
      apps.listDownloaded().forEach(app => {
        list.push({
          ...getAppNameTag(app.name),
          provider: app.provider,
          isBuiltin: false,
          isDownloaded: true,
          isPublished: false,
          isRunning: apps.isRunning(app.provider, app.name),
        })
      })
      var match = new http.Match('/home/{provider}/pub/apps/pkg/{name}')
      fs.list('/home/').forEach(pathname => {
        var app = match(pathname)
        if (!app) return
        var provider = app.provider
        var appname = app.name
        var tagname = getAppNameTag(appname)
        var name = tagname.name
        var tag = tagname.tag
        var obj = list.find(a => a.name === name && a.tag === tag && a.provider === provider)
        if (obj) {
          obj.isPublished = true
        } else {
          list.push({
            name,
            tag,
            provider,
            isBuiltin: false,
            isDownloaded: false,
            isPublished: true,
            isRunning: apps.isRunning(provider, app),
          })
        }
      })
      return discoverApps().then(pubs => {
        pubs.forEach(app => {
          var name = app.name
          var tag = app.tag
          var provider = app.provider
          var appname = name
          if (tag) appname += '@' + tag
          if (list.some(a => a.name === name && a.tag === tag && a.provider === provider)) return
          list.push({
            name,
            tag,
            provider,
            isBuiltin: false,
            isDownloaded: false,
            isPublished: false,
            isRunning: apps.isRunning(app.provider, appname),
          })
        })
        apps.listBuiltin().forEach(app => {
          var provider = app.provider
          var appname = app.name
          var tagname = getAppNameTag(appname)
          var name = tagname.name
          var tag = tagname.tag
          if (list.some(a => a.name === name && a.tag === tag && a.provider === provider)) return
          list.push({
            name,
            tag,
            provider,
            isBuiltin: true,
            isDownloaded: false,
            isPublished: false,
            isRunning: apps.isRunning(provider, appname),
          })
        })
        return list
      })
    } else if (ep) {
      return selectHubWithThrow(ep).then(
        (hub) => httpAgents.get(hub).request(
          'GET', `/api/forward/${ep}/apps`
        ).then(res => {
          if (res.head?.status === 200) {
            return JSON.decode(res.body)
          } else {
            return []
          }
        })
      )
    } else {
      return hubs[0].discoverFiles().then(files => {
        var apps = []
        Object.keys(files).forEach(pathname => {
          if (!pathname.startsWith('/home/')) return
          pathname = pathname.substring(6)
          var i = pathname.indexOf('/')
          if (i < 0) return
          var provider = pathname.substring(0, i)
          pathname = pathname.substring(i)
          if (!pathname.startsWith('/pub/apps/pkg/')) return
          var app = pathname.substring(14)
          if (app.indexOf('/') >= 0) return
          if (app.indexOf('@') == 0) return
          apps.push({ ...getAppNameTag(app), provider })
        })
        return apps
      })
    }
  }

  function publishApp(ep, provider, app) {
    if (ep === config.agent.id) {
      var packagePathname = `/home/${provider}/pub/apps/pkg/${app}`
      if (fs.stat(packagePathname)) return Promise.resolve()
      return apps.pack(provider, app).then(data => {
        fs.write(packagePathname, data)
        advertiseFilesystem()
      })
    } else {
      return selectHubWithThrow(ep).then(
        (hub) => httpAgents.get(hub).request(
          'POST', `/api/forward/${ep}/apps/${provider}/${app}`,
          {}, JSON.encode({ isPublished: true })
        )
      )
    }
  }

  function unpublishApp(ep, provider, app) {
    if (ep === config.agent.id) {
      var packagePathname = `/home/${provider}/pub/apps/pkg/${app}`
      if (fs.stat(packagePathname)) {
        fs.remove(packagePathname)
        advertiseFilesystem()
      }
      return Promise.resolve()
    } else {
      return selectHubWithThrow(ep).then(
        (hub) => httpAgents.get(hub).request(
          'POST', `/api/forward/${ep}/apps/${provider}/${app}`,
          {}, JSON.encode({ isPublished: false })
        )
      )
    }
  }

  function installApp(ep, provider, app) {
    logInfo(`App ${provider}/${app} installing to ${ep}...`)
    if (ep === config.agent.id) {
      return syncFile(`/home/${provider}/pub/apps/pkg/${app}`).then(data => {
        if (data) {
          apps.unpack(provider, app, data).then(() => {
            logInfo(`App ${provider}/${app} installed locally`)
          })
        } else {
          logError(`App ${provider}/${app} installation failed`)
        }
      })
    } else {
      return selectHubWithThrow(ep).then(
        (hub) => httpAgents.get(hub).request(
          'POST', `/api/forward/${ep}/apps/${provider}/${app}`,
          {}, JSON.encode({})
        ).then(
          res => {
            if (res.head?.status === 201) {
              logInfo(`App ${provider}/${app} installed remotely`)
            } else {
              logError(`App ${provider}/${app} remote installation failed, status = ${res.head?.status} ${res.head?.statusText}, body: ${res.body?.toString?.()}`)
            }
          }
        )
      )
    }
  }

  function uninstallApp(ep, provider, app) {
    logInfo(`App ${provider}/${app} uninstalling from ${ep}...`)
    if (ep === config.agent.id) {
      stopApp(ep, provider, app)
      apps.remove(provider, app)
      logInfo(`App ${provider}/${app} uninstalled locally`)
      return unpublishApp(ep, provider, app)
    } else {
      return selectHubWithThrow(ep).then(
        (hub) => httpAgents.get(hub).request(
          'DELETE', `/api/forward/${ep}/apps/${provider}/${app}`,
        ).then(
          res => {
            if (res.head?.status === 204) {
              logInfo(`App ${provider}/${app} uninstalled remotely`)
            } else {
              logError(`App ${provider}/${app} remote uninstallation failed, status = ${res.head?.status} ${res.head?.statusText}, body: ${res.body?.toString?.()}`)
            }
          }
        )
      )
    }
  }

  function startApp(ep, provider, app) {
    logInfo(`App ${provider}/${app} starting on ${ep}...`)
    if (ep === config.agent.id) {
      if (apps.isRunning(provider, app)) return Promise.resolve()
      return (apps.isBuiltin(provider, app) || apps.isDownloaded(provider, app)
        ? Promise.resolve()
        : installApp(ep, provider, app)
      ).then(() => {
        var nt = getAppNameTag(app)
        db.setApp(meshName, provider, nt.name, nt.tag, { state: 'stopped' })
        try {
          apps.start(provider, app, username)
          return new Timeout(1).wait().then(() => {
            db.setApp(meshName, provider, nt.name, nt.tag, { username, state: 'running' })
            advertiseAppStates()
            logInfo(`App ${provider}/${app} started locally`)
          })
        } catch (e) {
          db.setApp(meshName, provider, nt.name, nt.tag, { state: 'failed' })
          var msg = e?.message || e?.toString?.() || 'undefined'
          if (e?.stack) msg += ', stack: ' + e.stack.toString()
          logError(`App ${provider}/${app} failed to start due to exception: ${msg}`)
          return Promise.reject(e)
        }
      })
    } else {
      return selectHubWithThrow(ep).then(
        (hub) => httpAgents.get(hub).request(
          'POST', `/api/forward/${ep}/apps/${provider}/${app}`,
          {}, JSON.encode({ isRunning: true })
        ).then(
          res => {
            if (res.head?.status === 201) {
              logInfo(`App ${provider}/${app} started remotely`)
            } else {
              logError(`App ${provider}/${app} remote startup failed, status = ${res.head?.status} ${res.head?.statusText}, body: ${res.body?.toString?.()}`)
            }
          }
        )
      )
    }
  }

  function stopApp(ep, provider, app) {
    logInfo(`App ${provider}/${app} exiting on ${ep}...`)
    if (ep === config.agent.id) {
      var nt = getAppNameTag(app)
      db.setApp(meshName, provider, nt.name, nt.tag, { state: 'stopped' })
      apps.stop(provider, app)
      advertiseAppStates()
      logInfo(`App ${provider}/${app} exited locally`)
      return Promise.resolve()
    } else {
      return selectHubWithThrow(ep).then(
        (hub) => httpAgents.get(hub).request(
          'POST', `/api/forward/${ep}/apps/${provider}/${app}`,
          {}, JSON.encode({ isRunning: false })
        ).then(
          res => {
            if (res.head?.status === 201) {
              logInfo(`App ${provider}/${app} exited remotely`)
            } else {
              logError(`App ${provider}/${app} remote exiting failed, status = ${res.head?.status} ${res.head?.statusText}, body: ${res.body?.toString?.()}`)
            }
          }
        )
      )
    }
  }

  function dumpAppLog(ep, provider, app) {
    if (ep === config.agent.id) {
      return Promise.resolve(apps.log(provider, app))
    } else {
      return selectHubWithThrow(ep).then(
        (hub) => httpAgents.get(hub).request(
          'GET', `/api/forward/${ep}/apps/${provider}/${app}/log`
        ).then(res => {
          if (res.head?.status === 200) {
            return JSON.decode(res.body)
          } else {
            return null
          }
        })
      )
    }
  }

  function connectApp(provider, app) {
    if (!apps.isRunning(provider, app)) {
      return startApp(config.agent.id, provider, app).then(
        () => apps.connect(provider, app)
      )
    } else {
      return Promise.resolve(apps.connect(provider, app))
    }
  }

  function downloadFile(ep, hash) {
    return selectHubWithThrow(ep).then(
      (hub) => httpAgents.get(hub).request(
        'GET', `/api/endpoints/${ep}/file-data/${hash}`
      ).then(
        res => {
          remoteCheckResponse(res, 200)
          return res.body
        }
      )
    )
  }

  function publishFile(pathname, data) {
    if (fs.write(pathname, data)) {
      advertiseFilesystem()
      return true
    }
    return false
  }

  function unpublishFile(pathname) {
    if (fs.remove(pathname)) {
      advertiseFilesystem()
      return true
    }
    return false
  }

  function syncFile(pathname) {
    return findFile(pathname).then(meta => {
      if (!meta) return null
      pathname = os.path.normalize(pathname)

      var hash = meta.hash
      var st = fs.stat(pathname)
      if (st?.hash === hash) return fs.raw(hash)

      var sources = [...meta.sources]
      return pickOne()

      function pickOne() {
        if (sources.length === 0) return null
        var i = Math.floor(Math.random() * sources.length) % sources.length
        var ep = sources.splice(i, 1)[0]
        return downloadFile(ep, hash).then(data => {
          if (!data) {
            logError(`Download of file ${hash} from ep ${ep} is null`)
            return pickOne()
          }
          if (fs.hash(pathname, data) !== hash) {
            logError(`Download of file ${hash} from ep ${ep} is corrupted`)
            return pickOne()
          }
          fs.write(pathname, data)
          advertiseFilesystem()
          return data
        }).catch(ret => {
          logError(`Download of file ${hash} from ep ${ep} failed: ${JSON.stringify(ret)}`)
          return pickOne()
        })
      }
    })
  }

  //
  // Mesh API exposed to apps
  //

  function discoverFromApp(provider, app) {
    return function () {
      return discoverEndpoints()
    }
  }

  function connectFromApp(provider, app) {
    return function (ep, options) {
      var bind = options?.bind
      var onState = options?.onState
      var connectOptions = { bind, onState }
      return toRemoteApp(ep, provider, app, connectOptions)
    }
  }

  function makeAppFilesystem(provider, app) {
    var basepath = `/home/${provider}/apps/etc/${app}/`

    function dir(prefix) {
      prefix = os.path.normalize(prefix || '')
      if (!prefix.endsWith('/')) prefix += '/'
      return discoverFiles().then(
        files => Object.keys(files).filter(
          path => path.startsWith(basepath)
        ).map(
          path => path.substring(basepath.length - 1)
        ).filter(
          path => path.startsWith(prefix) && !path.startsWith('/local/')
        ).concat(
          db.allFiles(meshName, provider, app).filter(
            path => path.startsWith(prefix)
          ).map(
            path => '/local' + path
          )
        ).sort()
      )
    }

    function read(pathname) {
      var path = os.path.normalize(pathname)
      if (path.startsWith('/local/')) {
        return Promise.resolve(
          db.getFile(meshName, provider, app, path.substring(6))
        )
      } else {
        return syncFile(os.path.join(basepath, path))
      }
    }

    function write(pathname, data) {
      if (typeof data === 'string') data = new Data(data)
      var path = os.path.normalize(pathname)
      if (path.startsWith('/local/')) {
        db.setFile(meshName, provider, app, path.substring(6), data)
      } else {
        fs.write(os.path.join(basepath, path), data)
        advertiseFilesystem()
      }
    }

    return { dir, read, write }
  }

  function remoteQueryLog(ep) {
    return selectHubWithThrow(ep).then(
      (hub) => httpAgents.get(hub).request(
        'GET', `/api/forward/${ep}/log`
      ).then(
        res => {
          remoteCheckResponse(res, 200)
          return JSON.decode(res.body)
        }
      )
    )
  }

  function remoteCheckResponse(res, expected) {
    var status = res?.head?.status
    if (status !== expected) {
      throw { status: status || 500, message: res?.head?.statusText }
    }
  }

  function leave() {
    hubs.forEach(hub => hub.leave())
    exited = true
    logInfo(`Left ${meshName} as ${config.agent.name} (uuid = ${config.agent.id})`)
  }

  function isConnected() {
    return hubs.some(h => h.isConnected())
  }

  function getStatus() {
    return {
      name: meshName,
      ca: config.ca,
      agent: {
        id: config.agent.id,
        name: config.agent.name,
        username,
        certificate: config.agent.certificate,
      },
      bootstraps: [...config.bootstraps],
      connected: isConnected(),
      errors: getErrors(),
    }
  }

  function getLog() {
    return [...agentLog]
  }

  function getErrors() {
    return [...meshErrors]
  }

  function log(type, msg) {
    if (agentLog.length > 100) {
      agentLog.splice(0, agentLog.length - 100)
    }
    agentLog.push({
      time: new Date().toISOString(),
      type,
      message: msg,
    })
  }

  function logInfo(msg) {
    log('info', msg)
    console.info(msg)
  }

  function logError(msg) {
    log('error', msg)
    console.error(msg)
  }

  function meshError(msg) {
    logError(msg)
    meshErrors.push({
      time: new Date().toISOString(),
      message: msg,
    })
  }

  return {
    config,
    username,
    isConnected,
    getStatus,
    getLog,
    getErrors,
    issuePermit,
    revokePermit,
    findEndpoint,
    findFile,
    findApp,
    discoverEndpoints,
    discoverFiles,
    discoverApps,
    publishApp,
    unpublishApp,
    installApp,
    uninstallApp,
    startApp,
    stopApp,
    dumpAppLog,
    connectApp,
    downloadFile,
    publishFile,
    unpublishFile,
    syncFile,
    remoteQueryLog,
    leave,
  }
}

function getAppNameTag(app) {
  var i = app.indexOf('@')
  if (i < 0) {
    return { name: app, tag: '' }
  } else {
    return {
      name: app.substring(0, i),
      tag: app.substring(i + 1),
    }
  }
}

function response(status, body) {
  if (!body) return new Message({ status })
  if (typeof body === 'string') return responseCT(status, 'text/plain', body)
  if (body instanceof Data) return responseCT(status, 'application/octet-stream', body)
  return responseCT(status, 'application/json', JSON.encode(body))
}

function responseCT(status, ct, body) {
  return new Message(
    {
      status,
      headers: { 'content-type': ct }
    },
    body
  )
}

function responseError(e) {
  if (typeof e === 'object') {
    return response(e.status || 500, e)
  } else {
    return response(500, { status: 500, message: e })
  }
}
