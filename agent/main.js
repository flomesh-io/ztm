#!/usr/bin/env -S pipy --args

import api from './api.js'
import db from './db.js'
import options from './options.js'

var opt = options(pipy.argv, {
  defaults: {
    '--help': false,
    '--data': '~/.ztm',
    '--listen': '127.0.0.1:7777',
  },
  shorthands: {
    '-h': '--help',
    '-d': '--data',
    '-l': '--listen',
  },
})

if (opt['--help']) {
  println('Options:')
  println('  -h, --help     Show available options')
  println('  -d, --data     Pathname of the data directory (default: ~/.ztm)')
  println('  -l, --listen   Port number of the administration API (default: 127.0.0.1:7777)')
  return
}

var listen = opt['--listen']
if (listen.indexOf(':') <= 0) {
  if (!listen.startsWith(':')) listen = ':' + listen
  listen = '127.0.0.1' + listen
}

var dbPath = opt['--data']
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

  db.open(os.path.join(dbPath, 'ztm.db'))
  api.init(dbPath, listen)

} catch (e) {
  if (e.stack) println(e.stack)
  println('ztm:', e.toString())
  return
}

var routes = Object.entries({

  '/api/version': {
    'GET': function () {
      try { var data = JSON.decode(pipy.load('version.json')) } catch {}
      return response(200, {
        ztm: data,
        pipy: pipy.version,
      })
    },
  },

  //
  // Mesh
  //   name: string
  //   ca: string
  //   agent:
  //     id: string (UUID)
  //     name: string
  //     username: string
  //     certificate: string (PEM)
  //     privateKey: string (PEM)
  //   bootstraps: string[] (host:port)
  //   connected: boolean
  //   errors: string[]
  //

  '/api/meshes': {
    'GET': function () {
      var all = api.allMeshes()
      all.forEach(m => delete m.agent.privateKey)
      return response(200, api.allMeshes())
    },
  },

  '/api/meshes/{mesh}': {
    'GET': function ({ mesh }) {
      var obj = api.getMesh(mesh)
      if (!obj) return response(404)
      delete obj.agent.privateKey
      return response(200, obj)
    },

    'POST': function ({ mesh }, req) {
      return response(201, api.setMesh(mesh, JSON.decode(req.body)))
    },

    'DELETE': function ({ mesh }) {
      api.delMesh(mesh)
      return response(204)
    },
  },

  '/api/meshes/{mesh}/log': {
    'GET': function ({ mesh }) {
      var obj = api.getMeshLog(mesh)
      if (obj) return response(200, obj)
      return response(404)
    },
  },

  '/api/meshes/{mesh}/ca': {
    'GET': function ({ mesh }) {
      var obj = api.getMesh(mesh)
      return obj ? response(200, obj.ca || '') : response(404)
    },

    'POST': function ({ mesh }, req) {
      var obj = api.getMesh(mesh)
      if (!obj) return response(404)
      var data = req.body.toString()
      obj.ca = data
      api.setMesh(mesh, { ca: data })
      return response(201, data)
    },
  },

  '/api/meshes/{mesh}/agent/certificate': {
    'GET': function ({ mesh }) {
      var obj = api.getMesh(mesh)
      return obj ? response(200, obj.agent.certificate || '') : response(404)
    },

    'POST': function ({ mesh }, req) {
      var obj = api.getMesh(mesh)
      if (!obj) return response(404)
      var data = req.body.toString()
      api.setMesh(mesh, { agent: { certificate: data }})
      return response(201, data)
    },
  },

  '/api/meshes/{mesh}/agent/key': {
    'POST': function ({ mesh }, req) {
      var obj = api.getMesh(mesh)
      if (!obj) return response(404)
      var data = req.body.toString()
      api.setMesh(mesh, { agent: { privateKey: data }})
      return response(201, data)
    },
  },

  '/api/meshes/{mesh}/permits/{username}': {
    'GET': function ({ mesh, username }) {
      return api.getPermit(mesh, username).then(
        ret => ret ? response(200, ret) : response(403)
      )
    },

    'DELETE': function ({ mesh, username }) {
      return api.delPermit(mesh, username).then(
        ret => ret ? response(204) : response(404)
      )
    },
  },

  //
  // Endpoint
  //   id: string (UUID)
  //   name: string
  //   username: string
  //   certificate: string (PEM)
  //   isLocal: boolean
  //   ip: string
  //   port: number
  //   heartbeat: number
  //   online: boolean
  //

  '/api/meshes/{mesh}/endpoints': {
    'GET': function ({ mesh }) {
      return api.allEndpoints(mesh).then(
        ret => response(200, ret)
      )
    },
  },

  '/api/meshes/{mesh}/endpoints/{ep}': {
    'GET': function ({ mesh, ep }) {
      return api.getEndpoint(mesh, ep).then(
        ret => ret ? response(200, ret) : response(404)
      )
    },
  },

  '/api/meshes/{mesh}/endpoints/{ep}/log': {
    'GET': function ({ mesh, ep }) {
      return api.getEndpointLog(mesh, ep).then(
        ret => ret ? response(200, ret) : response(404)
      )
    },
  },

  //
  // Files
  //   hash: string
  //   time: number
  //   size: number
  //

  '/api/meshes/{mesh}/files': {
    'GET': function ({ mesh }) {
      return api.allFiles(mesh).then(
        ret => response(200, ret)
      )
    }
  },

  '/api/meshes/{mesh}/files/*': {
    'GET': function (params) {
      return api.getFileInfo(params.mesh, params['*']).then(
        ret => ret ? response(200, ret) : response(404)
      )
    }
  },

  '/api/meshes/{mesh}/file-data/*': {
    'GET': function (params) {
      return api.getFileData(params.mesh, params['*']).then(
        ret => ret ? response(200, ret) : response(404)
      )
    }
  },

  '/api/meshes/{mesh}/endpoints/{ep}/file-data/{hash}': {
    'GET': function ({ mesh, ep, hash }) {
      return api.getFileDataFromEP(mesh, ep, hash).then(
        ret => ret ? response(200, ret) : response(404)
      )
    },
  },

  //
  // App
  //   name: string
  //   tag: string
  //   provider: string
  //   username: string
  //   isRunning: boolean
  //   isPublished: boolean
  //   log: string[]
  //

  '/api/meshes/{mesh}/apps': {
    'GET': function ({ mesh }) {
      return api.allApps(mesh).then(
        ret => response(200, ret)
      )
    },
  },

  '/api/meshes/{mesh}/endpoints/{ep}/apps': {
    'GET': function ({ mesh, ep }) {
      return api.allApps(mesh, ep).then(
        ret => response(200, ret)
      )
    },
  },

  '/api/meshes/{mesh}/endpoints/{ep}/apps/{provider}/{app}': {
    'GET': function ({ mesh, ep, provider, app }) {
      return api.getApp(mesh, ep, provider, app).then(
        ret => ret ? response(200, ret) : response(404)
      )
    },

    'POST': function ({ mesh, ep, provider, app }, req) {
      return api.setApp(mesh, ep, provider, app, JSON.decode(req.body)).then(
        ret => response(201, ret)
      )
    },

    'DELETE': function ({ mesh, ep, provider, app }) {
      return api.delApp(mesh, ep, provider, app).then(response(204))
    },
  },

  '/api/meshes/{mesh}/endpoints/{ep}/apps/{provider}/{app}/log': {
    'GET': function ({ mesh, ep, provider, app }) {
      return api.getAppLog(mesh, ep, provider, app).then(
        ret => ret ? response(200, ret) : response(404)
      )
    }
  },

}).map(
  function ([path, methods]) {
    var match = new http.Match(path)
    var handler = function (params, req) {
      var f = methods[req.head.method]
      if (f) return f(params, req)
      return new Message({ status: 405 })
    }
    return { match, handler }
  }
)

