#!/usr/bin/env -S pipy --args

import options from './options.js'

var opt = options(pipy.argv, {
  defaults: {
    '--help': false,
    '--listen': '0.0.0.0:8888',
    '--name': [],
    '--ca': 'localhost:9999',
  },
  shorthands: {
    '-h': '--help',
    '-l': '--listen',
    '-n': '--name',
  },
})

if (opt['--help']) {
  println('Options:')
  println('  -h, --help    Show available options')
  println('  -l, --listen  Port number to listen (default: 0.0.0.0:8888)')
  println('  -n, --name    Hub address seen by agents (can be more than one)')
  println('      --ca      Address of the certificate authority service')
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

  '/api/endpoints/{ep}/file-data/{hash}': {
    'GET': () => getFileData,
  },

  '/api/endpoints/{ep}/services': {
    'GET': () => getServices,
  },

  '/api/endpoints/{ep}/services/{proto}/{svc}': {
    'CONNECT': () => connectService,
  },

  '/api/filesystem': {
    'GET': () => getFilesystem,
    'POST': () => findCurrentEndpointSession() ? postFilesystem : noSession,
  },

  '/api/filesystem/*': {
    'GET': () => getFileInfo,
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
var sessions = {}
var caAgent = new http.Agent(opt['--ca'])
var caCert = null
var myCert = null
var myKey = null
var myNames = [...opt['--name']]

main()

function main() {
  caAgent.request('GET', '/api/certificates/ca').then(
    function (res) {
      if (res.head.status !== 200) {
        println('cannot retreive the CA certificate')
        pipy.exit(-1)
        return
      }
      caCert = new crypto.Certificate(res.body)
      println('==============')
      println('CA certificate')
      println('==============')
      println(res.body.toString())
      myKey = new crypto.PrivateKey({ type: 'rsa', bits: 2048 })
      var pkey = new crypto.PublicKey(myKey)
      return caAgent.request('POST', '/api/sign/hub/0', null, pkey.toPEM())
    }
  ).then(
    function (res) {
      if (res.head.status !== 200) {
        println('error signing a hub certificate')
        pipy.exit(-1)
        return
      }
      println('===============')
      println('Hub certificate')
      println('===============')
      println(res.body.toString())
      myCert = new crypto.Certificate(res.body)
      start()
    }
  )
}

function endpointName(id) {
  var ep = endpoints[id]
  return ep?.name ? `${ep.name} (uuid = ${id})` : id
}

function isEndpointOnline(ep) {
  if (!sessions[ep.id]?.size) return false
  if (ep.heartbeat + 30*1000 < Date.now()) return false
  return true
}

function isEndpointOutdated(ep) {
  return (ep.heartbeat + 60*1000 < Date.now())
}

var $ctx = null
var $params = null
var $endpoint = null
var $hub = null
var $hubSelected = null
var $pingID

function start() {
  pipy.listen(opt['--listen'], $=>$
    .onStart(
      function (conn) {
        $ctx = {
          ip: conn.remoteAddress,
          port: conn.remotePort,
          via: `${conn.localAddress}:${conn.localPort}`,
        }
      }
    )
    .acceptTLS({
      certificate: {
        cert: myCert,
        key: myKey,
      },
      trusted: [caCert],
      onState: (tls) => {
        if (tls.state === 'connected') {
          $ctx.username = tls.peer?.subject?.commonName
        }
      }
    }).to($=>$
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
  )

  console.info('Hub started at', opt['--listen'])

  function clearOutdatedEndpoints() {
    Object.values(endpoints).filter(ep => isEndpointOutdated(ep)).forEach(
      (ep) => delete endpoints[ep.id]
    )
    new Timeout(60).wait().then(clearOutdatedEndpoints)
  }

  clearOutdatedEndpoints()
}

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
        username: ep.username,
        ip: ep.ip,
        port: ep.port,
        heartbeat: ep.heartbeat,
        online: isEndpointOnline(ep),
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
        username: ep.username,
        certificate: ep.certificate,
        ip: ep.ip,
        port: ep.port,
        hubs: ep.hubs,
        heartbeat: ep.heartbeat,
        online: isEndpointOnline(ep),
      })
    }
  )
)

