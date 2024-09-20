#!/usr/bin/env -S pipy --args

import db from './db.js'
import ca from './ca.js'
import cmdline from './cmdline.js'

var routes = Object.entries({

  '/api/status': {
    'POST': () => findCurrentEndpointSession() ? postStatus : noSession,
  },

  '/api/sign/{name}': {
    'POST': () => signCertificate,
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

  '/api/endpoints/{ep}/apps/{app}': {
    'CONNECT': () => connectApp,
  },

  '/api/endpoints/{ep}/apps/{provider}/{app}': {
    'CONNECT': () => connectApp,
  },

  '/api/filesystem': {
    'GET': () => getFilesystem,
    'POST': () => findCurrentEndpointSession() ? postFilesystem : noSession,
  },

  '/api/filesystem/*': {
    'GET': () => getFileInfo,
  },

  '/api/acl': {
    'POST': () => findCurrentEndpointSession() ? postACL : noSession,
  },

  '/api/acl/*': {
    'GET': () => checkACL,
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

//
// endpoints[uuid] = {
//   id: 'uuid',
//   name: 'ep-xxx',
//   username: 'root',
//   ip: 'x.x.x.x',
//   port: 12345,
//   via: '127.0.0.1:8888',
//   hubs: ['x.x.x.x:8888'],
//   heartbeat: 1723012345678,
//   isConnected: true,
// }
//

var endpoints = {}
var sessions = {}

//
// files[pathname] = {
//   '#': '012345678abcdef',  // hash
//   '$': 12345,              // size
//   'T': 1789012345678,      // time
//   '+': 1789012345678,      // since
//   '@': [],                 // sources
// }
//

var files = {}

//
// acl[username] = [
//   {
//     pathname: '/apps/x/y/shared/z/a/b/c',
//     prefix: '/apps/x/y/shared/z/a/b/c/',
//     all: null | 'readonly' | 'block',
//     users: {
//       [username]: 'readonly' | 'block',
//     },
//     since: 1789012345678,
//   }
// ]
//

var acl = {}

var caCert = null
var myCert = null
var myKey = null
var myNames = []

function main() {
  return cmdline(pipy.argv, {
    commands: [{
      title: 'ZTM Hub Service',
      options: `
        -d, --data    <dir>             Specify the location of ZTM storage (default: ~/.ztm)
        -l, --listen  <ip:port>         Specify the service listening port (default: 0.0.0.0:8888)
        -n, --names   <host:port ...>   Specify one or more hub names (host:port) that are accessible to agents
            --ca      <url>             Specify the location of an external CA service if any
      `,
      action: (args) => {
        var dbPath = args['--data'] || '~/.ztm'
        if (dbPath.startsWith('~/')) {
          dbPath = os.home() + dbPath.substring(1)
        }

        try {
          dbPath = os.path.resolve(dbPath)
          var st = os.stat(dbPath)
          if (st) {
            if (!st.isDirectory()) {
              throw `directory path already exists as a regular file: ${dbPath}`
            }
          } else {
            os.mkdir(dbPath, { recursive: true })
          }

          db.open(os.path.join(dbPath, 'ztm-hub.db'))

        } catch (e) {
          if (e.stack) println(e.stack)
          println('ztm:', e.toString())
          return Promise.reject()
        }

        myNames = args['--names'] || []

        return ca.init(args['--ca']).then(() => {
          myKey = new crypto.PrivateKey({ type: 'rsa', bits: 2048 })
          var pkey = new crypto.PublicKey(myKey)
          return Promise.all([
            ca.getCertificate('ca').then(crt => caCert = crt),
            ca.signCertificate('hub', pkey).then(crt => myCert = crt),
          ])
        }).then(() => {
          start(args['--listen'] || '0.0.0.0:8888')
        })
      }
    }],
    help: text => Promise.reject(println(text))
  })
}

try {
  main().catch(error)
} catch (err) { error(err) }

function error(err) {
  if (err) {
    if (err.stack) println(err.stack)
    println(`ztm: ${err.toString()}`)
  }
  pipy.exit(-1)
}

function endpointName(id) {
  var ep = endpoints[id]
  return ep?.name ? `${ep.name} (uuid = ${id})` : id
}

function isEndpointOnline(ep) {
  if (!ep) return false
  if (!sessions[ep.id]?.size) return false
  if (ep.heartbeat + 30*1000 < Date.now()) return false
  return true
}

function isEndpointOutdated(ep) {
  return (ep.heartbeat + 120*1000 < Date.now())
}

var $ctx = null
var $params = null
var $endpoint = null
var $hub = null
var $hubSelected = null
var $pingID

function start(listen) {
  db.allFiles().forEach(f => {
    files[f.pathname] = makeFileInfo(f.hash, f.size, f.time, f.since)
  })

  var matchAppShared1 = new http.Match('/apps/{provider}/{appname}/shared/{username}')
  var matchAppShared2 = new http.Match('/apps/{provider}/{appname}/shared/{username}/*')

  db.allACL().forEach(a => {
    var pathname = a.pathname
    var params = matchAppShared1(pathname) || matchAppShared2(pathname)
    if (params) {
      var username = params.username
      var access = makeACL(pathname, a.access, a.since)
      if (access) {
        (acl[username] ??= {})[pathname] = access
      }
    }
  })

  acl = Object.fromEntries(
    Object.entries(acl).map(
      ([username, accessByPath]) => [
        username,
        Object.keys(accessByPath).sort().map(k => accessByPath[k])
      ]
    )
  )

  pipy.listen(listen, $=>$
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

  console.info('Hub started at', listen)

  function clearOutdatedEndpoints() {
    new Timeout(60).wait().then(() => {
      var outdated = []
      Object.values(endpoints).filter(ep => isEndpointOutdated(ep)).forEach(
        (ep) => {
          console.info(`Endpoint ${ep.name} (uuid = ${ep.id}) outdated`)
          if (sessions[ep.id]?.size === 0) {
            outdated.push(ep.id)
            delete endpoints[ep.id]
          }
        }
      )
      if (outdated.length > 0) {
        outdated = Object.fromEntries(outdated.map(ep => [ep, true]))
        Object.values(files).forEach(file => {
          var sources = file['@']
          if (sources.some(ep => ep in outdated)) {
            file['@'] = sources.filter(ep => !(ep in outdated))
          }
        })
      }
      clearOutdatedEndpoints()
    })
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

var signCertificate = pipeline($=>$
  .replaceMessage(
    function (req) {
      var user = $ctx.username
      var name = URL.decodeComponent($params.name)
      if (name !== user && user !== 'root') return response(403)
      var pkey = new crypto.PublicKey(req.body)
      return ca.signCertificate(name, pkey).then(
        cert => response(201, cert.toPEM().toString())
      )
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
    function (req) {
      var isAccessible = makeAccessChecker($ctx.username)
      var url = new URL(req.head.path)
      var since = url.searchParams.get('since')
      if (since) {
        var since = Number.parseFloat(since)
        var until = Date.now()
        return new Timeout(1.5).wait().then(
          () => response(200, Object.fromEntries(
            Object.entries(files).filter(
              ([k, v]) => {
                var t = v['+']
                return since < t && t <= until && isAccessible(k)
              }
            ).map(
              ([k, v]) => [
                k, {
                  '#': v['#'],
                  '$': v['$'],
                  'T': v['T'],
                  '+': v['+'],
                }
              ]
            )
          ))
        )
      } else {
        return response(200, Object.fromEntries(
          Object.entries(files).filter(
            ([k, v]) => (v['$'] >= 0 && isAccessible(k))
          ).map(
            ([k, v]) => [
              k, {
                '#': v['#'],
                '$': v['$'],
                'T': v['T'],
              }
            ]
          )
        ))
      }
    }
  )
)

var postFilesystem = pipeline($=>$
  .replaceMessage(
    function (req) {
      var body = JSON.decode(req.body)
      var username = $endpoint.username
      var isOwned = makeOwnerChecker(username)
      var isAccessible = makeAccessChecker(username)
      Object.entries(body).forEach(
        ([path, info]) => {
          if (isAccessible(path)) {
            updateFileInfo(path, info, $endpoint.id, isOwned(path))
          }
        }
      )
      return new Message({ status: 201 })
    }
  )
)

var postACL = pipeline($=>$
  .replaceMessage(
    function (req) {
      var body = JSON.decode(req.body)
      var username = $endpoint.username
      var matchAppSharedRoot = new http.Match(`/apps/{provider}/{appname}/shared/${username}`)
      var matchAppSharedPath = new http.Match(`/apps/{provider}/{appname}/shared/${username}/*`)
      var accessByPath = Object.fromEntries((acl[username] || []).map(
        data => [data.pathname, data]
      ))
      Object.entries(body).forEach(
        ([k, v]) => {
          if (!k.startsWith('/apps/')) return
          if (!matchAppSharedRoot(k) && !matchAppSharedPath(k)) return
          if (typeof v !== 'object') return
          var access = { all: v.all, users: v.users }
          var since = v.since
          var data = makeACL(k, access, since)
          if (data) {
            var last = accessByPath[k]
            if (!last || last.since < since) {
              accessByPath[k] = data
              db.setACL(k, access, since)
            }
          }
        }
      )
      acl[username] = Object.keys(accessByPath).sort().map(k => accessByPath[k])
      return new Message({ status: 201 })
    }
  )
)

var checkACL = pipeline($=>$
  .replaceMessage(
    function (req) {
      var url = new URL(req.head.path)
      var pathname = '/' + URL.decodeComponent($params['*'])
      var username = url.searchParams.get('username')
      username = username ? URL.decodeComponent(username) : $ctx.username
      return response(makeAccessChecker(username)(pathname) ? 200 : 403)
    }
  )
)

var getFileInfo = pipeline($=>$
  .replaceData()
  .replaceMessage(
    function () {
      var pathname = '/' + URL.decodeComponent($params['*'])
      if (!makeAccessChecker($ctx.username)(pathname)) return response(404)
      var info = files[pathname]
      if (!info || info['$'] < 0) return response(404)
      var sources = info['@']
      if (sources) info['@'] = sources.filter(ep => isEndpointOnline(endpoints[ep]))
      return response(200, info)
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

var muxToAgent = pipeline($=>$
  .muxHTTP(() => $hubSelected, {
    version: 2,
    ping: () => new Timeout(10).wait().then(new Data),
  }).to($=>$
    .swap(() => $hubSelected)
  )
)

var connectEndpoint = pipeline($=>$
  .acceptHTTPTunnel(
    function (req) {
      var url = new URL(req.head.path)
      var name = URL.decodeComponent(url.searchParams.get('name') || '(unknown)')
      var id = $params.ep
      makeEndpoint(id).name = name
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

var connectApp = pipeline($=>$
  .acceptHTTPTunnel(
    function (req) {
      var app = URL.decodeComponent($params.app)
      var id = $params.ep
      var ep = endpoints[id]
      if (!ep) return response(404, 'Endpoint not found')
      sessions[id]?.forEach?.(h => $hubSelected = h)
      if (!$hubSelected) return response(404, 'Agent not found')
      $params.query = new URL(req.head.path).searchParams.toObject()
      console.info(`Forward to app ${app} at ${endpointName(id)}`)
      return response(200)
    }
  ).to($=>$
    .connectHTTPTunnel(() => {
      var provider = $params.provider || ''
      var app = $params.app
      var src = $params.query.src
      var ip = $ctx.ip
      var port = $ctx.port
      var username = URL.encodeComponent($ctx.username)
      var q = `?src=${src}&ip=${ip}&port=${port}&username=${username}`
      return new Message({
        method: 'CONNECT',
        path: provider ? `/api/apps/${provider}/${app}${q}` : `/api/apps/${app}${q}`,
      })
    }).to(muxToAgent)
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
        var url = new URL(req.head.path)
        var path = $params['*']
        req.head.path = `/api/${path}${url.search}`
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

function makeEndpoint(id) {
  var ep = endpoints[id]
  if (!ep) {
    ep = endpoints[id] = {
      id,
      name: '(unknown)',
      username: $ctx.username,
      ip: $ctx.ip,
      port: $ctx.port,
      via: $ctx.via,
      hubs: [...myNames],
      heartbeat: Date.now(),
      isConnected: true,
    }
  } else {
    ep.username = $ctx.username
  }
  return ep
}

function findCurrentEndpointSession() {
  var id = $ctx.id
  if (!id) return false
  // $endpoint = endpoints[id]
  // if (!$endpoint) {
  //   $endpoint = endpoints[id] = {
  //     id,
  //     username: $ctx.username,
  //     ip: $ctx.ip,
  //     port: $ctx.port,
  //     via: $ctx.via,
  //     hubs: [...myNames]
  //   }
  // } else {
  //   $endpoint.username = $ctx.username
  // }
  $endpoint = makeEndpoint(id)
  // $endpoint.isConnected = true
  return true
}

function makeACL(pathname, access, since) {
  if (typeof access !== 'object') return
  if (typeof access.all !== 'string' && access.all !== null) return
  if (typeof access.users !== 'object') return
  if (typeof since !== 'number') return
  return {
    pathname,
    prefix: pathname + '/',
    since,
    all: access.all,
    users: access.users,
  }
}

function makeFileInfo(hash, size, time, since) {
  return {
    '#': hash,
    '$': size,
    'T': time,
    '+': since,
    '@': [],
  }
}

function updateFileInfo(pathname, f, ep, update) {
  var e = files[pathname]
  if (e || update) {
    if (!e) e = files[pathname] = makeFileInfo('', 0, 0, 0)
    var t1 = e['T']
    var h1 = e['#']
    var t2 = f['T']
    var h2 = f['#']
    if (h2 === h1) {
      var sources = e['@']
      if (!sources.includes(ep)) sources.push(ep)
      if (update && t2 > t1) {
        e['T'] = t2
        e['+'] = Date.now()
      }
    } else if (t2 > t1 && update) {
      e['#'] = h2
      e['$'] = f['$']
      e['T'] = t2
      e['+'] = Date.now()
      e['@'] = [ep]
      db.setFile(pathname, {
        hash: h2,
        size: e['$'],
        time: t2,
        since: e['+'],
      })
    }
  }
}

function canOperate(username, ep) {
  return (username === ep.username)
}

function makeOwnerChecker(username) {
  var prefixUser = `/users/${username}/`
  var prefixShared = `/shared/${username}/`
  var matchAppUser = new http.Match(`/apps/{provider}/{appname}/users/${username}/*`)
  var matchAppShared = new http.Match(`/apps/{provider}/{appname}/shared/${username}/*`)
  return (path) => (
    path.startsWith(prefixUser) ||
    path.startsWith(prefixShared) ||
    matchAppUser(path) ||
    matchAppShared(path)
  )
}

function makeAccessChecker(username) {
  var prefixUser = `/users/${username}/`
  var prefixShared = `/shared/`
  var matchAppUser = new http.Match(`/apps/{provider}/{appname}/users/${username}/*`)
  var matchAppShared = new http.Match(`/apps/{provider}/{appname}/shared/{username}/*`)
  return (path) => {
    if (path.startsWith(prefixUser)) return true
    if (path.startsWith(prefixShared)) return true
    if (matchAppUser(path)) return true
    var params = matchAppShared(path)
    if (!params) return false
    var owner = params.username
    if (owner === username) return true
    var accessible = true
    acl[owner]?.forEach?.(access => {
      if (!access.all && !access.users) return
      if (path === access.pathname || path.startsWith(access.prefix)) {
        switch (access.users?.[username] || access.all) {
          case 'block': accessible = false; break
          case 'readonly': accessible = true; break
        }
      }
    })
    return accessible
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
