export default function ({ app, mesh }) {
  var CONFIG_PATHNAME = `/local/services.json`
  var localServices = {}
  var localRoutes = []

  app.onExit(() => {
    localServices = {}
    localRoutes = []
  })

  function checkResponse(res, f) {
    var status = res?.head?.status
    if (200 <= status && status <= 299) {
      return typeof f === 'function' ? f(res.body) : f
    }
    throw res?.head?.statusText || 'No response from peer'
  }

  function allServices(ep) {
    if (ep) {
      // Get the service list on a specific endpoint
      if (ep === app.endpoint.id) {
        return Promise.resolve(
          Object.entries(localServices).flatMap(
            ([kind, services]) => Object.entries(services).map(
              ([name, service]) => ({
                name,
                kind,
                protocol: service.protocol,
                metainfo: service.metainfo,
                target: service.target,
              })
            )
          )
        )
      } else {
        return mesh.request(ep, new Message(
          {
            method: 'GET',
            path: `/api/services`,
          }
        )).then(res => checkResponse(res, body => JSON.decode(body)))
      }
    } else {
      // Get all services in the mesh
      var pathPattern = new http.Match(getServiceFilePathname('{username}', '{ep}', '{kind}', '{name}'))
      return mesh.list(getServiceFilePathname()).then(
        files => Promise.all(Object.keys(files).map(
          filename => {
            var params = pathPattern(filename)
            if (params) {
              return mesh.read(filename).then(
                data => {
                  if (data) {
                    try {
                      return {
                        ...JSON.decode(data),
                        ...params,
                      }
                    } catch {}
                  }
                  return null
                }
              )
            }
            return null
          }
        )).then(
          infos => {
            var endpoints = {}
            infos = infos.filter(i=>i)
            infos.forEach(info => {
              var id = info.ep
              endpoints[id] ??= { id }
            })
            return mesh.discover(Object.keys(endpoints)).then(
              list => {
                list.filter(e=>e).forEach(ep => Object.assign(endpoints[ep.id], ep))
                return {
                  endpoints,
                  services: infos.map(
                    info => {
                      var ep = endpoints[info.ep]
                      if (ep?.username !== info.username) {
                        return null
                      }
                      return {
                        name: info.name,
                        kind: info.kind,
                        protocol: info.protocol,
                        metainfo: info.metainfo,
                        endpoint: {
                          id: ep.id,
                        },
                        localRoutes: findLocalRoutes(ep.id, info.kind, info.name),
                      }
                    }
                  ).filter(s=>s)
                }
              }
            )
          }
        )
      )
    }
  }

  function getService(ep, kind, name) {
    if (ep === app.endpoint.id) {
      var service = localServices[kind]?.[name]
      if (service) {
        return Promise.resolve({
          name,
          kind,
          protocol: service.protocol,
          metainfo: service.metainfo,
          target: service.target,
          localRoutes: findLocalRoutes(ep.id, kind, name),
        })
      }
      return Promise.resolve(null)
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'GET',
          path: `/api/services/${kind}/${URL.encodeComponent(name)}`,
        }
      )).then(res => checkResponse(res, body => JSON.decode(body)))
    }
  }

  function setService(ep, kind, name, info) {
    if (ep === app.endpoint.id) {
      checkName(name)
      checkKind(kind)
      checkService(info)
      var service = {
        protocol: info.protocol,
        metainfo: info.metainfo,
        target: info.target,
      }
      localServices[kind] ??= {}
      localServices[kind][name] = service
      saveLocalConfig()
      publishService(kind, name, service)
      return Promise.resolve()
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'POST',
          path: `/api/services/${kind}/${URL.encodeComponent(name)}`,
        },
        JSON.encode(info)
      )).then(checkResponse)
    }
  }

  function deleteService(ep, kind, name) {
    if (ep === app.endpoint.id) {
      var k = localServices[kind]
      if (k) delete k[name]
      saveLocalConfig()
      unpublishService(kind, name)
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'DELETE',
          path: `/api/services/${kind}/${URL.encodeComponent(name)}`,
        }
      )).then(checkResponse)
    }
  }

  function allRoutes(ep) {
    if (ep === app.endpoint.id) {
      var endpoints = {}
      localRoutes.forEach(r => {
        var id = r.service.endpoint.id
        if (id) endpoints[id] = { id }
      })
      return mesh.discover(Object.keys(endpoints)).then(
        list => {
          list.filter(e=>e).forEach(ep => endpoints[ep.id] = ep)
          return {
            endpoints,
            routes: localRoutes.map(
              r => ({
                path: removeSlash(r.path),
                service: {
                  name: r.service.name,
                  kind: r.service.kind,
                  endpoint: r.service.endpoint,
                },
                cors: r.cors,
              })
            )
          }
        }
      )
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'GET',
          path: `/api/routes`,
        }
      )).then(res => checkResponse(res, body => JSON.decode(body)))
    }
  }

  function getRoute(ep, path) {
    if (ep === app.endpoint.id) {
      if (!path.endsWith('/')) path += '/'
      var route = localRoutes.find(r => r.path === path)
      if (route) {
        return mesh.discover(route.service.endpoint.id).then(
          list => ({
            path: removeSlash(route.path),
            service: {
              name: route.service.name,
              kind: route.service.kind,
              endpoint: list.length > 0 ? list[0] : route.service.endpoint,
            },
            cors: route.cors || null,
          })
        )
      } else {
        return Promise.resolve(null)
      }
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'GET',
          path: os.path.join(`/api/routes`, path),
        }
      )).then(res => checkResponse(res, body => JSON.decode(body)))
    }
  }

  function setRoute(ep, path, info) {
    if (ep === app.endpoint.id) {
      checkPath(path)
      checkRoute(info)
      if (!path.endsWith('/')) path += '/'
      var service = {
        name: info.service.name,
        kind: info.service.kind,
        endpoint: { id: info.service.endpoint.id },
      }
      var cors = info.cors || null
      var i = localRoutes.findIndex(r => r.path >= path)
      if (localRoutes[i]?.path === path) {
        localRoutes[i].service = service
        localRoutes[i].cors = cors
      } else if (i < 0) {
        localRoutes.push({ path, service, cors })
      } else {
        localRoutes.splice(i, 0, { path, service, cors })
      }
      saveLocalConfig()
      return Promise.resolve()
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'POST',
          path: os.path.join(`/api/routes`, path),
        },
        JSON.encode(info)
      )).then(checkResponse)
    }
  }

  function deleteRoute(ep, path) {
    if (ep === app.endpoint.id) {
      if (!path.endsWith('/')) path += '/'
      var i = localRoutes.findIndex(r => r.path === path)
      if (i >= 0) {
        localRoutes.splice(i, 1)
      }
      saveLocalConfig()
      return Promise.resolve()
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'DELETE',
          path: os.path.join(`/api/routes`, path),
        }
      )).then(checkResponse)
    }
  }

  var $route
  var $origin

  var forwardService = pipeline($=>$
    .pipe(evt => {
      if (evt instanceof MessageStart) {
        var url = new URL(evt.head.path)
        var path = url.pathname
        if (path.startsWith('/svc/')) path = path.substring(4)
        var path2 = path.endsWith('/') ? path : path + '/'
        if ($route = localRoutes.findLast(r => path2.startsWith(r.path))) {
          $origin = evt.head.headers.origin
          if (evt.head.method === 'OPTIONS') return 'options'
          var service = $route.service
          var basePath = `/api/forward/${service.kind}/${URL.encodeComponent(service.name)}`
          var servicePath = path.substring($route.path.length)
          evt.head.path = os.path.join(basePath, servicePath) + url.search
          app.log(`Route to service ${service.name}: ${evt.head.method} ${os.path.join('/', servicePath)}${url.search} ${stringifyHeaders(evt.head.headers)}`)
          return ($route.service.endpoint.id === app.endpoint.id ? 'local' : 'remote')
        } else {
          return '404'
        }
      }
    }, {
      'options': ($=>$
        .replaceData()
        .replaceMessage(() => {
          var headers = {}
          if ($route.service.kind === 'tool') {
            headers['access-control-allow-methods'] = '*'
            headers['access-control-allow-headers'] = 'Content-Type, Mcp-Session-Id, Mcp-Protocol-Version'
          }
          var cors = $route?.cors
          if (cors) {
            if (cors.allowMethods) headers['access-control-allow-methods'] = cors.allowMethods.join(', ')
            if (cors.allowHeaders) headers['access-control-allow-headers'] = cors.allowHeaders.join(', ')
          }
          return new Message({ headers })
        })
        .pipe(() => cors)
      ),
      'remote': ($=>$
        // Stay in HTTP/1.x for now due to some incompatibility issues
        // caused by HTTP/2 compliance check, e.g. pseudo headers (such as "Host")
        // are not allowed after regular headers in HTTP/2 while it is actually possible
        // in a message translated from HTTP/1.x
        .muxHTTP(() => $route, { version: 1 }).to($=>$
          .pipe(() => mesh.connect($route.service.endpoint.id))
        )
        .pipe(() => cors)
      ),
      'local': $=>$.pipe(() => connectService).pipe(() => cors),
      '404': $=>$.replaceData().replaceMessage(new Message({ status: 404 })),
    })
  )

  var cors = pipeline($=>$
    .handleMessageStart(
      msg => {
        var cors = $route?.cors
        if (cors && cors.allowOrigins?.includes?.($origin)) {
          msg.head.headers ??= {}
          msg.head.headers['access-control-allow-origin'] = $origin
          if ($route.service.kind === 'tool') {
            msg.head.headers['access-control-expose-headers'] = 'Mcp-Session-Id'
          }
        }
      }
    )
  )

  var matchApiForwardKindName = new http.Match('/api/forward/{kind}/{name}')
  var matchApiForwardKindNameStar = new http.Match('/api/forward/{kind}/{name}/*')

  var $service
  var $servicePath
  var $serviceQuery

  var connectService = pipeline($=>$
    .pipe(evt => {
      if (evt instanceof MessageStart) {
        var url = new URL(evt.head.path)
        var params = matchApiForwardKindNameStar(url.pathname) || matchApiForwardKindName(url.pathname)
        if (params) {
          var kind = params.kind
          var name = URL.decodeComponent(params.name)
          var base = os.path.join('/api/forward', kind, name)
          $service = localServices[kind]?.[name]
          $servicePath = url.path.substring(base.length)
          $serviceQuery = url.search
        }
        if (!$service) return '404'
        switch ($service.protocol) {
          case 'http': return connectHTTP
          case 'mcp': return connectMCP
          default: return '400'
        }
      }
    }, {
      '400': $=>$.replaceMessage(new Message({ status: 400 })),
      '404': $=>$.replaceMessage(new Message({ status: 404 })),
    })
  )

  var $httpURL

  var connectHTTP = pipeline($=>$
    .pipe(
      evt => {
        if (evt instanceof MessageStart) {
          $httpURL = new URL($service.target.address)
          var path = $servicePath === '' ? $httpURL.pathname : os.path.join($httpURL.pathname, $servicePath)
          if ($serviceQuery) {
            path += $serviceQuery
            if ($httpURL.query) {
              path += '&' + $httpURL.query
            }
          } else {
            path += $httpURL.search
          }
          evt.head.path = path
          evt.head.headers.host = $httpURL.host
          var headers = $service.target.headers
          if (headers && typeof headers === 'object') Object.assign(evt.head.headers, headers)
          return 'proxy'
        }
      }, {
        'proxy': ($=>$
          .pipe(() => $service.target.body ? 'merge' : 'bypass', {
            'merge': $=>$.replaceMessageBody(
              body => {
                try {
                  return JSON.encode(
                    mergeObjects(
                      JSON.decode(body),
                      $service.target.body,
                    )
                  )
                } catch {
                  return body
                }
              }
            ),
            'bypass': $=>$,
          })
          .handleMessageStart(msg => {
            app.log(`Forward to service ${$service.target.address}: ${msg.head.method} ${msg.head.path} ${stringifyHeaders(msg.head.headers)} ${msg.body?.toString?.()}`)
          })
          .muxHTTP(() => $service).to($=>$
            .pipe(() => $httpURL.protocol, {
              'http:': ($=>$
                .connect(() => $httpURL.hostname + ':' +  $httpURL.port)
              ),
              'https:': ($=>$
                .connectTLS({ sni: () => $httpURL.hostname }).to($=>$
                  .connect(() => $httpURL.hostname + ':' + $httpURL.port)
                )
              ),
            })
          )
          .handleMessageStart(msg => {
            app.log(`Response from service ${$service.target.address}: ${msg.head.status} ${msg.head.statusText} ${stringifyHeaders(msg.head.headers)}`)
          })
        ),
      }
    )
  )

  var mcpSessions = {}
  var mcpStreams = {}

  var $mcpSessionID
  var $mcpSession
  var $mcpStream

  var connectMCP = pipeline($=>$
    .pipe(
      evt => {
        if (evt instanceof MessageStart && $servicePath === '') {
          if (evt.head.method === 'OPTIONS') return 'options'
          var head = evt.head
          $mcpSessionID = head.headers['mcp-session-id']
          $mcpSession = $mcpSessionID && mcpSessions[$mcpSessionID]
          switch (head.method) {
            case 'GET':
              if (!$mcpSessionID) return '400'
              if (!$mcpSession) return '404'
              if ($mcpSession.upstream.transport === 'streamable') return forwardMCP
              var lastEventID = head.headers['last-event-id']
              if (lastEventID) {
                $mcpStream = mcpStreams[lastEventID]
                if ($mcpStream) {
                  new Timeout(0.1).wait().then(() => $mcpStream.replay(lastEventID))
                  return 'receive'
                } else {
                  return '404'
                }
              } else {
                $mcpStream = $mcpSession.listenStream
                return 'receive'
              }
            case 'POST':
              if (!$mcpSession) return initMCP
              if ($mcpSession.upstream.transport === 'streamable') return forwardMCP
              return sendMCP
            case 'DELETE':
              if (!$mcpSessionID) return '400'
              if (!$mcpSession) return '404'
              $mcpSession.terminate()
              return '204'
            default: return '405'
          }
        }
        return '404'
      }, {
        '204': $=>$.replaceData().replaceMessage(new Message({ status: 204 })),
        '400': $=>$.replaceData().replaceMessage(new Message({ status: 400 })),
        '404': $=>$.replaceData().replaceMessage(new Message({ status: 404 })),
        '405': $=>$.replaceData().replaceMessage(new Message({ status: 405 })),
        'receive': $=>$.swap(() => $mcpStream.output),
      }
    )
  )

  var forwardMCP = pipeline($=>$
    .handleMessageStart(msg => {
      msg.head.path = $mcpSession.upstream.url.path
      delete msg.head.headers['mcp-session-id']
      var sessionID = $mcpSession.upstream.session
      if (sessionID) msg.head.headers['Mcp-Session-Id'] = sessionID
    })
    .muxHTTP().to($=>$
      .connect(() => $mcpSession.upstream.url.hostname + ':' + $mcpSession.upstream.url.port)
    )
    .handleMessageStart(msg => {
      msg.head.headers['Mcp-Session-Id'] = $mcpSession.id
    })
  )

  var initMCP = pipeline($=>$
    .replaceMessage(
      msg => {
        try {
          msg = JSON.decode(msg.body)
          if (msg?.method === 'initialize') {
            $mcpSession = MCPSession()
            return $mcpSession.init($service, msg).then(
              result => {
                if (result) {
                  $mcpSession.start()
                  return new Message(
                    {
                      status: 200,
                      headers: {
                        'Content-Type': 'application/json',
                        'Mcp-Session-Id': $mcpSession.id
                      },
                    },
                    JSON.encode(result)
                  )
                } else {
                  return new Message({ status: 503 })
                }
              }
            )
          }
        } catch {}
        return new Message({ status: $mcpSessionID ? 404 : 400 })
      }
    )
  )

  var sendMCP = pipeline($=>$
    .replaceMessage(msg => {
      try {
        $mcpStream = $mcpSession.send(JSON.decode(msg.body))
      } catch {}
      return new Message
    })
    .pipe(() =>  $mcpStream ? 'receive' : 'done', {
      'receive': $=>$.swap(() => $mcpStream.output),
      'done': $=>$.replaceMessage(new Message({ status: 202 })),
    })
  )

  function MCPSession() {
    var self = null
    var id = algo.uuid()
    var listenStream = MCPStream()
    var upstream = {}
    var agent = null
    var pendingRequests = new algo.Cache
    var lastActiveTime = Date.now()
    var terminated = false
    var stdioExecutablePath
    var stdioExecutableArgv
    var stdioExecutableEnv
    var stdioInput = null
    var ssePathPOST = ''
    var sseStartCallback = null
    var initCallback = null
    var initRequestID

    function init(svc, msg) {
      var address = svc.target.address
      if (isFilePath(address)) {
        upstream.transport = 'stdio'
        stdioExecutablePath = address
        stdioExecutableArgv = svc.target.argv || []
        stdioExecutableEnv = svc.target.env
        stdioInput = new pipeline.Hub
        writeStdio.spawn()
        stdioInput.broadcast(new Message(JSON.encode(msg)))
        initRequestID = msg.id
        return new Promise(resolve => { initCallback = resolve })
      } else {
        upstream.url = new URL(address)
        agent = new http.Agent(upstream.url.host)
        var headers = {
          'Host': upstream.url.host,
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        }
        return agent.request('POST', upstream.url.path, headers, JSON.encode(msg)).then(
          res => {
            var status = res?.head?.status
            if (200 <= status && status < 300) {
              try {
                if (res.head.headers?.['content-type']?.startsWith?.('text/event-stream')) {
                  var line = res.body.toString().split('\n').find(line => line.startsWith('data:'))
                  if (line) {
                    var result = JSON.parse(line.substring(5))
                  }
                } else {
                  var result = JSON.decode(res.body)
                }
                if (result?.jsonrpc === '2.0' && result?.id === msg.id) {
                  upstream.transport = 'streamable'
                  upstream.session = res.head.headers['mcp-session-id']
                  return result
                }
              } catch {}
              return null
            } else {
              return new Promise(resolve => {
                sseStartCallback = resolve
                readSSE.spawn()
              }).then(() => {
                if (ssePathPOST) {
                  upstream.transport = 'sse'
                  initRequestID = msg.id
                  agent.request(
                    'POST', ssePathPOST, {
                      'Host': upstream.url.host,
                      'Content-Type': 'application/json',
                    }, JSON.encode(msg)
                  ).then(
                    res => {
                      var status = res?.head?.status
                      if (status < 200 || status >= 300) {
                        initCallback?.(null)
                        initCallback = null
                      }
                    }
                  )
                  return new Promise(resolve => { initCallback = resolve })
                } else {
                  return null
                }
              })
            }
          }
        )
      }
    }

    function start() {
      mcpSessions[id] = self
      keepAlive()
      checkTimeout()
      app.log(`Session ${id} started`)
    }

    function send(msg) {
      keepAlive()
      var stream = null
      var batch = msg instanceof Array ? msg : [msg]
      var requests = batch.filter(msg => msg && typeof msg === 'object' && 'id' in msg)
      if (requests.length > 0) {
        stream = MCPStream(requests)
        requests.forEach(msg => pendingRequests.set(msg.id, stream))
      }
      switch (upstream.transport) {
        case 'stdio':
          stdioInput.broadcast(
            new Message(JSON.encode(msg))
          )
          break
        case 'sse':
          if (ssePathPOST) {
            agent.request(
              'POST', ssePathPOST, {
                'Host': upstream.url.host,
                'Content-Type': 'application/json',
              }, JSON.encode(msg)
            ).then(
              res => {
                var status = res?.head?.status
                if (status < 200 || status >= 300) {
                  stream?.error()
                }
              }
            )
          }
          break
      }
      return stream
    }

    function receive(msg) {
      keepAlive()
      var batch = msg instanceof Array ? msg : [msg]
      batch.forEach(msg => {
        if (msg && typeof msg === 'object') {
          if ('id' in msg) {
            if (msg.id === initRequestID) {
              initCallback?.(msg)
              initCallback = null
            } else {
              var stream = pendingRequests.get(msg.id)
              if (stream) stream.queue(msg)
              pendingRequests.remove(msg.id)
            }
          } else {
            listenStream.queue(msg)
          }
        }
      })
    }

    function keepAlive() {
      lastActiveTime = Date.now()
    }

    function checkTimeout() {
      new Timeout(10).wait().then(() => {
        if (Date.now() - lastActiveTime > 300 * 1000) {
          app.log(`Session ${id} timeout`)
          terminate()
        } else if (!terminated) {
          checkTimeout()
        }
      })
    }

    function terminate() {
      if (upstream.transport === 'stdio') {
        stdioInput.broadcast(new StreamEnd)
      }
      delete mcpSessions[id]
      terminated = true
      app.log(`Session ${id} terminated`)
    }

    var $stdioState

    var writeStdio = pipeline($=>$
      .onStart(new Data)
      .swap(() => stdioInput)
      .replaceMessage(
        msg => {
          if (!$stdioState) {
            var req = JSON.decode(msg.body)
            $stdioState = { initMsgID: req.id }
          }
          var data = msg.body
          data.push('\n')
          return data
        }
      )
      .exec(() => [stdioExecutablePath, ...stdioExecutableArgv], {
        env: () => stdioExecutableEnv,
        onStart: (pid) => app.log(`Child process started (pid = ${pid}): ${stdioExecutablePath}`),
        onExit: (code, err) => {
          app.log(`Child process exited with result ${code}: ${stdioExecutablePath}`)
          if ($stdioState.initMsgID !== undefined) {
            if (err) {
              var text = err.toString()
              var lines = text.split('\n')
              if (lines.length > 500) lines.splice(0, lines.length - 500)
              lines.forEach(line => app.log(line))
            }
            receive({
              jsonrpc: '2.0',
              id: $stdioState.initMsgID,
              error: {
                code,
                message: 'MCP server process exited',
                data: { stderr: text || '' },
              }
            })
            delete $stdioState.initMsgID
          }
        },
      })
      .split('\n')
      .handleMessage(
        msg => {
          try {
            receive(JSON.decode(msg.body))
            $stdioState.initMsgID = undefined
          } catch {}
        }
      )
    )

    var $sseEvent = ''
    var $sseData = ''

    var readSSE = pipeline($=>$
      .onStart(() => new Message({
        method: 'GET',
        path: upstream.url.path,
        headers: {
          'Host': upstream.url.host,
          'Accept': 'text/event-stream',
        },
      }))
      .repeat(() => {
        if (ssePathPOST) {
          return new Timeout(1).wait().then(true)
        } else {
          return false
        }
      }).to($=>$
        .muxHTTP().to($=>$
          .connect(() => upstream.url.hostname + ':' + upstream.url.port)
        )
        .split('\n')
        .handleMessage(msg => {
          var line = msg.body.toString().trim()
          if (line.length === 0) {
            switch ($sseEvent) {
              case 'endpoint':
                ssePathPOST = $sseData
                sseStartCallback?.()
                sseStartCallback = null
                break
              case 'message':
                try {
                  receive(JSON.parse($sseData))
                } catch {}
                break
            }
            $sseEvent = ''
            $sseData = ''
          } else if (line.startsWith('event:')) {
            $sseEvent = line.substring(6).trim()
          } else if (line.startsWith('data:')) {
            $sseData = line.substring(5).trim()
          }
        })
        .handleStreamEnd(() => {
          sseStartCallback?.()
          sseStartCallback = null
        })
      )
    )

    return (self = {
      id,
      listenStream,
      upstream,
      init,
      start,
      send,
      terminate,
    })
  }

  function MCPStream(requests) {
    var output = new pipeline.Hub
    var hasSent = false
    var pending = new Set((requests || []).map(msg => msg.id))

    function queue(msg) {
      var buf = []
      if (!hasSent) {
        buf.push(new MessageStart({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          isChunked: true,
        }))
        hasSent = true
      }
      var data = new Data
      data.push('event: message\r\ndata: ')
      data.push(JSON.encode(msg))
      data.push('\r\n\r\n')
      buf.push(data)
      if (msg instanceof Array) {
        msg.forEach(m => pending.delete(m.id))
      } else {
        pending.delete(msg.id)
      }
      if (pending.size === 0) {
        buf.push(new MessageEnd)
        buf.push(new StreamEnd)
      }
      output.broadcast(buf)
    }

    function replay(last) {

    }

    function error() {

    }

    return {
      output,
      queue,
      replay,
      error,
    }
  }

  function getServiceFilePathname(username, ep, kind, name) {
    if (!username) {
      return `/shared/`
    } else if (!ep) {
      return `/shared/${username}/`
    } else if (!kind) {
      return `/shared/${username}/${ep}/`
    } else if (!name) {
      return `/shared/${username}/${ep}/${kind}/`
    } else {
      return `/shared/${username}/${ep}/${kind}/${name}/service.json`
    }
  }

  function findLocalRoutes(ep, kind, name) {
    return localRoutes.filter(
      r => (
        r.path &&
        r.service.name === name &&
        r.service.kind === kind &&
        r.service.endpoint.id === ep
      )
    ).map(
      r => ({
        path: removeSlash(r.path),
      })
    )
  }

  function saveLocalConfig() {
    mesh.write(CONFIG_PATHNAME, JSON.encode({
      services: localServices,
      routes: localRoutes.map(
        r => ({
          path: r.path,
          service: r.service,
          cors: r.cors,
        })
      ),
    }))
  }

  function publishService(kind, name, info) {
    mesh.write(
      getServiceFilePathname(app.username, app.endpoint.id, kind, name),
      JSON.encode({
        protocol: info.protocol,
        metainfo: info.metainfo,
      })
    )
  }

  function unpublishService(kind, name) {
    mesh.erase(
      getServiceFilePathname(app.username, app.endpoint.id, kind, name)
    )
  }

  mesh.read(CONFIG_PATHNAME).then(
    data => {
      try {
        var info = JSON.decode(data)
      } catch {}
      var services = info?.services
      var routes = info?.routes
      if (services && typeof services === 'object') {
        localServices = services
        Object.entries(localServices).forEach(
          ([kind, services]) => Object.entries(services).forEach(
            ([name, service]) => publishService(kind, name, service)
          )
        )
      }
      if (routes instanceof Array) {
        localRoutes = routes.filter(
          r => (
            typeof r === 'object' && r &&
            typeof r.path === 'string' &&
            typeof r.service === 'object' &&
            typeof r.service.name === 'string' &&
            typeof r.service.kind === 'string' &&
            typeof r.service.endpoint?.id === 'string'
          )
        )
        localRoutes.forEach(r => {
          if (!r.path.endsWith('/')) {
            r.path += '/'
          }
        })
      }
    }
  )

  return {
    allServices,
    getService,
    setService,
    deleteService,
    allRoutes,
    getRoute,
    setRoute,
    deleteRoute,
    forwardService,
    connectService,
  }
}

