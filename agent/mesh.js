import db from './db.js'

export default function (meshName, agent, bootstraps) {
  var services = []

  //
  // Class Hub
  // Management of the interaction with a single hub instance
  //

  function Hub(
    agent,    // Agent { id, name, certificate, privateKey }
    address,  // Hub address
    serve,    // Agent service pipeline
  ) {

    //
    //    requestHub ---\
    //                   \-->
    //                        hubSession <---> Hub
    //                   /---
    // reverseServer <--/
    //

    var $response

    // Agent-to-hub connection, multiplexed with HTTP/2
    var hubSession = pipeline($=>$
      .muxHTTP(() => '', { version: 2 }).to($=>$
        .connect(address, {
          onState: function (ob) {
            if (ob.state === 'connected' && serviceList) {
              updateServiceList(serviceList)
            }
          }
        })
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
      .repeat(() => new Timeout(5).wait().then(true)).to($=>$
        .loop($=>$
          .connectHTTPTunnel(
            new Message({
              method: 'CONNECT',
              path: `/api/endpoints/${agent.id}`,
            })
          )
          .to(hubSession)
          .pipe(serve)
        )
      )
    )

    // Establish a pull session to the hub
    reverseServer.spawn()

    var serviceList = null
    var serviceListUpdateMsg = null

    function updateServiceList(list) {
      serviceList = list
      var isSending = Boolean(serviceListUpdateMsg)
      serviceListUpdateMsg = new Message(
        {
          method: 'POST',
          path: `/api/services`,
        },
        JSON.encode(list)
      )
      if (!isSending) sendServiceList()
    }

    function sendServiceList() {
      if (serviceListUpdateMsg) {
        requestHub.spawn(serviceListUpdateMsg).then(
          function (res) {
            if (res && res.head.status === 201) {
              serviceListUpdateMsg = null
            } else {
              new Timeout(5).wait().then(sendServiceList)
            }
          }
        )
      }
    }

    function heartbeat() {
      requestHub.spawn(
        new Message(
          { method: 'POST', path: '/api/status' },
          JSON.encode({ name: agent.name })
        )
      )
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

    function status() {
      return 'OK'
    }

    function leave() {
    }

    return {
      heartbeat,
      updateServiceList,
      discoverEndpoints,
      discoverServices,
      findEndpoint,
      findService,
      status,
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
          var body = JSON.decode(req.body)
          publishService(params.proto, params.svc, body.host, body.port)
          db.setService(meshName, params.proto, params.svc, body)
          return response(201, db.getService(meshName, params.proto, params.svc))
        },

        'DELETE': function (params) {
          deleteService(params.proto, params.svc)
          db.delService(meshName, params.proto, params.svc)
          return response(204)
        },
      },

      '/api/ports': {
        'GET': function () {
          return response(200, db.allPorts(meshName))
        },
      },

      '/api/ports/{ip}/{proto}/{port}': {
        'GET': function (params) {
          var port = Number.parseInt(params.port)
          return response(200, db.getPort(meshName, params.ip, params.proto, port))
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
          if (route) return route.handler(params, req)
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
            console.info(`Proxy to local service ${name}`)
            return response200
          }
          console.info(`Local service ${name} not found`)
        }
        return response404
      }
    ).to($=>$
      .connect(() => `${$requestedService.host}:${$requestedService.port}`)
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
        .onStart(() => console.info(`Proxy to ${svc} at endpoint ${$selectedEp} via ${$selectedHub}`))
        .connectHTTPTunnel(() => (
          new Message({
            method: 'CONNECT',
            path: `/api/endpoints/${$selectedEp}/services/${proto}/${svc}`,
          })
        )).to($=>$
          .muxHTTP(() => $selectedHub, { version: 2 }).to($=>$
            .connect(() => $selectedHub)
          )
        )
      ),
      'deny': ($=>$
        .onStart(() => console.info($selectedEp ? `No route to endpoint ${$selectedEp}` : `No endpoint found for ${svc}`))
        .replaceData(new StreamEnd)
      ),
    })
  )

  // Connect to all hubs
  var hubs = bootstraps.map(
    addr => Hub(agent, addr, serveHub)
  )

  // Start sending heartbeats
  heartbeat()
  function heartbeat() {
    hubs.forEach(h => h.heartbeat())
    new Timeout(15).wait().then(heartbeat)
  }

  console.info(`Joined ${meshName} as ${agent.name} (uuid = ${agent.id})`)

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
        var hubs = endpoint.hubs
        return hubs ? hubs[0] : null
      }
    )
  }

  function selectHubWithThrow(ep) {
    return selectHub(ep).then(hub => {
      if (!hub) throw `No hub for endpoint ${ep}`
      return hub
    })
  }

  function discoverEndpoints() {
    return hubs[0].discoverEndpoints()
  }

  function discoverServices(ep) {
    return hubs[0].discoverServices(ep)
  }

  function publishService(protocol, name, host, port) {
    var old = services.find(s => s.name === name && s.protocol === protocol)
    if (old) {
      old.host = host
      old.port = port
    } else {
      services.push({
        name,
        protocol,
        host,
        port,
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
    var list = services.map(({ name, protocol }) => ({ name, protocol }))
    hubs.forEach(hub => hub.updateServiceList(list))
  }

  function openPort(ip, protocol, port, service, endpoint) {
    switch (protocol) {
      case 'tcp':
        pipy.listen(`${ip}:${port}`, proxyToMesh(protocol, service, endpoint))
        break
      default: throw `Invalid protocol: ${protocol}`
    }
  }

  function closePort(ip, protocol, port) {
    pipy.listen(`${ip}:${port}`, protocol, null)
  }

  function remoteQueryServices(ep) {
    return selectHubWithThrow(ep).then(
      (hub) => new http.Agent(hub).request(
        'GET', `/api/forward/${ep}/services`
      ).then(
        res => res?.head?.status === 200 ? JSON.decode(res.body) : []
      )
    )
  }

  function remotePublishService(ep, proto, name, host, port) {
    return selectHubWithThrow(ep).then(
      (hub) => new http.Agent(hub).request(
        'POST', `/api/forward/${ep}/services/${proto}/${name}`,
        {}, JSON.encode({ host, port })
      ).then(
        res => res?.head?.status === 201 ? JSON.decode(res.body) : null
      )
    )
  }

  function remoteDeleteService(ep, proto, name) {
    return selectHubWithThrow(ep).then(
      (hub) => new http.Agent(hub).request(
        'DELETE', `/api/forward/${ep}/services/${proto}/${name}`
      )
    )
  }

  function remoteQueryPorts(ep) {
    return selectHubWithThrow(ep).then(
      (hub) => new http.Agent(hub).request(
        'GET', `/api/forward/${ep}/ports`
      ).then(
        res => res?.head?.status === 200 ? JSON.decode(res.body) : []
      )
    )
  }

  function remoteOpenPort(ep, ip, proto, port, target) {
    return selectHubWithThrow(ep).then(
      (hub) => new http.Agent(hub).request(
        'POST', `/api/forward/${ep}/ports/${ip}/${proto}/${port}`,
        {}, JSON.encode({ target })
      ).then(
        res => res?.head?.status === 201 ? JSON.decode(res.body) : null
      )
    )
  }

  function remoteClosePort(ep, ip, proto, port) {
    return selectHubWithThrow(ep).then(
      (hub) => new http.Agent(hub).request(
        'DELETE', `/api/forward/${ep}/ports/${ip}/${proto}/${port}`
      )
    )
  }

  function status() {
    return hubs[0].status()
  }

  function leave() {
    hubs.forEach(hub => hub.leave())
  }

  return {
    agent,
    bootstraps,
    discoverEndpoints,
    discoverServices,
    publishService,
    deleteService,
    openPort,
    closePort,
    remoteQueryServices,
    remotePublishService,
    remoteDeleteService,
    remoteQueryPorts,
    remoteOpenPort,
    remoteClosePort,
    status,
    leave,
  }
}

function response(status, body) {
  if (!body) return new Message({ status })
  if (typeof body === 'string') return responseCT(status, 'text/plain', body)
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
