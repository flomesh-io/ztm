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
  var services = []
  var ports = {}
  var exited = false

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

  if (config.agent.privateKey) {
    try {
      agentKey = new crypto.PrivateKey(config.agent.privateKey)
    } catch {
      meshError('Invalid agent private key')
    }
  } else {
    meshError('Missing agent private key')
  }

  try {
    fs = initFilesystem(os.path.join(rootDir, 'fs'))
    apps = initApps(os.path.join(rootDir, 'apps'), `mount-mesh-${meshName}`)
  } catch (e) {
    meshError(e.toString())
  }

  db.allApps(meshName).forEach(app => {
    if (app.state === 'running' && app.username === username) {
      var appname = app.name
      if (app.tag) appname += '@' + app.tag
      startApp(config.agent.id, app.provider, appname)
    }
  })

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
  // Utility pipelies
  //

  var bypass = pipeline($=>$)

  var wrapUDP = pipeline($=>$
    .replaceData(data => data.size > 0 ? new Message(data) : undefined)
    .encodeWebSocket()
  )

  var unwrapUDP = pipeline($=>$
    .decodeWebSocket()
    .replaceMessage(msg => msg.body)
  )

  //
  // Class Hub
  // Management of the interaction with a single hub instance
  //

  function Hub(address) {
    var connections = new Set
    var closed = false
    var serviceList = null
    var serviceListUpdateTime = 0
    var serviceListSendTime = 0

    //
    //    requestHub ---\
    //                   \-->
    //                        hubSession <---> Hub
    //                   /---
    // reverseServer <--/
    //

    var $response
    var $serviceListTime

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
                if (serviceList) updateServiceList(serviceList)
              } else if (conn.state === 'closed') {
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

    // Start sending service list updates
    pipeline($=>$
      .onStart(new Data)
      .repeat(() => new Timeout(1).wait().then(() => !closed)).to($=>$
        .forkJoin().to($=>$
          .pipe(
            () => {
              if (serviceListUpdateTime > serviceListSendTime) {
                $serviceListTime = serviceListUpdateTime
                return 'send'
              }
              return 'wait'
            }, {
              'wait': ($=>$.replaceStreamStart(new StreamEnd)),
              'send': ($=>$.replaceStreamStart(
                () => requestHub.spawn(
                  new Message(
                    {
                      method: 'POST',
                      path: `/api/services`,
                    },
                    JSON.encode({
                      time: $serviceListTime,
                      services: serviceList || [],
                    })
                  )
                ).then(
                  function (res) {
                    if (res && res.head.status === 201) {
                      if (serviceListSendTime < $serviceListTime) {
                        serviceListSendTime = $serviceListTime
                      }
                    }
                    return new StreamEnd
                  }
                )
              )),
            }
          )
        )
        .replaceStreamStart(new StreamEnd)
      )
    ).spawn()

    function updateServiceList(list) {
      serviceList = list
      serviceListUpdateTime = Date.now()
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
            return []
          }
        }
      )
    }

    function discoverServices(ep) {
      return requestHub.spawn(
        new Message({ method: 'GET', path: ep ? `/api/endpoints/${ep}/services` : '/api/services' })
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

    function findService(proto, svc) {
      return requestHub.spawn(
        new Message({ method: 'GET', path: `/api/services/${proto}/${svc}`})
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
      updateServiceList,
      discoverEndpoints,
      discoverFiles,
      discoverServices,
      findEndpoint,
      findFile,
      findService,
      leave,
    }

  } // End of class Hub

  var matchServices = new http.Match('/api/services/{proto}/{svc}')
  var response200 = new Message({ status: 200 })
  var response404 = new Message({ status: 404 })

  var $requestedService
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
              var params = matchServices(evt.head.path)
              if (params) return proxyToLocal
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

      '/api/services': {
        'GET': function () {
          return response(200, db.allServices(meshName))
        },
      },

      '/api/services/{proto}/{svc}': {
        'GET': function () {
          return response(200, db.getService(meshName, params.proto, params.svc))
        },

        'POST': function (params, req) {
          db.setService(meshName, params.proto, params.svc, JSON.decode(req.body))
          var s = db.getService(meshName, params.proto, params.svc)
          publishService(params.proto, params.svc, s.host, s.port, s.users)
          return response(201, s)
        },

        'DELETE': function (params) {
          deleteService(params.proto, params.svc)
          db.delService(meshName, params.proto, params.svc)
          return response(204)
        },
      },

      '/api/ports': {
        'GET': function () {
          return response(200, db.allPorts(meshName).map(
            p => Object.assign(p, checkPort(p.listen.ip, p.protocol, p.listen.port))
          ))
        },
      },

      '/api/ports/{ip}/{proto}/{port}': {
        'GET': function (params) {
          var ip = params.ip
          var proto = params.proto
          var port = Number.parseInt(params.port)
          return response(200, Object.assign(
            db.getPort(meshName, ip, proto, port),
            checkPort(ip, proto, port),
          ))
        },

        'POST': function (params, req) {
          var port = Number.parseInt(params.port)
          var body = JSON.decode(req.body)
          var target = body.target
          openPort(params.ip, params.proto, port, target.service, target.endpoint)
          db.setPort(meshName, params.ip, params.proto, port, body)
          return response(201, db.getPort(meshName, params.ip, params.proto, port))
        },

        'DELETE': function (params) {
          var port = Number.parseInt(params.port)
          closePort(params.ip, params.proto, port)
          db.delPort(meshName, params.ip, params.proto, port)
          return response(204)
        },
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
  // Agent proxying to local services: mesh -> local
  //
  //   Remote Client ----> Remote Agent ----> Hub ----\                  /----> Local Service
  //   Remote Client ----> Remote Agent ----> Hub -----)----> Agent ----(-----> Local Service
  //   Remote Client ----> Remote Agent ----> Hub ----/                  \----> Local Service
  //

  var proxyToLocal = pipeline($=>$
    .acceptHTTPTunnel(
      function (req) {
        var params = matchServices(req.head.path)
        if (params) {
          var protocol = params.proto
          var name = params.svc
          $requestedService = services.find(s => s.protocol === protocol && s.name === name)
          if ($requestedService) {
            logInfo(`Proxy to local service ${name}`)
            return response200
          }
          logError(`Local service ${name} not found`)
        }
        return response404
      }
    ).to($=>$
      .pipe(() => $requestedService.protocol, {
        'tcp': ($=>$.connect(() => `${$requestedService.host}:${$requestedService.port}`)),
        'udp': ($=>$
          .pipe(unwrapUDP)
          .connect(() => `${$requestedService.host}:${$requestedService.port}`, { protocol: 'udp' })
          .pipe(wrapUDP)
        )
      })
      .onEnd(() => logInfo(`Proxy to local service ${$requestedService.name} ended`))
    )
  )

  //
  // Agent proxying to remote services: local -> mesh
  //
  //   Local Client ----\                  /----> Hub ----> Remote Agent ----> Remote Service
  //   Local Client -----)----> Agent ----(-----> Hub ----> Remote Agent ----> Remote Service
  //   Local Client ----/                  \----> Hub ----> Remote Agent ----> Remote Service
  //

  var proxyToMesh = (proto, svc, ep) => pipeline($=>$
    .onStart(() => {
      if (ep) {
        $selectedEp = ep
        return selectHub(ep).then(hub => {
          $selectedHub = hub
          return new Data
        })
      } else {
        return selectEndpoint(proto, svc).then(ep => {
          if (!ep) return new Data
          $selectedEp = ep
          return selectHub(ep).then(hub => {
            $selectedHub = hub
            return new Data
          })
        })
      }
    })
    .pipe(() => $selectedHub ? 'proxy' : 'deny', {
      'proxy': ($=>$
        .onStart(() => logInfo(`Proxy to ${svc} at endpoint ${$selectedEp} via ${$selectedHub}`))
        .pipe(proto === 'udp' ? wrapUDP : bypass)
        .connectHTTPTunnel(() => (
          new Message({
            method: 'CONNECT',
            path: `/api/endpoints/${$selectedEp}/services/${proto}/${svc}`,
          })
        )).to($=>$
          .muxHTTP(() => $selectedHub, { version: 2 }).to($=>$
            .connectTLS(tlsOptions).to($=>$
              .connect(() => $selectedHub)
            )
          )
        )
        .pipe(proto === 'udp' ? unwrapUDP : bypass)
        .onEnd(() => logInfo(`Proxy to ${svc} at endpoint ${$selectedEp} via ${$selectedHub} ended`))
      ),
      'deny': ($=>$
        .onStart(() => logError($selectedEp ? `No route to endpoint ${$selectedEp}` : `No endpoint found for ${svc}`))
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

  // Advertise the filesystem
  advertiseFilesystem()

  // Publish services
  db.allServices(meshName).forEach(
    function (s) {
      publishService(s.protocol, s.name, s.host, s.port, s.users)
    }
  )

  // Open local ports
  db.allPorts(meshName).forEach(
    function (p) {
      var listen = p.listen
      var target = p.target
      openPort(listen.ip, p.protocol, listen.port, target.service, target.endpoint)
    }
  )

  logInfo(`Joined ${meshName} as ${config.agent.name} (uuid = ${config.agent.id})`)

  function selectEndpoint(proto, svc) {
    return hubs[0].findService(proto, svc).then(
      function (service) {
        if (!service) return null
        var ep = service.endpoints[0]
        return ep ? ep.id : null
      }
    )
  }

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
    var prefix = os.path.join('/home', username)
    var files = {}
    fs.list(prefix).forEach(filename => {
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

  function findEndpoint(ep) {
    return hubs[0].findEndpoint(ep)
  }

  function findFile(pathname) {
    return hubs[0].findFile(pathname)
  }

  function findApp(ep, provider, app) {
    if (ep === config.agent.id) {
      var isInstalled = apps.list(provider).includes(app)
      var isPublished = Boolean(fs.stat(`/home/${provider}/apps/pkg/${app}`))
      if (isPublished || isInstalled) {
        return Promise.resolve({
          ...getAppNameTag(app),
          provider,
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
      apps.listProviders().forEach(provider => {
        apps.list(provider).forEach(app => {
          list.push({
            ...getAppNameTag(app),
            provider,
            isPublished: false,
            isRunning: apps.isRunning(provider, app),
          })
        })
        fs.list(`/home/${provider}/apps/pkg/`).forEach(pathname => {
          var dirname = os.path.dirname(pathname)
          var app = pathname.substring(dirname.length + 1)
          var idx = getAppNameTag(app)
          var obj = list.find(a => a.name === idx.name && a.tag === idx.tag)
          if (obj) {
            obj.isPublished = true
          } else {
            list.push({
              ...idx,
              provider,
              isPublished: true,
              isRunning: false,
            })
          }
        })
      })
      return Promise.resolve(list)
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
          if (!pathname.startsWith('/apps/pkg/')) return
          var app = pathname.substring(10)
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
      var packagePathname = `/home/${provider}/apps/pkg/${app}`
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
      var packagePathname = `/home/${provider}/apps/pkg/${app}`
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
      return syncFile(`/home/${provider}/apps/pkg/${app}`).then(data => {
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
      return (apps.isInstalled(provider, app)
        ? Promise.resolve()
        : installApp(ep, provider, app)
      ).then(() => {
        var nt = getAppNameTag(app)
        db.setApp(meshName, provider, nt.name, nt.tag, { state: 'stopped' })
        try {
          apps.start(provider, app, username)
          return new Timeout(1).wait().then(() => {
            db.setApp(meshName, provider, nt.name, nt.tag, { username, state: 'running' })
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
    return apps.connect(provider, app)
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

  function discoverServices(ep) {
    return hubs[0].discoverServices(ep)
  }

  function publishService(protocol, name, host, port, users) {
    users = users || null
    var old = services.find(s => s.name === name && s.protocol === protocol)
    if (old) {
      old.host = host
      old.port = port
      old.users = users
    } else {
      services.push({
        name,
        protocol,
        host,
        port,
        users,
      })
    }
    updateServiceList()
  }

  function deleteService(protocol, name) {
    var old = services.find(s => s.name === name && s.protocol === protocol)
    if (old) {
      services.splice(services.indexOf(old), 1)
      updateServiceList()
    }
  }

  function updateServiceList() {
    var list = services.map(({ name, protocol, users }) => ({ name, protocol, users }))
    hubs.forEach(hub => hub.updateServiceList(list))
  }

  function portName(ip, protocol, port) {
    return `${ip}/${protocol}/${port}`
  }

  function openPort(ip, protocol, port, service, endpoint) {
    var key = portName(ip, protocol, port)
    try {
      switch (protocol) {
        case 'tcp':
        case 'udp':
          pipy.listen(`${ip}:${port}`, protocol, proxyToMesh(protocol, service, endpoint))
          break
        default: throw `Invalid protocol: ${protocol}`
      }
      ports[key] = { open: true }
    } catch (err) {
      ports[key] = { open: false, error: err.toString() }
    }
  }

  function closePort(ip, protocol, port) {
    var key = portName(ip, protocol, port)
    pipy.listen(`${ip}:${port}`, protocol, null)
    delete ports[key]
  }

  function checkPort(ip, protocol, port) {
    var key = portName(ip, protocol, port)
    return ports[key]
  }

  function remoteQueryServices(ep) {
    return selectHubWithThrow(ep).then(
      (hub) => httpAgents.get(hub).request(
        'GET', `/api/forward/${ep}/services`
      ).then(
        res => {
          remoteCheckResponse(res, 200)
          return JSON.decode(res.body)
        }
      )
    )
  }

  function remotePublishService(ep, proto, name, host, port, users) {
    return selectHubWithThrow(ep).then(
      (hub) => httpAgents.get(hub).request(
        'POST', `/api/forward/${ep}/services/${proto}/${name}`,
        {}, JSON.encode({ host, port, users })
      ).then(
        res => {
          remoteCheckResponse(res, 201)
          return JSON.decode(res.body)
        }
      )
    )
  }

  function remoteDeleteService(ep, proto, name) {
    return selectHubWithThrow(ep).then(
      (hub) => httpAgents.get(hub).request(
        'DELETE', `/api/forward/${ep}/services/${proto}/${name}`
      ).then(
        res => {
          remoteCheckResponse(res, 204)
        }
      )
    )
  }

  function remoteQueryPorts(ep) {
    return selectHubWithThrow(ep).then(
      (hub) => httpAgents.get(hub).request(
        'GET', `/api/forward/${ep}/ports`
      ).then(
        res => {
          remoteCheckResponse(res, 200)
          return JSON.decode(res.body)
        }
      )
    )
  }

  function remoteOpenPort(ep, ip, proto, port, target) {
    return selectHubWithThrow(ep).then(
      (hub) => httpAgents.get(hub).request(
        'POST', `/api/forward/${ep}/ports/${ip}/${proto}/${port}`,
        {}, JSON.encode({ target })
      ).then(
        res => {
          remoteCheckResponse(res, 201)
          return JSON.decode(res.body)
        }
      )
    )
  }

  function remoteClosePort(ep, ip, proto, port) {
    return selectHubWithThrow(ep).then(
      (hub) => httpAgents.get(hub).request(
        'DELETE', `/api/forward/${ep}/ports/${ip}/${proto}/${port}`
      ).then(
        res => {
          remoteCheckResponse(res, 204)
        }
      )
    )
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
    db.allPorts(meshName).forEach(
      function ({ protocol, listen }) {
        closePort(listen.ip, protocol, listen.port)
      }
    )
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
    syncFile,
    discoverServices,
    publishService,
    deleteService,
    openPort,
    closePort,
    checkPort,
    remoteQueryServices,
    remotePublishService,
    remoteDeleteService,
    remoteQueryPorts,
    remoteOpenPort,
    remoteClosePort,
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
