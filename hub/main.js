#!/usr/bin/env -S pipy --args

import db from './db.js'
import ca from './ca.js'
import cmdline from './cmdline.js'

try {
  var ztmVersion = JSON.decode(pipy.load('version.json'))
} catch {
  var ztmVersion = {}
}

var hubVersion = {
  ztm: ztmVersion,
  pipy: { ...pipy.version },
}

try {
  var cluster = pipy.import('./cluster.js')
} catch {
  var cluster = null
}

var routes = Object.entries({

  '/api/status': {
    'GET': () => getHubStatus,
    'POST': () => findCurrentEndpointSession() ? postAgentStatus : noSession,
  },

  '/api/log': {
    'GET': () => getHubLog,
  },

  '/api/sign/{name}': {
    'POST': () => signCertificate,
  },

  '/api/evictions': {
    'GET': () => getEvictions,
  },

  '/api/evictions/{username}': {
    'GET': () => getEviction,
    'POST': () => postEviction,
    'DELETE': () => deleteEviction,
  },

  '/api/zones': {
    'GET': () => getZones,
  },

  '/api/zones/{zone}/hubs': {
    'GET': () => getHubs,
  },

  '/api/endpoints': {
    'GET': () => getEndpoints,
  },

  '/api/users': {
    'GET': () => getUsers,
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

  '/api/stats/endpoints': {
    'GET': () => getEndpointStats,
  },

  '/api/stats/endpoints/{ep}': {
    'GET': () => getEndpointStats,
  },

  '/api/ping/endpoints/{ep}': {
    'GET': () => pingEndpoint,
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
//   version: {
//     ztm: {
//       edition: string,
//       tag: string,
//       commit: string,
//       date: string,
//     },
//     pipy: {
//       tag: string,
//       commit: string,
//       date: string,
//     },
//   },
//   labels: ['a:b', 'c:d'],
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
var endpointList = []
var sessions = {}
var dedicatedSessions = {}

//
// connections[username] = new Set({
//   certificate: algo.Certificate,
//   evict: function,
// })
//

var connections = {}

//
// files[pathname] = {
//   '#': '012345678abcdef',  // hash
//   '$': 12345,              // size (-1 if deleted)
//   'T': 1789012345678,      // time
//   '+': 1789012345678,      // since
//   '@': [],                 // sources
// }
//

var files = {}
var fileList = null
var fileWatchers = []

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

//
// evictions[username] = number (timestamp in seconds)
//

var evictions = {}

//
// Instance state
//

var caCert = null
var myCert = null
var myKey = null
var myID = ''
var myNames = []
var myZone = ''
var startTime = Date.now()
var logBuffer = []

//
// Instance capacity
//

var maxAgents = 0
var maxForwardings = 0
var numForwardings = 0

//
// CLI
//

function main() {
  return cmdline(pipy.argv, {
    commands: [{
      title: 'ZTM Hub Service',
      options: `
        -d, --data          <dir>             Specify the location of ZTM storage (default: ~/.ztm)
        -l, --listen        <ip:port>         Specify the service listening port (default: 0.0.0.0:8888)
        -n, --names         <host:port ...>   Specify one or more hub names (host:port) that are accessible to agents
            --ca            <url>             Specify the location of an external CA service if any
            --max-agents    <number>          Specify the maximum number of agents the hub can handle
            --max-sessions  <number>          Specify the maximum number of forwarding sessions the hub can handle
      ` + (cluster ? `
            --bootstrap     <host:port ...>   Specify the bootstrap addresses of the hub cluster
            --zone          <zone>            Specify the zone that the hub is deployed in
      ` : ''),
      action: (args) => {
        myZone = args['--zone'] || 'default'

        maxAgents = Number.parseInt(args['--max-agents'] || 100)
        if (Number.isNaN(maxAgents) || maxAgents < 2) {
          throw 'invalid value for option --max-agents'
        }

        maxForwardings = Number.parseInt(args['--max-sessions'] || 1000)
        if (Number.isNaN(maxForwardings) || maxForwardings < 10) {
          throw 'invalid value for option --max-sessions'
        }

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

        var key = db.allKeys().find(k => k.name.startsWith('hub/'))
        if (key) {
          myID = key.name.substring(4)
        } else {
          myID = algo.uuid()
        }

        myNames = args['--names'] || []

        return ca.init(args['--ca']).then(() => {
          myKey = new crypto.PrivateKey({ type: 'rsa', bits: 2048 })
          var pkey = new crypto.PublicKey(myKey)
          var name = 'hub/' + myID
          db.setKey(name, pkey.toPEM().toString())
          return Promise.all([
            ca.getCertificate('ca').then(crt => caCert = crt),
            ca.signCertificate(name, pkey).then(crt => myCert = crt),
          ])
        }).then(() => {
          start(args['--listen'] || '0.0.0.0:8888', args['--bootstrap'])
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
var $sendEOS = null
var $sessionID
var $broadcastID
var $pingID
var $pingTime

var trafficTotalSend = new stats.Counter('send', ['ep'])
var trafficTotalRecv = new stats.Counter('recv', ['ep'])
var trafficTotalMove = new stats.Counter('move', ['a','b'])
var trafficSampled = {}
var trafficStats = {}
var trafficStatsTime = 0

var $trafficSend
var $trafficRecv
var $trafficPeerSend
var $trafficPeerRecv
var $trafficLinkSend
var $trafficLinkRecv

//
// Start hub service
//

function start(listen, bootstrap) {
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

  db.allEvictions().forEach(e => {
    evictions[e.username] = e.time
  })

  if (cluster) {
    cluster.init({
      bootstrap,
      id: myID,
      zone: myZone,
      ports: [...myNames],
      tls: {
        ca: caCert,
        cert: myCert,
        key: myKey,
      },
      get: {
        endpoints: (id, name, user, keyword, limit, offset) => listEndpoints(id, name, user, keyword, limit, offset),
        files: () => dumpFileSystem(),
        fileSources: (path) => dumpFileSources(path),
        acl: () => dumpACL(),
        evictions: () => evictions,
      },
      set: {
        file: (path, info, ep) => updateFileInfo(path, info, ep, true),
        acl: (username, path, access, since) => updateACL(username, path, access, since),
        eviction: (username, time) => updateEviction(username, time),
        hub: (id, info) => broadcastHub(id, info),
      },
      log,
    })
  }

  pipy.listen(listen, $=>$
    .onStart(
      function (conn) {
        $ctx = {
          ip: conn.remoteAddress,
          port: conn.remotePort,
          via: `${conn.localAddress}:${conn.localPort}`,
          username: undefined,
          certificate: undefined,
          connection: undefined,
          endpointID: undefined,
          sessionID: undefined,
        }
      }
    )
    .acceptTLS({
      certificate: {
        cert: myCert,
        key: myKey,
      },
      trusted: [caCert],
      verify: (ok, cert) => {
        if (!ok) return false
        var username = cert.subject?.commonName
        var time = evictions[username]
        if (time && time * 1000 >= cert.notBefore) {
          return false
        }
        return true
      },
      onState: (tls) => {
        if (tls.state === 'connected') {
          $ctx.certificate = tls.peer
          $ctx.username = tls.peer?.subject?.commonName
        }
      }
    }).to($=>$
      .insert(() => new Promise(resolve => {
        var conn = {
          certificate: $ctx.certificate,
          evict: () => resolve(new StreamEnd),
        }
        connections[$ctx.username] ??= new Set
        connections[$ctx.username].add(conn)
        $ctx.connection = conn
      }))
      .demuxHTTP().to($=>$
        .pipe(
          function (evt) {
            if (evt instanceof MessageStart) {
              var path = evt.head.path
              var route = routes.find(r => Boolean($params = r.match(path)))
              if (route) return route.handler($params, evt)
              if (cluster) return cluster.request(evt) || notFound
              return notFound
            }
          },
          () => $ctx
        )
      )
      .onEnd(() => { connections[$ctx.username].delete($ctx.connection) })
    )
  )

  if (cluster) {
    cluster.bootstrap(bootstrap).then(() => {
      logInfo(`Hub ${myID} started in zone '${myZone}' listening at ${listen}`)
    }).catch(() => {
      logError(`Unable to bootstrap hub instance in zone '${myZone}'`)
      pipy.exit(-1)
    })
  } else {
    logInfo(`Hub ${myID} started at ${listen}`)
  }

  startPing()
  clearOutdatedEndpoints()
  measureTraffic()
}

var getHubStatus = pipeline($=>$
  .replaceData()
  .replaceMessage(
    function () {
      collectMyNames($ctx.via)
      return response(200, {
        id: myID,
        since: startTime,
        zone: myZone || null,
        ports: myNames,
        peers: cluster ? cluster.getPeers() : [],
        capacity: {
          agents: maxAgents,
          sessions: maxForwardings,
        },
        load: {
          agents: endpointList.length,
          sessions: numForwardings,
        },
        version: hubVersion,
      })
    }
  )
)

var postAgentStatus = pipeline($=>$
  .replaceMessage(
    function (req) {
      var info = JSON.decode(req.body)
      var version = info.agent?.version
      var labels = info.agent?.labels
      if (labels instanceof Array) {
        labels = labels.filter(l => typeof l === 'string')
      } else {
        labels = []
      }
      Object.assign(
        $endpoint, {
          name: info.name,
          hubs: info.hubs,
          version,
          labels,
          heartbeat: Date.now(),
        }
      )
      return new Message({ status: 201 })
    }
  )
)

var getHubLog = pipeline($=>$
  .replaceData()
  .replaceMessage(
    function () {
      var user = $ctx.username
      if (user !== 'root') return response(403)
      return response(200, logBuffer)
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

var getEvictions = pipeline($=>$
  .replaceData()
  .replaceMessage(
    function () {
      return response(200, db.allEvictions())
    }
  )
)

var getEviction = pipeline($=>$
  .replaceData()
  .replaceMessage(
    function () {
      var name = URL.decodeComponent($params.username)
      var info = db.getEviction(name)
      return info ? response(200, info) : response(404)
    }
  )
)

var postEviction = pipeline($=>$
  .replaceData()
  .replaceMessage(
    function (req) {
      var query = new URL(req.head.path).searchParams
      var time = Number.parseFloat(query.get('time'))
      var expr = Number.parseFloat(query.get('expiration'))
      var name = URL.decodeComponent($params.username)
      if (name === 'root' || $ctx.username !== 'root') return response(403)
      if (Number.isNaN(time)) return response(400)
      if (cluster) {
        return response(cluster.updateEviction(myID, name, time) ? 201 : 200)
      } else {
        return response(updateEviction(name, time, expr) ? 201 : 200)
      }
    }
  )
)

var deleteEviction = pipeline($=>$
  .replaceData()
  .replaceMessage(
    function () {
      var name = URL.decodeComponent($params.username)
      if (name === 'root' || $ctx.username !== 'root') return response(403)
      if (cluster) {
        cluster.updateEviction(myID, name, null)
      } else {
        updateEviction(name, null)
      }
      return response(204)
    }
  )
)

var getZones = pipeline($=>$
  .replaceData()
  .replaceMessage(
    function () {
      collectMyNames($ctx.via)
      if (cluster) {
        return response(200, cluster.getZones())
      } else {
        return response(200, [myZone])
      }
    }
  )
)

var getHubs = pipeline($=>$
  .replaceData()
  .replaceMessage(
    function () {
      collectMyNames($ctx.via)
      if (cluster) {
        var hubs = cluster.getHubs($params.zone)
        return hubs ? response(200, hubs) : response(404)
      } else {
        if (URL.decodeComponent($params.zone) !== myZone) return response(404)
        return response(200, {
          [myID]: {
            ports: myNames,
            version: {
              ztm: {
                edition: hubVersion.ztm.edition,
                tag: hubVersion.ztm.tag,
              }
            },
          }
        })
      }
    }
  )
)

var getEndpoints = pipeline($=>$
  .replaceData()
  .replaceMessage(
    function (req) {
      var url = new URL(req.head.path)
      var params = url.searchParams
      var id = params.get('id')
      var name = params.get('name')
      var user = params.get('user')
      var keyword = params.get('keyword')
      var limit = Number.parseInt(params.get('limit')) || 100
      var offset = Number.parseInt(params.get('offset')) || 0
      if (id) id = URL.decodeComponent(id)
      if (name) name = URL.decodeComponent(name)
      if (user) user = URL.decodeComponent(user)
      if (keyword) keyword = URL.decodeComponent(keyword)
      if (cluster) {
        return cluster.getEndpoints(id, name, user, keyword, limit, offset).then(
          results => response(200, results)
        )
      } else {
        return response(200, listEndpoints(id, name, user, keyword, limit, offset))
      }
    }
  )
)

var getEndpoint = pipeline($=>$
  .replaceData()
  .replaceMessage(
    function () {
      if (cluster) {
        return cluster.getEndpoints($params.ep).then(
          results => results.length > 0 ? response(200, results[0]) : response(404)
        )
      } else {
        var ep = endpoints[$params.ep]
        if (!ep) return response(404)
        return response(200, {
          id: ep.id,
          name: ep.name,
          agent: {
            version: ep.version,
            labels: ep.labels || [],
          },
          username: ep.username,
          certificate: ep.certificate,
          ip: ep.ip,
          port: ep.port,
          hubs: ep.hubs,
          heartbeat: ep.heartbeat,
          ping: ep.ping,
          online: isEndpointOnline(ep),
        })
      }
    }
  )
)

var getUsers = pipeline($=>$
  .replaceData()
  .replaceMessage(
    function (req) {
      var url = new URL(req.head.path)
      var params = url.searchParams
      var name = params.get('name')
      var keyword = params.get('keyword')
      var offset = Number.parseInt(params.get('offset')) || 0
      var limit = Number.parseInt(params.get('limit')) || 100
      if (name) name = URL.decodeComponent(name)
      if (keyword) keyword = URL.decodeComponent(keyword)
      var users = {}
      endpointList.forEach(
        ep => {
          var name = ep.username
          var user = (users[name] ??= {
            name,
            endpoints: {
              count: 0,
              instances: []
            }
          })
          var epList = user.endpoints
          if (epList.instances.length < 5) {
            epList.instances.push({
              id: ep.id,
              name: ep.name,
              labels: ep.labels || [],
              ip: ep.ip,
              port: ep.port,
              heartbeat: ep.heartbeat,
              ping: ep.ping,
              online: isEndpointOnline(ep),
            })
          }
          epList.count++
        }
      )
      return response(200, Object.values(users).filter(
        user => {
          if (name && user.name !== name) return false
          if (keyword && user.name.indexOf(keyword) < 0) return false
          return true
        }
      ).filter(
        (_, i) => offset <= i && i < offset + limit
      ))
    }
  )
)

var getFilesystem = pipeline($=>$
  .replaceData()
  .replaceMessage(
    function (req) {
      var isAccessible = makeAccessChecker($ctx.username)
      var url = new URL(req.head.path)
      var params = url.searchParams.toObject()
      var since = params['since']
      if (since) {
        function findChanges(since, until) {
          return getAllFiles().filter(
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
        }

        var since = Number.parseFloat(since)
        var until = Date.now()

        return new Timeout(0.5).wait().then(() => {
          var list = findChanges(since, until)
          if (list.length > 0 || !('wait' in params)) {
            return response(200, Object.fromEntries(list))
          }
          return new Promise(resolve => {
            fileWatchers.push(
              function () {
                var until = Date.now()
                var list = findChanges(since, until)
                if (list.length > 0) {
                  new Timeout(0.5).wait().then(
                    () => resolve(until)
                  )
                  return true
                }
                return false
              }
            )
          }).then(until => response(200, Object.fromEntries(
            findChanges(since, until)
          )))
        })

      } else {
        return response(200, Object.fromEntries(
          getAllFiles().filter(
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
      var updates = {}
      Object.entries(body).forEach(
        ([path, info]) => {
          if (isAccessible(path)) {
            if (isOwned(path)) {
              if (cluster) {
                updates[path] = info
              } else {
                updateFileInfo(path, info, $endpoint.id, true)
              }
            } else {
              updateFileInfo(path, info, $endpoint.id, false)
            }
          }
        }
      )
      if (cluster) {
        cluster.updateFiles(myID, $endpoint.id, updates)
      }
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
      var updates = {}
      Object.entries(body).forEach(
        ([k, v]) => {
          if (!k.startsWith('/apps/')) return
          if (!matchAppSharedRoot(k) && !matchAppSharedPath(k)) return
          if (typeof v !== 'object') return
          if (cluster) {
            updates[k] = v
          } else {
            updateACL(username, k, { all: v.all, users: v.users }, v.since)
          }
        }
      )
      if (cluster) {
        cluster.updateACL(myID, username, updates)
      }
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
      if (username === $ctx.username) {
        if (makeOwnerChecker(username)(pathname)) {
          var access = acl[username]?.find?.(a => a.pathname === pathname) || {}
          return response(200, access)
        }
      }
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
      if (cluster) {
        return cluster.getFile(pathname).then(
          info => info ? response(200, info) : response(404)
        )
      } else {
        var info = files[pathname]
        if (!info || info['$'] < 0) return response(404)
        var sources = info['@']
        if (sources) info['@'] = sources.filter(ep => isEndpointOnline(endpoints[ep]))
        return response(200, info)
      }
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

var getEndpointStats = pipeline($=>$
  .replaceData()
  .replaceMessage(
    function () {
      var send = trafficStats.send
      var recv = trafficStats.recv
      var move = trafficStats.move
      var ep = $params.ep
      if (ep) {
        var peerRates = move?.[ep] || {}
        var peers = {}
        Object.keys(peerRates).forEach(k => {
          peers[k] = {
            send: peerRates[k],
            receive: move?.[k]?.[ep] || 0,
          }
        })
        return response(200, {
          send: send?.[ep] || 0,
          receive: recv?.[ep] || 0,
          peers,
        })
      } else {
        var all = {}
        Object.keys(endpoints).forEach(
          ep => {
            all[ep] = {
              send: send?.[ep] || 0,
              receive: recv?.[ep] || 0,
            }
          }
        )
        return response(200, all)
      }
    }
  )
)

var pingEndpoint = pipeline($=>$
  .replaceData()
  .replaceMessage(
    function (req) {
      var timestamp = {
        hub: myID,
        start: Date.now(),
        end: null,
        error: null,
      }
      var id = $params.ep
      var ep = endpoints[id]
      if (!ep) {
        timestamp.end = Date.now()
        timestamp.error = 'Endpoint not found'
        return new Message(JSON.encode([timestamp]))
      }
      var hub = null
      sessions[id]?.forEach?.(h => hub = h)
      if (!hub) {
        timestamp.end = Date.now()
        timestamp.error = 'Active session not found'
        return new Message(JSON.encode([timestamp]))
      }
      var url = new URL(req.head.path)
      var timeout = url.searchParams.get('timeout') || 30
      return Promise.race([
        new Timeout(Math.max(timeout / 2, 1)).wait().then(() => {
          timestamp.end = Date.now()
          timestamp.error = 'Response timeout'
          return new Message(JSON.encode([timestamp]))
        }),
        pipeline($=>$
          .onStart(hub => {
            $hubSelected = hub
            return new Message({ path: '/api/ping' })
          })
          .pipe(muxToAgent)
          .replaceMessage(res => {
            timestamp.end = Date.now()
            var status = res?.head?.status
            if (status === 200 && res.body) {
              try {
                var info = JSON.decode(res.body)
                if (info.id === id) return new StreamEnd
              } catch {}
            }
            if (res.body) {
              timestamp.error = `Invalid response (status ${status}): ${res.body.shift(100).toString()}`
            } else {
              timestamp.error = `Invalid response (status ${status})`
            }
            return new StreamEnd
          })
        ).spawn(hub).then(() => {
          if (!timestamp.end) {
            timestamp.end = Date.now()
            timestamp.error = `Invalid empty response`
          }
          return new Message(JSON.encode([timestamp]))
        })
      ])
    }
  )
)

var muxToAgent = pipeline($=>$
  .onStart(() => { if ($sessionID) $sendEOS = {} })
  .handleStreamEnd(() => { $sendEOS?.resolve?.() })
  .muxHTTP(() => $hubSelected, {
    version: 2,
    maxSessions: 1,
    ping: () => new Timeout(10).wait().then(new Data),
  }).to($=>$
    .insert(() => {
      if ($sendEOS) {
        return new Promise(r => { $sendEOS.resolve = r }).then(new StreamEnd)
      }
    })
    .swap(() => $hubSelected)
  )
)

var broadcastToAgents = pipeline($=>$
  .onStart(msg => msg)
  .forkJoin(() => Object.keys(sessions)).to($=>$
    .onStart(id => { $broadcastID = id })
    .forkJoin(() => {
      var hubs = []
      sessions[$broadcastID].forEach(h => hubs.push(h))
      return hubs
    }).to($=>$
      .onStart(hub => { $hubSelected = hub })
      .pipe(muxToAgent)
      .replaceData()
      .replaceMessage(new StreamEnd)
    )
    .replaceMessage(new StreamEnd)
  )
  .replaceMessage(new StreamEnd)
)

var connectEndpoint = pipeline($=>$
  .acceptHTTPTunnel(
    function (req) {
      var url = new URL(req.head.path)
      var name = URL.decodeComponent(url.searchParams.get('name') || '(unknown)')
      var sid = url.searchParams.get('sid')
      var id = $params.ep
      if (endpointList.length >= maxAgents && !(id in endpoints)) {
        return response(429, 'Too many agents')
      }
      $ctx.endpointID = id
      $ctx.sessionID = sid
      $hub = new pipeline.Hub
      if (sid) {
        dedicatedSessions[sid] = $hub
        logInfo(`Endpoint ${endpointName(id)} established session ${sid}`)
      } else {
        makeEndpoint(id).name = name
        sessions[id] ??= new Set
        sessions[id].add($hub)
        collectMyNames($ctx.via)
        logInfo(`Endpoint ${endpointName(id)} joined, connections = ${sessions[id].size}`)
      }
      return response(200)
    }
  ).to($=>$
    .onStart(new Data)
    .swap(() => $hub)
    .onEnd(() => {
      var id = $ctx.endpointID
      var sid = $ctx.sessionID
      if (sid) {
        delete dedicatedSessions[sid]
        logInfo(`Endpoint ${endpointName(id)} dropped session ${sid}`)
      } else {
        sessions[id]?.delete?.($hub)
        logInfo(`Endpoint ${endpointName(id)} left, connections = ${sessions[id]?.size || 0}`)
      }
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
      if (numForwardings >= maxForwardings) return response(429, 'Too many forwarding sessions')
      var query = new URL(req.head.path).searchParams.toObject()
      if ('dedicated' in query) {
        $sessionID = algo.uuid()
        return allocateSession.spawn($hubSelected, $sessionID).then(
          () => {
            $hubSelected = dedicatedSessions[$sessionID]
            if ($hubSelected) {
              logInfo(`Forward to app ${app} at ${endpointName(id)} via session ${$sessionID}`)
              setupMetrics()
              return response(200)
            } else {
              return response(404)
            }
          }
        )
      } else {
        logInfo(`Forward to app ${app} at ${endpointName(id)}`)
        setupMetrics()
        return response(200)
      }

      function setupMetrics() {
        var src = query.src
        $params.query = query
        $trafficSend = trafficTotalSend.withLabels(src)
        $trafficRecv = trafficTotalRecv.withLabels(src)
        $trafficPeerSend = trafficTotalSend.withLabels(id)
        $trafficPeerRecv = trafficTotalRecv.withLabels(id)
        $trafficLinkSend = trafficTotalMove.withLabels(src, id)
        $trafficLinkRecv = trafficTotalMove.withLabels(id, src)
      }
    }
  ).to($=>$
    .onStart(() => { numForwardings++ })
    .handleData(data => {
      var size = data.size
      trafficTotalSend.increase(size)
      $trafficSend.increase(size)
      $trafficPeerRecv.increase(size)
      $trafficLinkSend.increase(size)
    })
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
    })
    .to(muxToAgent)
    .handleData(data => {
      var size = data.size
      $trafficRecv.increase(size)
      $trafficPeerSend.increase(size)
      $trafficLinkRecv.increase(size)
    })
    .onEnd(() => { numForwardings-- })
  )
)

var allocateSession = pipeline($=>$
  .onStart((hub, id) => {
    $hubSelected = hub
    return new Message(
      {
        method: 'GET',
        path: `/api/sessions/${id}`,
      }
    )
  })
  .pipe(muxToAgent)
  .replaceMessage(new StreamEnd)
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

function startPing() {
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
          .onStart(hub => {
            $hubSelected = hub
            $pingTime = Date.now()
          })
          .pipe(muxToAgent)
          .replaceData()
          .replaceMessage(
            res => {
              if (res?.head?.status === 200) {
                var ping = Date.now() - $pingTime
                var ep = endpoints[$pingID]
                if (ep) ep.ping = ping
              } else {
                var hubs = sessions[$pingID]
                hubs?.delete?.($hubSelected)
                logInfo(`Endpoint ${endpointName($pingID)} ping failure, connections = ${hubs?.size || 0}`)
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
}

//
// Clear outdated endpoints
//

function clearOutdatedEndpoints() {
  new Timeout(60).wait().then(() => {
    var outdated = []
    endpointList.filter(ep => isEndpointOutdated(ep)).forEach(
      (ep) => {
        logInfo(`Endpoint ${ep.name} (uuid = ${ep.id}) outdated`)
        if (sessions[ep.id]?.size === 0) {
          outdated.push(ep.id)
          var i = endpointList.indexOf(ep)
          if (i >= 0) endpointList.splice(i, 1)
          delete endpoints[ep.id]
        }
      }
    )
    if (outdated.length > 0) {
      outdated = Object.fromEntries(outdated.map(ep => [ep, true]))
      getAllFiles().forEach(([_, file]) => {
        var sources = file['@']
        if (sources.some(ep => ep in outdated)) {
          file['@'] = sources.filter(ep => !(ep in outdated))
        }
      })
    }
    clearOutdatedEndpoints()
  })
}

//
// Measure traffic regularly
//

function measureTraffic() {
  new Timeout(1).wait().then(() => {
    stats.sum(['send', 'recv', 'move']).then(
      ({ send, recv, move }) => {
        var t = Date.now()
        var dt = (trafficStatsTime > 0 ? t - trafficStatsTime : 0) / 1000
        trafficStatsTime = t
        var sizeSend = (trafficSampled.send ??= {})
        var sizeRecv = (trafficSampled.recv ??= {})
        var sizeMove = (trafficSampled.move ??= {})
        var rateSend = (trafficStats.send ??= {})
        var rateRecv = (trafficStats.recv ??= {})
        var rateMove = (trafficStats.move ??= {})
        if (send) {
          send.submetrics().forEach(m => {
            var ep = m.label
            var newValue = m.value
            var oldValue = sizeSend[ep] || 0
            if (dt > 0) rateSend[ep] = (newValue - oldValue) / dt
            sizeSend[ep] = newValue
          })
        }
        if (recv) {
          recv.submetrics().forEach(m => {
            var ep = m.label
            var newValue = m.value
            var oldValue = sizeRecv[ep] || 0
            if (dt > 0) rateRecv[ep] = (newValue - oldValue) / dt
            sizeRecv[ep] = newValue
          })
        }
        if (move) {
          move.submetrics().forEach(m => {
            var ep = m.label
            m.submetrics().forEach(m => {
              var peer = m.label
              var newValue = m.value
              var oldValue = (sizeMove[ep] ??= {})[peer] || 0
              if (dt > 0) (rateMove[ep] ??= {})[peer] = (newValue - oldValue) / dt
              sizeMove[ep][peer] = newValue
            })
          })
        }
        measureTraffic()
      }
    )
  })
}

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

function log(type, msg) {
  if (logBuffer.length > 1000) {
    logBuffer.splice(0, logBuffer.length - 1000)
  }
  logBuffer.push({
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

function collectMyNames(addr) {
  if (myNames.indexOf(addr) < 0) {
    myNames.push(addr)
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
      hubs: [myID],
      heartbeat: Date.now(),
      ping: null,
      isConnected: true,
    }
    endpointList.push(ep)
  } else {
    ep.username = $ctx.username
  }
  return ep
}

function findCurrentEndpointSession() {
  var id = $ctx.endpointID
  if (!id) return false
  $endpoint = makeEndpoint(id)
  return true
}

function listEndpoints(id, name, user, keyword, limit, offset) {
  limit = limit || 100
  offset = offset || 0
  return endpointList.filter(
    ep => {
      if (id || name) {
        if (ep.id !== id && ep.name !== name) {
          return false
        }
      }
      if (user) {
        if (ep.username !== user) return false
      }
      if (keyword) {
        if (ep.name.indexOf(keyword) >= 0) return true
        if (ep.labels instanceof Array && ep.labels.find(l => l.indexOf(keyword) >= 0)) return true
        return false
      }
      return true
    }
  ).filter(
    (_, i) => offset <= i && i < offset + limit
  ).map(
    ep => ({
      id: ep.id,
      name: ep.name,
      hubs: ep.hubs || myNames,
      agent: {
        version: {
          ztm: {
            edition: ep.version?.ztm?.edition,
            tag: ep.version?.ztm?.tag,
          }},
        labels: ep.labels || [],
      },
      username: ep.username,
      ip: ep.ip,
      port: ep.port,
      heartbeat: ep.heartbeat,
      ping: ep.ping,
      online: isEndpointOnline(ep),
    })
  )
}

function updateEviction(username, time, expiration) {
  if (username === 'root') return false
  var old = db.getEviction(username)
  if (old && old.time >= time) return false
  if (time) {
    if (!expiration || Number.isNaN(expiration) || expiration <= time) {
      expiration = time + 365 * 24 * 60 * 60
    }
    db.setEviction(username, time, expiration)
    evictions[username] = time
    connections[username]?.forEach?.(conn => {
      if (conn.certificate.notBefore <= time * 1000) {
        conn.evict()
      }
    })
  } else {
    db.delEviction(username)
    delete evictions[username]
  }
  return true
}

function broadcastHub(id, info) {
  broadcastToAgents.spawn(
    new Message({
      method: 'POST',
      path: `/api/hubs/${id}`,
    }, JSON.encode({
      zone: info.zone,
      ports: info.ports,
      version: info.version,
    }))
  )
}

function dumpACL() {
  var all = {}
  Object.entries(acl).forEach(
    ([username, files]) => {
      all[username] = Object.fromEntries(files.map(
        file => [
          file.pathname, {
            all: file.all,
            users: file.users,
            since: file.since,
          }
        ]
      ))
    }
  )
  return all
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

function updateACL(username, path, access, since) {
  var updated = false
  var data = makeACL(path, access, since)
  if (data) {
    var list = (acl[username] ??= [])
    var pos = list.findIndex(a => a.pathname >= path)
    if (pos < 0) {
      list.push(data)
      db.setACL(path, access, since)
      updated = true
    } else if (list[pos].since < since) {
      if (list[pos].pathname === path) {
        list[pos] = data
      } else {
        list.splice(pos, 0, data)
      }
      db.setACL(path, access, since)
      updated = true
    }
  }
  return updated
}

function dumpFileSystem() {
  var all = {}
  getAllFiles().forEach(
    ([path, info]) => {
      all[path] = {
        '#': info['#'],
        '$': info['$'],
        'T': info['T'],
      }
    }
  )
  return all
}

function dumpFileSources(path) {
  var f = files[path]
  if (f) {
    return [...f['@']]
  } else {
    return []
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
  var updated = false
  var e = files[pathname]
  if (e || update) {
    if (!e) {
      e = files[pathname] = makeFileInfo('', 0, 0, 0)
      fileList = null // mark as changed
    }
    var t1 = e['T']
    var h1 = e['#']
    var t2 = f['T']
    var h2 = f['#']
    if (h2 === h1) {
      if (ep) {
        var sources = e['@']
        if (!sources.includes(ep)) {
          sources.push(ep)
        }
      }
      if (update && t2 > t1) {
        e['T'] = t2
        e['+'] = Date.now()
        updated = true
      }
    } else if (t2 > t1 && update) {
      e['#'] = h2
      e['$'] = f['$']
      e['T'] = t2
      e['+'] = Date.now()
      e['@'] = ep ? [ep] : []
      db.setFile(pathname, {
        hash: h2,
        size: e['$'],
        time: t2,
        since: e['+'],
      })
      updated = true
    }
    fileWatchers = fileWatchers.filter(f => !f())
  }
  return updated
}

function getAllFiles() {
  if (!fileList) {
    fileList = Object.entries(files)
  }
  return fileList
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