var getFilesystem = pipeline($=>$
  .replaceData()
  .replaceMessage(
    function () {
      var fs = {}
      Object.values(endpoints).forEach(ep => {
        if (!ep.files) return
        ep.files.forEach(f => {
          updateFileInfo(fs, f, ep.id)
        })
      })
      return response(200, fs)
    }
  )
)

var postFilesystem = pipeline($=>$
  .replaceMessage(
    function (req) {
      var body = JSON.decode(req.body)
      $endpoint.files = Object.entries(body).map(
        ([k, v]) => ({
          pathname: k,
          time: v['T'],
          hash: v['#'],
          size: v['$'],
        })
      )
      return new Message({ status: 201 })
    }
  )
)

var getFileInfo = pipeline($=>$
  .replaceData()
  .replaceMessage(
    function () {
      var fs = {}
      var pathname = '/' + $params['*']
      Object.values(endpoints).forEach(ep => {
        if (!ep.files) return
        ep.files.forEach(f => {
          if (f.pathname === pathname) {
            updateFileInfo(fs, f, ep.id)
          }
        })
      })
      var info = fs[pathname]
      return info ? response(200, info) : response(404)
    }
  )
)

var getFileData = pipeline($=>$
  .pipe(
    function (req) {
      if (req instanceof MessageStart) {
        var id = $params.ep
        var ep = endpoints[id]
        if (!ep) return notFound
        sessions[id]?.forEach?.(h => $hubSelected = h)
        if (!$hubSelected) return notFound
        var hash = $params.hash
        req.head.path = `/api/file-data/${hash}`
        return muxToAgent
      }
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
            s.endpoints.push({ id: ep.id, name: ep.name, users: svc.users })
          }
        )
      }
      if ($params.ep) {
        var ep = endpoints[$params.ep]
        if (ep && isEndpointOnline(ep)) collect(ep)
      } else {
        Object.values(endpoints).filter(isEndpointOnline).forEach(collect)
      }
      return response(200, services)
    }
  )
)