function removeSlash(path) {
  if (path.endsWith('/')) {
    return path.substring(0, path.length - 1)
  } else {
    return path
  }
}

function mergeObjects(a, b) {
  Object.entries(b).forEach(
    ([k, v]) => {
      if (v && typeof v === 'object') {
        var val = a[k]
        if (val && typeof val === 'object') {
          return mergeObjects(val, v)
        }
      }
      a[k] = v
    }
  )
  return a
}

function stringifyHeaders(headers) {
  return Object.entries(headers).map(
    ([k, v]) => k + '=' + v
  ).join(' ')
}

function isFilePath(str) {
  if (str.startsWith('/')) return true
  var drive = str.charCodeAt(0)
  if (
    (67 <= drive && drive <= 90) || // C..Z
    (99 <= drive && drive <= 122)   // c..z
  ) {
    str = str.substring(1)
    if (str.startsWith(':\\') || str.startsWith(':/')) return true
  }
  return false
}

function checkName(name) {
  if (typeof name !== 'string') throw `invalid name`
  if (name === '') throw `invalid empty name`
}

function checkKind(kind) {
  switch (kind) {
    case 'llm':
    case 'tool':
      return
    default: throw `invalid kind '${kind}'`
  }
}

function checkProtocol(protocol) {
  switch (protocol) {
    case 'http':
    case 'mcp':
      return
    default: throw `invalid protocol '${protocol}'`
  }
}