var gui = new http.Directory('gui')
var appApiMatch = new http.Match('/api/meshes/{mesh}/apps/{provider}/{app}')
var appPreMatch = new http.Match('/api/meshes/{mesh}/apps/{provider}/{app}/*')
var appNotFound = pipeline($=>$.serveHTTP(new Message({ status: 404 })))

var $params
var $appPipeline
var $appSession

var appSessionPools = new algo.Cache(
  k => new algo.LoadBalancer([{}])
)

pipy.listen(listen, $=>$
  .demuxHTTP().to($=>$
    .pipe(
      function (evt) {
        if (evt instanceof MessageStart) {
          var path = evt.head.path
          if (path.startsWith('/api/')) {
            if ($params = appApiMatch(path) || appPreMatch(path)) {
              evt.head.path = '/' + ($params['*'] || '')
              return 'app'
            } else {
              return 'api'
            }
          } else {
            return 'gui'
          }
        }
      }, {
        'api': $=>$.replaceMessage(
          req => {
            var path = req.head.path
            var params = null
            var route = routes.find(r => Boolean(params = r.match(path)))
            if (route) {
              try {
                var res = route.handler(params, req)
                return res instanceof Promise ? res.catch(responseError) : res
              } catch (e) {
                return responseError(e)
              }
            }
            return new Message({ status: 404 })
          }
        ),
        'app': ($=>$
          .onStart(() => api.connectApp(
              $params.mesh,
              $params.provider,
              $params.app,
            ).then(p => {
              var pool = appSessionPools.get(p)
              $appPipeline = p
              $appSession = pool.allocate()
            })
          )
          .muxHTTP(() => $appSession).to($=>$
            .pipe(
              () => $appPipeline || appNotFound,
              () => ({ source: 'user' })
            )
          )
          .onEnd(() => $appSession?.free?.())
        ),
        'gui': $=>$.replaceMessage(
          req => gui.serve(req) || new Message({ status: 404 })
        ),
      }
    )
  )
)

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