var postServices = pipeline($=>$
  .replaceMessage(
    function (req) {
      var body = JSON.decode(req.body)
      var time = body.time
      var last = $endpoint.servicesUpdateTime
      if (!last || last <= time) {
        var services = body.services
        var oldList = $endpoint.services || []
        var newList = services instanceof Array ? services : []
        var who = endpointName($endpoint.id)
        console.info(`Received service list (length = ${newList.length}) from ${who}`)
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
        $endpoint.servicesUpdateTime = time
      }
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
        ep => isEndpointOnline(ep) && ep.services.some(s => s.name === name && s.protocol === protocol)
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
  .muxHTTP(() => $hubSelected, { version: 2 }).to($=>$
    .swap(() => $hubSelected)
  )
)

var connectEndpoint = pipeline($=>$
  .acceptHTTPTunnel(
    function () {
      var id = $params.ep
      $ctx.id = id
      $hub = new pipeline.Hub
      sessions[id] ??= new Set
      sessions[id].add($hub)
      collectMyNames($ctx.via)
      console.info(`Endpoint ${endpointName(id)} joined, connections = ${sessions[id].size}`)
      return response(200)
    }
  ).to($=>$
    .onStart(new Data)
    .swap(() => $hub)
    .onEnd(() => {
      var id = $ctx.id
      sessions[id]?.delete?.($hub)
      console.info(`Endpoint ${endpointName(id)} left, connections = ${sessions[id]?.size || 0}`)
    })
  )
)

var connectService = pipeline($=>$
  .acceptHTTPTunnel(
    function () {
      var svc = $params.svc
      var proto = $params.proto
      var id = $params.ep
      var ep = endpoints[id]
      if (!ep) return response(404, 'Endpoint not found')
      if (!canConnect($ctx.username, ep, proto, svc)) return response(403)
      if (!ep.services.some(s => s.name === svc && s.protocol === proto)) return response(404, 'Service not found')
      sessions[id]?.forEach?.(h => $hubSelected = h)
      if (!$hubSelected) return response(404, 'Agent not found')
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
        if (!canOperate($ctx.username, ep)) return notAllowed
        sessions[id]?.forEach?.(h => $hubSelected = h)
        if (!$hubSelected) return notFound
        var path = $params['*']
        req.head.path = `/api/${path}`
        return muxToAgent
      }
    }
  )
)

//
// Ping agents regularly
//

pipeline($=>$
  .onStart(new Message({ path: '/api/ping' }))
  .repeat(() => new Timeout(15).wait().then(true)).to($=>$
    .forkJoin(() => Object.keys(sessions)).to($=>$
      .onStart(id => { $pingID = id })
      .forkJoin(() => {
        var hubs = []
        sessions[$pingID].forEach(h => hubs.push(h))
        return hubs
      }).to($=>$
        .onStart(hub => { $hubSelected = hub})
        .pipe(muxToAgent)
        .replaceData()
        .replaceMessage(
          res => {
            var hubs = sessions[$pingID]
            if (res.head.status !== 200) {
              hubs?.delete?.($hubSelected)
              console.info(`Endpoint ${endpointName($pingID)} ping failure, connections = ${hubs?.size || 0}`)
            }
            return new StreamEnd
          }
        )
      )
      .replaceMessage(new StreamEnd)
    )
    .replaceMessage(new StreamEnd)
  )
).spawn()

var notFound = pipeline($=>$
  .replaceData()
  .replaceMessage(response(404))
)

var notSupported = pipeline($=>$
  .replaceData()
  .replaceMessage(response(405))
)

var notAllowed = pipeline($=>$
  .replaceData()
  .replaceMessage(response(403))
)

var noSession = pipeline($=>$
  .replaceData()
  .replaceMessage(response(404, 'No agent session established yet'))
)

function collectMyNames(addr) {
  if (myNames.indexOf(addr) < 0) {
    myNames.push(addr)
    Object.values(endpoints).forEach(
      ep => {
        if (ep.isConnected) ep.hubs.push(addr)
      }
    )
  }
}

function findCurrentEndpointSession() {
  var id = $ctx.id
  if (!id) return false
  $endpoint = endpoints[id]
  if (!$endpoint) {
    $endpoint = endpoints[id] = {
      id,
      username: $ctx.username,
      ip: $ctx.ip,
      port: $ctx.port,
      via: $ctx.via,
      services: [],
      hubs: [...myNames]
    }
  }
  $endpoint.isConnected = true
  return true
}

function updateFileInfo(fs, f, ep) {
  var e = (fs[f.pathname] ??= {
    'T': 0,
    '$': 0,
    '#': null,
    '@': null,
  })
  var t1 = e['T']
  var h1 = e['#']
  var t2 = f.time
  var h2 = f.hash
  if (h2 === h1) {
    e['@'].push(ep)
    e['T'] = Math.max(t1, t2)
  } else if (t2 > t1) {
    e['#'] = h2
    e['$'] = f.size
    e['@'] = [ep]
    e['T'] = t2
  }
}

function canSee(username, ep) {
  if (username === 'root') return true
  if (username === ep.username) return true
  return false
}

function canOperate(username, ep) {
  if (username === 'root') return true
  if (username === ep.username) return true
  return false
}

function canConnect(username, ep, proto, svc) {
  if (username === 'root') return true
  if (username === ep.username) return true
  var s = ep.services.find(({ protocol, name }) => (protocol === proto && name === svc))
  if (!s) return false
  if (!s.users) return true
  return s.users.includes(username)
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