function checkMetainfo(info) {
  if (!info) return
  if (typeof info !== 'object') throw `invalid metainfo`
  checkStringObject(info, 'metainfo')
}

function checkTarget(info) {
  if (typeof info !== 'object') throw `invalid target`
  if (!info.address) throw `missing target.address`
  Object.entries(info).forEach(
    ([k, v]) => {
      switch (k) {
        case 'address': return checkAddress(v)
        case 'headers': return checkStringObject(v, 'target.headers')
        case 'body': return checkObject(v, 'target.body')
        case 'argv': return checkStringArray(v, 'target.argv')
        case 'env': return checkStringObject(v, 'target.env')
        default: throw `redundant field 'target.${k}'`
      }
    }
  )
}

function checkObject(obj, prefix) {
  if (obj && typeof obj !== 'object') throw `object required in '${prefix}'`
}

function checkArray(obj, prefix) {
  if (obj && !(obj instanceof Array)) throw `array required in '${prefix}'`
}

function checkStringObject(obj, prefix) {
  checkObject(obj, prefix)
  if (obj) {
    Object.entries(obj).forEach(
      ([k, v]) => {
        if (typeof v !== 'string') {
          throw `invalid ${prefix}.${k}`
        }
      }
    )
  }
}

function checkStringArray(obj, prefix) {
  checkArray(obj, prefix)
  if (obj) {
    obj.forEach(
      (e, i) => {
        if (typeof e !== 'string') {
          throw `invalid ${prefix}[${i}]`
        }
      }
    )
  }
}

