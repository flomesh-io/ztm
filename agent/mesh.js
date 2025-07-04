import db from './db.js'
import initFilesystem from './fs.js'
import initApps from './apps.js'

try {
  var ztmVersion = JSON.decode(pipy.load('version.json'))
} catch {
  var ztmVersion = {}
}

var agentVersion = {
  ztm: ztmVersion,
  pipy: { ...pipy.version },
}

export default function (rootDir, listen, config, onConfigUpdate) {
  var meshName = config.name
  var username
  var caCert
  var agentCert
  var agentKey
  var agentLabels = []
  var agentLog = []
  var meshErrors = []
  var fs = null
  var fsWatchers = []
  var fsLastChangeTime = Date.now()
  var acl = {}
  var apps = null
  var exited = false

  var epEnv = {
    id: config.agent.id,
    name: config.agent.name,
  }

  var meshEnv = {
    name: meshName,
    url: `http://${listen}/api/meshes/${meshName}`,
    path: `/api/meshes/${meshName}`,
    discoverUsers: discoverUsersFromApp,
    discover: discoverFromApp,
    connect: connectFromApp,
    fs: makeAppFilesystem,
  }

  if (config.agent.labels instanceof Array) {
    agentLabels = config.agent.labels.filter(l => typeof l === 'string')
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
      logInfo(`Agent certificate expires in ${getCertificateDays()} days`)
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

  var hubActive = []
  var hubCache = new algo.Cache({ ttl: 60 })
  var hubUnreachable = new Set

  var hubClients = new algo.Cache(
    target => new http.Agent(target, {
      tls: tlsOptions,
      connectTimeout: 10,
    })
  )

  //
  // Class Hub
  // Management of the interaction with a single hub instance
  //

  function Hub(id, zone, address) {
    var connections = new Set
    var closed = false
    var numFailures = 0

    var matchSessionID = new http.Match('/api/sessions/{id}')

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
      .muxHTTP(() => '', {
        version: 2,
        maxSessions: 1,
        ping: () => new Timeout(10).wait().then(new Data),
      }).to($=>$
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
                numFailures = 0
                meshErrors.length = 0
                connections.add(conn)
                advertiseFilesystem(filesystemLatest)
                advertiseACL(aclLatest)
              } else if (conn.state === 'closed') {
                logInfo(`Connection to hub ${address} closed`)
                connections.delete(conn)
              }
            }
          })
          .handleStreamEnd(
            (eos) => {
              meshError(`Connection to hub ${address} closed, error = ${eos.error}`)
              numFailures++
            }
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
              path: `/api/endpoints/${config.agent.id}?name=${URL.encodeComponent(config.agent.name)}`,
            })
          )
          .to(hubSession)
          .demuxHTTP().to($=>$
            .pipe(evt => {
              if (evt instanceof MessageStart) {
                var params = matchSessionID(evt.head.path)
                if (params) {
                  $sessionID = params.id
                  return establishSession
                }
                return serveHub
              }
            })
          )
        )
      )
    )

    // Establish a dedicated session to the hub on demand
    var establishSession = pipeline($=>$
      .onStart(() => {
        $sessionEstablishedPromise = new Promise(r => { $sessionEstablishedResolve = r })
        dedicatedSession.spawn($sessionID, $sessionEstablishedResolve)
      })
      .wait(() => $sessionEstablishedPromise)
      .replaceMessage(new Message({ status: 200 }))
    )

    var $sessionID
    var $sessionEstablishedPromise
    var $sessionEstablishedResolve

    var dedicatedSession = pipeline($=>$
      .onStart((id, cb) => {
        $sessionID = id
        $sessionEstablishedResolve = cb
        return new Data
      })
      .loop($=>$
        .connectHTTPTunnel(
          () => new Message({
            method: 'CONNECT',
            path: `/api/endpoints/${config.agent.id}?sid=${$sessionID}`,
          }), {
            onState: state => {
              if (state === 'connected') {
                $sessionEstablishedResolve()
              }
            }
          }
        )
        .to($=>$
          .muxHTTP(() => $sessionID, {
            version: 2,
            maxSessions: 1,
            ping: () => new Timeout(10).wait().then(new Data),
          }).to($=>$
            .connectTLS({ ...tlsOptions }).to($=>$
              .connect(address)
            )
          )
        )
        .demuxHTTP().to(serveHub)
      )
    )

    // Advertising filesystem
    var filesystemLatest = null
    var filesystemUpdate = null
    var filesystemSending = null

    function sendFilesystemUpdate(delay) {
      if (closed) return
      new Timeout(delay || 1).wait().then(() => {
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
            if (res?.head?.status === 201) {
              logInfo(`Sent filesystem to ${address} (size = ${size})`)
              filesystemSending = null
              sendFilesystemUpdate(1)
            } else {
              logError(`Unable to send filesystem to ${address} (status = ${res?.head?.status})`)
              sendFilesystemUpdate(10)
            }
          })
        } else {
          sendFilesystemUpdate(1)
        }
      })
    }

    // Advertising ACL
    var aclLatest = null
    var aclUpdate = null
    var aclSending = null

    function sendACLUpdate(delay) {
      if (closed) return
      new Timeout(delay || 1).wait().then(() => {
        if (aclUpdate) {
          aclSending = aclUpdate
          aclUpdate = null
        }
        if (aclSending) {
          var size = Object.keys(aclSending).length
          logInfo(`Sending ACL to ${address} (size = ${size})...`)
          requestHub.spawn(
            new Message(
              {
                method: 'POST',
                path: '/api/acl',
              },
              JSON.encode(aclSending)
            )
          ).then(res => {
            if (res?.head?.status === 201) {
              logInfo(`Sent ACL to ${address} (size = ${size})`)
              aclSending = null
              sendACLUpdate(1)
            } else {
              logError(`Unable to send ACL to ${address} (status = ${res?.head?.status})`)
              sendACLUpdate(10)
            }
          })
        } else {
          sendACLUpdate(1)
        }
      })
    }

    function heartbeat() {
      if (closed) return
      requestHub.spawn(
        new Message(
          { method: 'POST', path: '/api/status' },
          JSON.encode({
            name: config.agent.name,
            hubs: hubActive.filter(h => h.isConnected()).map(h => h.id),
            agent: {
              version: agentVersion,
              labels: agentLabels,
            }
          })
        )
      )
    }

    function renewCertificate() {
      if (closed) return
      logInfo(`Renewing agent certificate...`)
      return requestHub.spawn(
        new Message(
          { method: 'POST', path: `/api/sign/${username}`},
          new crypto.PublicKey(agentKey).toPEM()
        )
      ).then(
        res => {
          var status = res?.head?.status
          if (status === 201) {
            try {
              agentCert = new crypto.Certificate(res.body.toString())
              tlsOptions.certificate.cert = agentCert
              config.agent.certificate = agentCert.toPEM().toString()
              onConfigUpdate(config)
              logInfo(`New agent certificate expires in ${getCertificateDays()} days`)
            } catch {
              logError(`Cannot renew agent certificate with ${res?.body?.toString?.()}`)
            }
          } else {
            logError(`Cannot renew agent certificate with status ${status}`)
          }
        }
      )
    }

    function advertiseFilesystem(files) {
      filesystemLatest = files
      filesystemUpdate = files
    }

    function advertiseACL(acl) {
      aclLatest = acl
      aclUpdate = acl
    }

    function checkACL(pathname, user) {
      pathname = encodePathname(pathname)
      user = URL.encodeComponent(user)
      return requestHub.spawn(
        new Message({ method: 'GET', path: os.path.join('/api/acl', pathname) + `?username=${user}` })
      ).then(
        res => {
          if (res?.head?.status === 200) {
            try { var access = JSON.decode(res.body) } catch {}
            return access || true
          } else {
            return false
          }
        }
      )
    }

    function discoverEndpoints(id, name, user, keyword, offset, limit) {
      if (id instanceof Array) {
        return Promise.all(
          id.map(id => requestHub.spawn(
            new Message({ method: 'GET', path: `/api/endpoints/${id}` })
          ).then(
            function (res) {
              if (res && res.head.status === 200) {
                return JSON.decode(res.body)
              } else {
                return null
              }
            }
          ))
        )
      } else {
        var params = []
        if (id) params.push(`id=${URL.encodeComponent(id)}`)
        if (name) params.push(`name=${URL.encodeComponent(name)}`)
        if (user) params.push(`user=${URL.encodeComponent(user)}`)
        if (keyword) params.push(`keyword=${URL.encodeComponent(keyword)}`)
        if (offset) params.push(`offset=${offset}`)
        if (limit) params.push(`limit=${limit}`)
        var q = params.length > 0 ? '?' + params.join('&') : ''
        return requestHub.spawn(
          new Message({ method: 'GET', path: `/api/endpoints${q}` })
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
    }

    function discoverUsers(name, keyword, offset, limit) {
      var params = []
      if (name) params.push(`name=${URL.encodeComponent(name)}`)
      if (keyword) params.push(`keyword=${URL.encodeComponent(keyword)}`)
      if (offset) params.push(`offset=${offset}`)
      if (limit) params.push(`limit=${limit}`)
      var q = params.length > 0 ? '?' + params.join('&') : ''
      return requestHub.spawn(
        new Message({ method: 'GET', path: `/api/users${q}` })
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

    function discoverFiles(since, wait) {
      var path = '/api/filesystem'
      if (since || since === 0) {
        path += `?since=${since}`
        if (wait) path += '&wait'
      }
      return requestHub.spawn(
        new Message({ method: 'GET', path })
      ).then(
        function (res) {
          if (res && res.head.status === 200) {
            return Object.fromEntries(
              Object.entries(JSON.decode(res.body)).map(
                ([k, v]) => {
                  var since = v['+']
                  v = {
                    hash: v['#'],
                    size: v['$'],
                    time: v['T'],
                  }
                  if (since) v.since = since
                  return [k, v]
                }
              )
            )
          } else {
            return null
          }
        }
      )
    }

    function issuePermit(username, identity) {
      username = URL.encodeComponent(username)
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

    function evictUser(username) {
      username = URL.encodeComponent(username)
      var time = Math.floor(Date.now() / 1000)
      return requestHub.spawn(
        new Message({ method: 'POST', path: `/api/evictions/${username}?time=${time}`})
      ).then(
        function (res) {
          var status = res?.head?.status
          return (200 <= status && status <= 299)
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
      pathname = encodePathname(pathname)
      return requestHub.spawn(
        new Message({ method: 'GET', path: os.path.join('/api/filesystem', pathname) })
      ).then(
        function (res) {
          if (res && res.head.status === 200) {
            var meta = JSON.decode(res.body)
            return {
              hash: meta['#'],
              size: meta['$'],
              time: meta['T'],
              since: meta['+'],
              sources: meta['@'],
            }
          } else {
            return null
          }
        }
      )
    }

    function getEndpointStats(ep) {
      return requestHub.spawn(
        new Message({ method: 'GET', path: ep ? `/api/stats/endpoints/${ep}` : '/api/stats/endpoints' })
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

    function pingEndpoint(ep, timeout) {
      timeout = timeout || 30
      var timestamp = {
        endpoint: config.agent.id,
        start: Date.now(),
        end: null,
        error: null,
      }
      return Promise.race([
        new Timeout(timeout).wait().then(() => {
          timestamp.end = Date.now()
          timestamp.error = 'Response timeout'
          return [timestamp]
        }),
        requestHub.spawn(
          new Message({ method: 'GET', path: `/api/ping/endpoints/${ep}?timeout=${timeout}`})
        ).then(
          function (res) {
            timestamp.end = Date.now()
            var status = res?.head?.status
            if (status === 200) {
              try {
                var payload = JSON.decode(res.body)
                if (payload instanceof Array) {
                  return [timestamp, ...payload]
                }
              } catch {}
            }
            if (res.body) {
              timestamp.error = `Invalid response (status ${status}): ${res.body.shift(100).toString()}`
            } else {
              timestamp.error = `Invalid response (status ${status})`
            }
            return [timestamp]
          }
        )
      ])
    }

    function leave() {
      closed = true
      connections.forEach(
        conn => conn.close()
      )
    }

    // Start communication with the hub
    reverseServer.spawn()
    sendFilesystemUpdate()
    sendACLUpdate()

    return {
      id,
      zone,
      address,
      isConnected: () => connections.size > 0,
      isFailed: () => connections.size === 0 && numFailures > 5,
      heartbeat,
      renewCertificate,
      advertiseFilesystem,
      advertiseACL,
      checkACL,
      discoverEndpoints,
      discoverUsers,
      discoverFiles,
      issuePermit,
      evictUser,
      findEndpoint,
      findFile,
      getEndpointStats,
      pingEndpoint,
      leave,
    }

  } // End of class Hub

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
    .pipe(
      function (evt) {
        if (evt instanceof MessageStart) {
          if (evt.head.method === 'CONNECT') {
            var path = evt.head.path
            if (matchProviderApp(path) || matchApp(path)) {
              return toLocalApp
            }
          }
          return serveOtherAgents
        }
      }
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
        'GET': () => response(200, { id: config.agent.id })
      },

      '/api/log': {
        'GET': function () {
          return response(200, getLog())
        }
      },

      '/api/labels': {
        'GET': function () {
          return response(200, getLabels())
        },

        'POST': function (_, req) {
          setLabels(JSON.decode(req.body))
          return response(201)
        },
      },

      '/api/hubs/{id}': {
        'POST': function ({ id }, req) {
          var info = JSON.decode(req.body)
          var hub = {
            zone: info.zone,
            ports: info.ports,
            version: info.version,
          }
          hubCache.set(id, hub)
          db.setHub(id, hub)
          logInfo(`Discovered new hub ${id} in zone '${hub.zone}' with ports: ${info.ports.join(', ')}`)
          return response(201)
        },
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
          return connectApp(params.provider, $requestedApp, username).then(p => {
            if (p) {
              $requestedAppPipeline = p
              return response200
            }
            logError(`Local app ${$requestedApp} not found`)
            return response404
          }).catch(
            () => response404
          )
        }
        return response404
      }
    ).to($=>$
      .pipe(() => $requestedAppPipeline, () => ({ source: 'peer', peer: $requestedAppPeer }))
    )
  )

  //
  // Agent proxying to remote apps: local -> mesh
  //
  //   Local App ----\                  /----> Hub ----> Remote Agent ----> Remote App
  //   Local App -----)----> Agent ----(-----> Hub ----> Remote Agent ----> Remote App
  //   Local App ----/                  \----> Hub ----> Remote Agent ----> Remote App
  //

  var toRemoteApp = (ep, provider, app, isDedicated, connectOptions) => pipeline($=>$
    .onStart(() => {
      $lastDataTime = {}
      $selectedEp = ep
      return selectHub(ep).then(hub => {
        $selectedHub = hub
        return new Data
      })
    })
    .pipe(() => $selectedHub ? 'proxy' : 'deny', {
      'proxy': ($=>$
        .handleData(() => { $lastDataTime.value = Date.now() })
        .connectHTTPTunnel(() => {
          var q = `?src=${config.agent.id}`
          if (isDedicated) q += '&dedicated'
          return new Message({
            method: 'CONNECT',
            path: provider ? `/api/endpoints/${ep}/apps/${provider}/${app}${q}` : `/api/endpoints/${ep}/apps/${app}${q}`,
          })
        }).to($=>$
          .muxHTTP(() => $selectedHub, {
            version: 2,
            maxSessions: 1,
            ping: () => new Timeout(10).wait().then(new Data),
          }).to($=>$
            .connectTLS(tlsOptions).to($=>$
              .insert(() => checkTimeout())
              .connect(() => $selectedHub, connectOptions)
            )
          )
        )
        .handleData(() => { $lastDataTime.value = Date.now() })
      ),
      'deny': ($=>$
        .onStart(() => logError(`No route to endpoint ${ep}`))
        .replaceData(new StreamEnd)
      ),
    })
  )

  var $lastDataTime = null

  function checkTimeout() {
    if (Date.now() - $lastDataTime.value > 60000) {
      return new StreamEnd
    } else {
      return new Timeout(10).wait().then(checkTimeout)
    }
  }

  // HTTP agents for ad-hoc agent-to-hub sessions
  var httpAgents = new algo.Cache(
    target => new http.Agent(target, { tls: tlsOptions })
  )

  // Start communication with the mesh
  function start() {
    searchHub().then(hub => {
      hubActive[0] = Hub(hub.id, hub.zone, hub.port)

      heartbeat()
      advertiseFilesystem()

      db.allApps(meshName).forEach(app => {
        if (app.state === 'running' && app.username === username) {
          var appname = app.name
          if (app.tag) appname += '@' + app.tag
          startApp(config.agent.id, app.provider, appname)
        }
      })

      var hubLabel = hub.zone ? `${hub.port} in ${hub.zone}` : hub.port
      logInfo(`Joined ${meshName} as ${config.agent.name} (uuid = ${config.agent.id}) via hub ${hubLabel}`)

      monitorHub()
    })

    function searchHub() {
      logInfo(`Start from bootstraps ${config.bootstraps.join(', ')}`)
      return pickHub().then(hub => {
        if (!hub) {
          meshErrors.length = 0
          meshError(`No hub found`)
          return new Timeout(10).wait().then(searchHub)
        }
        return hub
      })
    }

    function monitorHub() {
      var hub = hubActive[0]
      if (hub && hub.isFailed()) {
        logError(`Hub seems down: ${hub.address} (ID = ${hub.id})`)
        hubActive.forEach(h => h.leave())
        searchHub().then(hub => {
          hubActive[0] = Hub(hub.id, hub.zone, hub.port)
          advertiseFilesystem()
          new Timeout(1).wait().then(monitorHub)
        })
      } else {
        new Timeout(1).wait().then(monitorHub)
      }
    }
  }

  function pickHub() {
    function pickPort(id, zone, ports) {
      return Promise.all(ports.map(
        port => {
          var t = Date.now()
          return getHubStatus(port).then(res => {
            if (res?.id !== id) {
              logInfo(`Probed hub ${port} and got no valid response`)
              return null
            } else {
              var latency = Date.now() - t
              var capacity = res.capacity?.agents || Number.POSITIVE_INFINITY
              var load = res.load?.agents || 0
              logInfo(`Probed hub ${port} and got response in ${latency}ms: capacity = ${capacity}, load = ${load}`)
              return { id, zone, port, latency, load: load / capacity }
            }
          })
        }
      )).then(results => (
        results.filter(r => r).reduce(
          (a, b) => a.latency <= b.latency ? a : b
        )
      ))
    }

    function pickRandom(hubs) {
      var keys = Object.keys(hubs)
      var id = keys[Math.floor(Math.random() * keys.length)]
      if (id) {
        var hub = hubs[id]
        delete hubs[id]
        return pickPort(id, hub.zone, hub.ports).then(result => result || pickRandom(hubs))
      } else {
        return null
      }
    }

    return listZones(config.bootstraps).then(
      zones => Promise.all(zones.map(
        zone => listZoneHubs(config.bootstraps, zone).then(
          hubs => pickRandom(hubs)
        )
      ))
    ).then(
      results => results.filter(r => r).reduce(
        (a, b) => a.latency <= b.latency ? a : b
      )?.zone
    ).then(
      zone => !zone ? null : listZoneHubs(config.bootstraps, zone).then(
        hubs => Promise.all(Object.entries(hubs).map(
          ([id, hub]) => pickPort(id, hub.zone, hub.ports)
        )).then(
          results => results.filter(r => r).reduce(
            (a, b) => {
              if (Math.abs(a.latency - b.latency) < 10) {
                return a.load <= b.load ? a : b
              } else {
                return a.latency <= b.latency ? a : b
              }
            }
          )
        )
      )
    )
  }

  // Send heartbeats
  function heartbeat() {
    if (!exited) {
      hubActive.forEach(h => h.heartbeat())
      renewCertificate().then(() => {
        new Timeout(15).wait().then(heartbeat)
      })
    }
  }

  // Certificate expiration
  function getCertificateDays() {
    if (!agentCert) return 0
    return Math.floor((agentCert.notAfter - Date.now()) / (24*60*60*1000))
  }

  // Renew certificate
  function renewCertificate() {
    var days = getCertificateDays()
    if (days > 100) return Promise.resolve()
    return hubActive[0].renewCertificate()
  }

  function listZones(bootstraps) {
    var all = {}
    return Promise.allSettled(bootstraps.map(
      name => hubClients.get(name).request('GET', '/api/zones').then(
        res => {
          if (res?.head?.status === 200) {
            try {
              var list = JSON.decode(res.body)
              if (list instanceof Array) list.forEach(zone => all[zone] = true)
            } catch {}
          }
        }
      )
    )).then(() => {
      var zones = Object.keys(all)
      if (zones.length === 0) {
        return db.allZones()
      } else {
        db.setZones(zones)
        return zones
      }
    })
  }

  function listZoneHubs(bootstraps, zone) {
    var all = {}
    var found = false
    return Promise.allSettled(bootstraps.map(
      name => hubClients.get(name).request('GET', `/api/zones/${zone}/hubs`).then(
        res => {
          if (res?.head?.status === 200) {
            try {
              Object.entries(JSON.decode(res.body)).forEach(
                ([k, v]) => {
                  var hub = hubCache.get(k)
                  if (!hub) {
                    hub = {
                      zone,
                      ports: [],
                      version: v.version,
                    }
                    hubCache.set(k, hub)
                  }
                  var ports = hub.ports
                  v.ports.forEach(name => {
                    if (!ports.includes(name)) {
                      ports.push(name)
                    }
                  })
                  all[k] = hub
                  found = true
                }
              )
            } catch {}
          }
        }
      )
    )).then(() => {
      if (found) {
        db.setHubs(zone, all)
      } else {
        Object.entries(db.allHubs(zone)).forEach(
          ([id, info]) => {
            var hub = {
              zone,
              ports: info.ports,
              version: info.version,
            }
            all[id] = hub
            hubCache.set(id, hub)
          }
        )
      }
      return all
    })
  }

  function listAllHubs(bootstraps) {
    hubCache.clear()
    var all = {}
    return listZones(bootstraps).then(
      zones => Promise.all(zones.map(
        zone => listZoneHubs(bootstraps, zone).then(
          hubs => Object.entries(hubs).forEach(
            ([id, hub]) => {
              var ports = (all[id] ??= hub).ports
              hub.ports.forEach(name => {
                if (!ports.includes(name)) {
                  ports.push(name)
                }
              })
            }
          )
        )))
    ).then(() => all)
  }

  function listHubPorts(id) {
    return (hubCache.has(id)
      ? Promise.resolve(hubCache.get(id).ports)
      : listAllHubs(config.bootstraps).then(hubs => hubs[id]?.ports || [])
    )
  }

  function getHubStatus(name) {
    return hubClients.get(name).request('GET', '/api/status').then(
      res => {
        var status = res?.head?.status
        if (status === 200) {
          try {
            return JSON.decode(res.body)
          } catch {}
        } else if (status === 504) {
          hubUnreachable.add(name)
        }
        return null
      }
    ).catch(() => null)
  }

  function getHubLog(name) {
    return hubClients.get(name).request('GET', '/api/log').then(
      res => {
        if (res?.head?.status === 200) {
          try {
            return JSON.decode(res.body)
          } catch {}
        }
        return null
      }
    ).catch(() => null)
  }

  function selectHub(ep) {
    return hubActive[0].findEndpoint(ep).then(
      function (endpoint) {
        if (!endpoint) return null
        var list = endpoint.hubs || []
        return Promise.all(list.map(
          id => listHubPorts(id).then(
            ports => Promise.all(ports.filter(name => !hubUnreachable.has(name)).map(
              name => {
                var t = Date.now()
                return getHubStatus(name).then(
                  info => info?.id === id ? { id, name, latency: Date.now() - t } : null
                )
              }
            ))
          )
        )).then(
          results => results.flat().filter(r => r).reduce((a, b) => a.latency <= b.latency ? a : b)?.name
        )
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
    hubActive[0].advertiseFilesystem(files)
  }

  function issuePermit(username, identity) {
    return hubActive[0].issuePermit(username, identity)
  }

  function evictUser(username) {
    return hubActive[0].evictUser(username)
  }

  function findHub(id) {
    return listHubPorts(id).then(
      names => Promise.any(names.map(
        name => getHubStatus(name).then(res => res?.id === id ? res : Promise.reject())
      ))
    ).then(
      res => Promise.all(res.ports.map(name => {
        var t = Date.now()
        return getHubStatus(name).then(res => ({
          name,
          ping: res ? Date.now() - t : undefined,
          online: res ? true : false,
        }))
      })).then(ports => {
        res.ports = ports
        res.connected = hubActive.some(h => h.id === id)
        return res
      })
    ).catch(() => null)
  }

  function findHubLog(id) {
    return listHubPorts(id).then(
      names => Promise.any(names.map(
        name => getHubLog(name).then(res => res || Promise.reject())
      ))
    ).catch(() => [])
  }

  function findEndpoint(ep) {
    return hubActive[0].findEndpoint(ep)
  }

  function findFile(pathname) {
    return hubActive[0].findFile(pathname)
  }

  function findApp(ep, provider, app) {
    if (ep === config.agent.id) {
      var isBuiltin = apps.isBuiltin(provider, app)
      var isDownloaded = apps.isDownloaded(provider, app)
      var isPublished = Boolean(fs.stat(`/shared/${provider}/pkg/${app}`))
      if (isPublished || isDownloaded || isBuiltin) {
        var nt = getAppNameTag(app)
        return Promise.resolve({
          ...getAppNameTag(app),
          provider,
          isBuiltin: isBuiltin && !isDownloaded,
          isDownloaded,
          isPublished,
          isDisabled: isAppDisabled(provider, app),
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

  function attachHub(id) {
    if (id === hubActive[0]?.id) {
      return Promise.resolve()
    } else {
      return findHub(id).then(
        hub => {
          if (hub) {
            var port = hub.ports.reduce((a, b) => a.ping < b ? a : b)
            hubActive.forEach(h => h.leave())
            hubActive[0] = Hub(hub.id, hub.zone, port.name)
            advertiseFilesystem()
          }
        }
      )
    }
  }

  function discoverHubs() {
    return listAllHubs(config.bootstraps).then(
      all => {
        Object.entries(all).forEach(
          ([k, v]) => {
            if (hubActive.some(h => h.id === k)) {
              all[k] = { ...v, connected: true }
            }
          }
        )
        return all
      }
    )
  }

  function discoverEndpoints(id, name, user, keyword, offset, limit) {
    return hubActive[0].discoverEndpoints(id, name, user, keyword, offset, limit)
  }

  function discoverUsers(name, keyword, offset, limit) {
    return hubActive[0].discoverUsers(name, keyword, offset, limit)
  }

  function discoverFiles(since, wait) {
    return hubActive[0].discoverFiles(since, wait)
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
          isDisabled: isAppDisabled(app.provider, app.name),
          isRunning: apps.isRunning(app.provider, app.name),
        })
      })
      var match = new http.Match('/shared/{provider}/pkg/{name}')
      fs.list('/shared/').forEach(pathname => {
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
            isDisabled: isAppDisabled(provider, app),
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
            isDisabled: isAppDisabled(app.provider, appname),
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
            isDisabled: isAppDisabled(provider, appname),
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
      return hubActive[0].discoverFiles().then(files => {
        var apps = []
        Object.keys(files || {}).forEach(pathname => {
          if (!pathname.startsWith('/shared/')) return
          pathname = pathname.substring(8)
          var i = pathname.indexOf('/')
          if (i < 0) return
          var provider = pathname.substring(0, i)
          pathname = pathname.substring(i)
          if (!pathname.startsWith('/pkg/')) return
          var app = pathname.substring(5)
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
      var packagePathname = `/shared/${provider}/pkg/${app}`
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
      var packagePathname = `/shared/${provider}/pkg/${app}`
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
      return syncFile(`/shared/${provider}/pkg/${app}`).then(data => {
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
        db.setApp(meshName, provider, nt.name, nt.tag, { state: 'disabled' })
        try {
          apps.start(provider, app, username)
          return new Timeout(1).wait().then(() => {
            db.setApp(meshName, provider, nt.name, nt.tag, { username, state: 'running' })
            logInfo(`App ${provider}/${app} started locally`)
          })
        } catch (e) {
          db.setApp(meshName, provider, nt.name, nt.tag, { state: 'disabled' })
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

  function disableApp(ep, provider, app) {
    if (ep === config.agent.id) {
      return stopApp(ep, provider, app).then(() => {
        var nt = getAppNameTag(app)
        db.setApp(meshName, provider, nt.name, nt.tag, { state: 'disabled' })
      })
    } else {
      return selectHubWithThrow(ep).then(
        (hub) => httpAgents.get(hub).request(
          'POST', `/api/forward/${ep}/apps/${provider}/${app}`,
          {}, JSON.encode({ isDisabled: true })
        ).then(
          res => {
            if (res.head?.status === 201) {
              logInfo(`App ${provider}/${app} disabled remotely`)
            } else {
              logError(`App ${provider}/${app} remote disabling failed, status = ${res.head?.status} ${res.head?.statusText}, body: ${res.body?.toString?.()}`)
            }
          }
        )
      )
    }
  }

  function enableApp(ep, provider, app) {
    if (ep === config.agent.id) {
      var nt = getAppNameTag(app)
      db.setApp(meshName, provider, nt.name, nt.tag, { state: apps.isRunning(provider, app) ? 'running' : 'stopped' })
      return Promise.resolve()
    } else {
      return selectHubWithThrow(ep).then(
        (hub) => httpAgents.get(hub).request(
          'POST', `/api/forward/${ep}/apps/${provider}/${app}`,
          {}, JSON.encode({ isDisabled: false })
        ).then(
          res => {
            if (res.head?.status === 201) {
              logInfo(`App ${provider}/${app} enabled remotely`)
            } else {
              logError(`App ${provider}/${app} remote enabling failed, status = ${res.head?.status} ${res.head?.statusText}, body: ${res.body?.toString?.()}`)
            }
          }
        )
      )
    }
  }

  function isAppDisabled(provider, app) {
    var nt = getAppNameTag(app)
    return db.getApp(meshName, provider, nt.name, nt.tag)?.state === 'disabled'
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

  function connectApp(provider, app, peerUsername) {
    if (!apps.isRunning(provider, app)) {
      if (peerUsername !== username) return Promise.reject()
      if (isAppDisabled(provider, app)) return Promise.reject()
      return startApp(config.agent.id, provider, app).then(
        () => apps.connect(provider, app)
      )
    } else {
      return Promise.resolve(apps.connect(provider, app))
    }
  }

  function setACL(pathname, access) {
    acl[pathname] = {
      all: access.all || '',
      users: access.users || null,
      since: Date.now(),
    }
    hubActive[0].advertiseACL(acl)
  }

  function checkACL(pathname, username) {
    return hubActive[0].checkACL(pathname, username)
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

  function deleteFile(pathname) {
    if (fs.tombstone(pathname)) {
      advertiseFilesystem()
      return true
    }
    return false
  }

  function syncFile(pathname) {
    pathname = os.path.normalize(pathname)
    var st = fs.stat(pathname)
    return findFile(pathname).then(meta => {
      if (!meta) return st ? fs.raw(st.hash) : null
      if (meta.size < 0) return st?.time > meta.time ? fs.raw(st.hash) : null

      var hash = meta.hash
      var time = meta.time
      if (st?.hash === hash) return fs.raw(hash)
      if (st?.time > time) return fs.raw(st.hash)

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
          fs.write(pathname, data, time)
          advertiseFilesystem()
          return data
        }).catch(ret => {
          logError(`Download of file ${hash} from ep ${ep} failed: ${JSON.stringify(ret)}`)
          return pickOne()
        })
      }
    })
  }

  function watchFile(prefix) {
    var resolve
    var promise = new Promise(cb => resolve = cb)
    var isWatching = fsWatchers.length > 0
    var entry = fsWatchers.find(([k]) => k === prefix)
    if (entry) {
      entry[1].push(resolve)
    } else {
      fsWatchers.push([prefix, [resolve]])
    }
    if (!isWatching) startWatchingFiles()
    return promise
  }

  function startWatchingFiles() {
    discoverFiles(fsLastChangeTime, true).then(files => {
      if (!files) {
        new Timeout(10).wait().then(startWatchingFiles)
        return
      }
      var paths = Object.keys(files)
      if (paths.length > 0) {
        fsLastChangeTime = Object.values(files).map(f => f.since).reduce(
          (max, t) => (t > max ? t : max), fsLastChangeTime
        )
        fsWatchers.forEach(
          ([prefix, watchers]) => {
            var changes = []
            paths.forEach(path => {
              if (path.startsWith(prefix)) {
                changes.push(path)
              }
            })
            if (changes.length > 0) {
              watchers.forEach(resolve => resolve([...changes]))
              watchers.length = 0
            }
          }
        )
        fsWatchers = fsWatchers.filter(([_, watchers]) => watchers.length > 0)
      }
      if (fsWatchers.length > 0) startWatchingFiles()
    })
  }

  //
  // Mesh API exposed to apps
  //

  function discoverUsersFromApp(provider, app) {
    return function (name, options) {
      options = options || {}
      return discoverUsers(name, options.keyword, options.offset, options.limit)
    }
  }

  function discoverFromApp(provider, app) {
    return function (id, name, options) {
      options = options || {}
      if (id instanceof Array) {
        return discoverEndpoints(id)
      } else {
        return discoverEndpoints(id, name, options.username, options.keyword, options.offset, options.limit)
      }
    }
  }

  function connectFromApp(provider, app) {
    return function (ep, options) {
      if (typeof ep === 'object') {
        var $appPipeline
        return pipeline($=>$
          .onStart(() => connectApp(ep.provider, ep.app, username).then(p => {
            if (p) {
              $appPipeline = p
            } else {
              $appPipeline = pipeline($=>$)
              logError(`Local app ${$ep.app} not found`)
              return new StreamEnd
            }
          }))
          .pipe(() => $appPipeline, () => ({ source: 'self' }))
        )
      } else {
        var isDedicated = Boolean(options?.dedicated)
        var bind = options?.bind
        var onState = options?.onState
        var connectOptions = { bind, onState }
        return toRemoteApp(ep, provider, app, isDedicated, connectOptions)
      }
    }
  }

  function makeAppFilesystem(provider, app) {
    var pathApp = `/apps/${provider}/${app}`
    var pathUser = `/users/${username}/`
    var pathShared = `/shared/`
    var pathLocal = `/local/`
    var pathAppUser = pathApp + pathUser
    var pathAppShared = pathApp + pathShared

    function pathToLocal(path) {
      if (path.startsWith(pathAppUser) || path.startsWith(pathAppShared)) {
        return path.substring(pathApp.length)
      }
    }

    function pathToGlobal(path) {
      if (path.startsWith(pathUser) || path.startsWith(pathShared)) {
        return pathApp + path
      }
    }

    function list(prefix) {
      prefix = os.path.normalize(prefix || '')
      if (!prefix.endsWith('/')) prefix += '/'
      return discoverFiles().then(
        files => {
          var list = {}
          Object.entries(files || {}).forEach(([path, stat]) => {
            var localPath = pathToLocal(path)
            if (localPath && localPath.startsWith(prefix)) {
              list[localPath] = stat
            }
          })
          return list
        }
      )
    }

    function dir(prefix) {
      prefix = os.path.normalize(prefix || '')
      if (!prefix.endsWith('/')) prefix += '/'
      return discoverFiles().then(
        files => {
          var set = new Set
          var list = []
          Object.keys(files || {}).forEach(path => {
            var localPath = pathToLocal(path)
            if (localPath && localPath.startsWith(prefix)) {
              var path = localPath.substring(prefix.length)
              var i = path.indexOf('/')
              if (i) {
                var name = (i > 0 ? path.substring(0, i + 1) : path)
                if (!set.has(name)) {
                  set.add(name)
                  list.push(name)
                }
              }
            }
          })
          return list.sort()
        }
      )
    }

    function read(pathname) {
      var path = os.path.normalize(pathname)
      if (path.startsWith(pathLocal)) {
        return Promise.resolve(
          db.getFile(meshName, provider, app, path.substring(pathLocal.length))
        )
      } else {
        var globalPath = pathToGlobal(path)
        if (globalPath) {
          return syncFile(globalPath)
        } else {
          return Promise.resolve(null)
        }
      }
    }

    function write(pathname, data) {
      if (typeof data === 'string') data = new Data(data)
      var path = os.path.normalize(pathname)
      if (path.startsWith(pathLocal)) {
        db.setFile(meshName, provider, app, path.substring(pathLocal.length), data)
      } else {
        var globalPath = pathToGlobal(path)
        if (globalPath) {
          fs.write(globalPath, data)
          advertiseFilesystem()
          return syncFile(globalPath)
        }
      }
      return Promise.resolve()
    }

    function unlink(pathname) {
      var path = os.path.normalize(pathname)
      if (path.startsWith(pathLocal)) {
        db.delFile(meshName, provider, app, path.substring(pathLocal.length))
      } else {
        var globalPath = pathToGlobal(path)
        if (globalPath) {
          unpublishFile(globalPath)
        }
      }
    }

    function erase(pathname) {
      var path = os.path.normalize(pathname)
      if (path.startsWith(pathLocal)) {
        db.delFile(meshName, provider, app, path.substring(pathLocal.length))
      } else {
        var globalPath = pathToGlobal(path)
        if (globalPath) {
          deleteFile(globalPath)
        }
      }
    }

    function stat(pathname) {
      var path = os.path.normalize(pathname)
      if (path.startsWith(pathLocal)) {
        return Promise.resolve(null)
      } else {
        var globalPath = pathToGlobal(path)
        if (globalPath) {
          return findFile(globalPath).then(
            stat => {
              if (!stat) return null
              return {
                size: stat.size,
                time: stat.time,
                hash: stat.hash,
                sources: stat.sources,
              }
            }
          )
        } else {
          return Promise.resolve(null)
        }
      }
    }

    function acl(pathname, access) {
      var path = os.path.normalize(pathname)
      if (path.startsWith(pathLocal)) {
        return Promise.resolve(false)
      } else {
        var globalPath = pathToGlobal(path)
        if (globalPath) {
          setACL(globalPath, access)
          return Promise.resolve(true)
        } else {
          return Promise.resolve(false)
        }
      }
    }

    function access(pathname, user) {
      var path = os.path.normalize(pathname)
      if (path.startsWith(pathLocal)) {
        return Promise.resolve(true)
      } else {
        var globalPath = pathToGlobal(path)
        if (globalPath) {
          return checkACL(globalPath, user || username)
        } else {
          return Promise.resolve(false)
        }
      }
    }

    function watch(prefix) {
      if (!prefix.endsWith('/')) prefix += '/'
      var globalPath = pathToGlobal(prefix)
      if (globalPath) {
        return watchFile(globalPath).then(
          paths => paths.map(path => pathToLocal(path)).filter(p=>p)
        )
      }
    }

    return { list, dir, read, write, unlink, erase, stat, acl, access, watch }
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

  function getEndpointStats(ep) {
    return hubActive[0].getEndpointStats(ep)
  }

  function pingEndpoint(ep) {
    return hubActive[0].pingEndpoint(ep)
  }

  function leave() {
    hubActive.forEach(hub => hub.leave())
    exited = true
    logInfo(`Left ${meshName} as ${config.agent.name} (uuid = ${config.agent.id})`)
  }

  function isConnected() {
    return hubActive.some(h => h.isConnected())
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
        labels: agentLabels,
        offline: config.agent.offline || false,
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

  function getLabels() {
    return [...agentLabels]
  }

  function setLabels(labels) {
    if (labels instanceof Array) {
      var all = {}
      labels.forEach(l => all[l] = true)
      agentLabels = Object.keys(all)
      config.agent.labels = [...agentLabels]
      onConfigUpdate(config)
    }
    return true
  }

  function remoteGetLabels(ep) {
    return selectHubWithThrow(ep).then(
      (hub) => httpAgents.get(hub).request(
        'GET', `/api/forward/${ep}/labels`
      ).then(
        res => {
          remoteCheckResponse(res, 200)
          return JSON.decode(res.body)
        }
      )
    )
  }

  function remoteSetLabels(ep, labels) {
    return selectHubWithThrow(ep).then(
      (hub) => httpAgents.get(hub).request(
        'POST', `/api/forward/${ep}/labels`,
        null, JSON.encode(labels)
      ).then(
        res => {
          remoteCheckResponse(res, 201)
          return true
        }
      )
    )
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
    start,
    isConnected,
    getStatus,
    getLog,
    getErrors,
    getLabels,
    setLabels,
    remoteGetLabels,
    remoteSetLabels,
    issuePermit,
    evictUser,
    findHub,
    findHubLog,
    findEndpoint,
    findFile,
    findApp,
    attachHub,
    discoverHubs,
    discoverEndpoints,
    discoverUsers,
    discoverFiles,
    discoverApps,
    publishApp,
    unpublishApp,
    installApp,
    uninstallApp,
    startApp,
    stopApp,
    disableApp,
    enableApp,
    isAppDisabled,
    dumpAppLog,
    connectApp,
    setACL,
    checkACL,
    downloadFile,
    publishFile,
    unpublishFile,
    deleteFile,
    syncFile,
    remoteQueryLog,
    getEndpointStats,
    pingEndpoint,
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

function encodePathname(pathname) {
  return pathname.split('/').map(s => URL.encodeComponent(s)).join('/')
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
