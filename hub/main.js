#!/usr/bin/env -S pipy --skip-unknown-arguments

import options from './options.js'

var opt = options({
  defaults: {
    '--help': false,
    '--listen': '0.0.0.0:8888',
  },
  shorthands: {
    '-h': '--help',
    '-l': '--listen',
  },
})

if (options['--help']) {
  println('Options:')
  println('  -h, --help      Show available options')
  println('  -l, --listen    Port number to listen (default: 0.0.0.0:8888)')
  return
}

var routes = Object.entries({

  '/api/status': {
    'POST': () => findCurrentEndpointSession() ? postStatus : noSession,
  },

  '/api/endpoints': {
    'GET': () => getEndpoints,
  },

  '/api/endpoints/{ep}': {
    'GET': () => getEndpoint,
    'CONNECT': () => connectEndpoint,
  },

  '/api/endpoints/{ep}/services': {
    'GET': () => getServices,
  },

  '/api/endpoints/{ep}/services/{proto}/{svc}': {
    'CONNECT': () => connectService,
  },

  '/api/services': {
    'GET': () => getServices,
    'POST': () => findCurrentEndpointSession() ? postServices : noSession,
  },

  '/api/services/{proto}/{svc}': {
    'GET': () => getService,
  },

  '/api/forward/{ep}/*': {
    'GET': () => forwardRequest,
    'POST': () => forwardRequest,
    'DELETE': () => forwardRequest,
  },

}).map(
  function ([path, methods]) {
    var match = new http.Match(path)
    var handler = function (params, req) {
      var f = methods[req.head.method]
      if (f) return f(params, req)
      return notSupported
    }
    return { match, handler }
  }
)

var endpoints = {}
var hubs = {}

function endpointName(id) {
  var ep = endpoints[id]
  return ep?.name ? `${ep.name} (uuid = ${id})` : id
}

var $agent = null
var $params = null
var $endpoint = null
var $hub = null
var $hubAddr
var $hubPort

pipy.listen(opt['--listen'], $=>$
  .onStart(
    function (ib) {
      $agent = {
        ip: ib.remoteAddress,
        port: ib.remotePort,
      }
      $hubAddr = ib.localAddress
      $hubPort = ib.localPort
    }
  )
  .demuxHTTP().to($=>$
    .pipe(
      function (evt) {
        if (evt instanceof MessageStart) {
          var path = evt.head.path
          var route = routes.find(r => Boolean($params = r.match(path)))
          if (route) return route.handler($params, evt)
          return notFound
        }
      }
    )
  )
)

var postStatus = pipeline($=>$
  .replaceMessage(
    function (req) {
      var info = JSON.decode(req.body)
      Object.assign(
        $endpoint, {
          name: info.name,
          heartbeat: Date.now(),
        }
      )
      return new Message({ status: 201 })
    }
  )
)

var getEndpoints = pipeline($=>$
  .replaceData()
  .replaceMessage(
    () => response(200, Object.values(endpoints).map(
      ep => ({
        id: ep.id,
        name: ep.name,
        certificate: ep.certificate,
        ip: ep.ip,
        port: ep.port,
        heartbeat: ep.heartbeat,
        status: 'OK',
      })
    ))
  )
)

var getEndpoint = pipeline($=>$
  .replaceData()
  .replaceMessage(
    function () {
      var ep = endpoints[$params.ep]
      if (!ep) return response(404)
      return response(200, {
        id: ep.id,
        name: ep.name,
        certificate: ep.certificate,
        ip: ep.ip,
        port: ep.port,
        hubs: ep.hubs,
        heartbeat: ep.heartbeat,
        status: 'OK',
      })
    }
  )
)