function checkAddress(addr) {
  if (typeof addr !== 'string') throw `invalid address`
  if (isFilePath(addr)) return
  if (addr.startsWith('http://') || addr.startsWith('https://')) {
    var url = new URL(addr)
    if (url.hostname === '') throw `malformed URL '${addr}'`
    return
  }
  throw `invalid address '${addr}'`
}

function checkPath(path) {
  if (
    typeof path !== 'string' ||
    path.length <= 1 ||
    !path.startsWith('/')
  ) throw `invalid path '${path}'`
}

function checkUUID(uuid) {
  if (
    typeof uuid !== 'string' ||
    uuid.length !== 36 ||
    uuid.charAt(8) != '-' ||
    uuid.charAt(13) != '-' ||
    uuid.charAt(18) != '-' ||
    uuid.charAt(23) != '-'
  ) throw `malformed UUID '${uuid}'`
}

function checkService(info) {
  if (!info.protocol) throw `missing protocol`
  if (!info.target?.address) throw `missing target.address`
  checkProtocol(info.protocol)
  checkMetainfo(info.metainfo)
  checkTarget(info.target)
}

function checkCORS(info) {
  if (info) {
    Object.entries(info).forEach(
      ([k, v]) => {
        switch (k) {
          case 'allowOrigins': return checkStringArray(v, 'cors.allowOrigins')
          case 'allowMethods': return checkStringArray(v, 'cors.allowMethods')
          case 'allowHeaders': return checkStringArray(v, 'cors.allowHeaders')
          default: throw `redundant field 'cors.${k}'`
        }
      }
    )
  }
}

function checkRoute(info) {
  checkCORS(info.cors)
  checkName(info.service?.name)
  checkKind(info.service?.kind)
  checkUUID(info.service?.endpoint?.id)
}