var getServices = pipeline($=>$
  .replaceData()
  .replaceMessage(
    function () {
      var services = []
      var collect = (ep) => {
        ep.services?.forEach?.(
          function (svc) {
            var name = svc.name
            var protocol = svc.protocol
            var s = services.find(s => s.name === name && s.protocol === protocol)
            if (!s) services.push(s = { name, protocol, endpoints: [] })
            s.endpoints.push({ id: ep.id, name: ep.name })
          }
        )
      }
      if ($params.ep) {
        var ep = endpoints[$params.ep]
        if (ep) collect(ep)
      } else {
        Object.values(endpoints).forEach(collect)
      }
      return response(200, services)
    }
  )
)

var postServices = pipeline($=>$
  .replaceMessage(
    function (req) {
      var services = JSON.decode(req.body)
      var oldList = $endpoint.services || []
      var newList = services instanceof Array ? services : []
      var who = endpointName($endpoint.id)
      newList.forEach(({ name, protocol }) => {
        if (!oldList.some(s => s.name === name && s.protocol === protocol)) {
          console.info(`Service ${name} published by ${who}`)
        }
      })
      oldList.forEach(({ name, protocol }) => {
        if (!newList.some(s => s.name === name && s.protocol === protocol)) {
          console.info(`Service ${name} deleted by ${who}`)
        }
      })
      $endpoint.services = newList
      return new Message({ status: 201 })
    }
  )
)

var getService = pipeline($=>$
  .replaceData()
  .replaceMessage(
    function () {
      var name = $params.svc
      var protocol = $params.proto
      var providers = Object.values(endpoints).filter(
        ep => ep.services.some(s => s.name === name && s.protocol === protocol)
      )
      if (providers.length === 0) return response(404)
      return response(200, {
        name,
        protocol,
        endpoints: providers.map(({ id, name }) => ({ id, name })),
      })
    }
  )
)

var muxToAgent = pipeline($=>$
  .muxHTTP(() => $hub, { version: 2 }).to($=>$
    .swap(() => $hub)
  )
)

var connectEndpoint = pipeline($=>$
  .acceptHTTPTunnel(
    function () {
      var id = $params.ep
      $agent.id = id
      $hub = hubs[id] = new pipeline.Hub
      console.info(`Endpoint ${endpointName(id)} joined`)
      return response(200)
    }
  ).to($=>$
    .onStart(new Data)
    .swap(() => $hub)
    .onEnd(() => console.info(`Endpoint ${endpointName($agent.id)} left`))
  )
)

var connectService = pipeline($=>$
  .acceptHTTPTunnel(
    function () {
      var id = $params.ep
      var ep = endpoints[id]
      if (!ep) return response(404, 'Endpoint not found')
      var svc = $params.svc
      var proto = $params.proto
      if (!ep.services.some(s => s.name === svc && s.protocol === proto)) return response(404, 'Service not found')
      $hub = hubs[id]
      if (!$hub) return response(404, 'Agent not found')
      console.info(`Forward to ${svc} at ${endpointName(id)}`)
      return response(200)
    }
  ).to($=>$
    .connectHTTPTunnel(
      () => new Message({
        method: 'CONNECT',
        path: `/api/services/${$params.proto}/${$params.svc}`,
      })
    ).to(muxToAgent)
  )
)

var forwardRequest = pipeline($=>$
  .pipe(
    function (req) {
      if (req instanceof MessageStart) {
        var id = $params.ep
        var ep = endpoints[id]
        if (!ep) return notFound
        $hub = hubs[id]
        if (!$hub) return notFound
        var path = $params['*']
        req.head.path = `/api/${path}`
        return muxToAgent
      }
    }
  )
)

var notFound = pipeline($=>$
  .replaceData()
  .replaceMessage(response(404))
)

var notSupported = pipeline($=>$
  .replaceData()
  .replaceMessage(response(405))
)

var noSession = pipeline($=>$
  .replaceData()
  .replaceMessage(response(404, 'No agent session established yet'))
)

function findCurrentEndpointSession() {
  if (!$agent.id) return false
  $endpoint = endpoints[$agent.id]
  if (!$endpoint) {
    $endpoint = endpoints[$agent.id] = { ...$agent, services: [] }
    $endpoint.hubs = [`${$hubAddr}:${$hubPort}`]
  }
  return true
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
