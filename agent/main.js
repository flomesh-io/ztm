#!/usr/bin/env -S pipy --skip-unknown-arguments

import api from './api.js'
import db from './db.js'
import options from './options.js'

var opt = options({
  defaults: {
    '--help': false,
    '--reset': false,
    '--database': '~/ztm.db',
    '--listen': '127.0.0.1:6666',
  },
  shorthands: {
    '-h': '--help',
    '-r': '--reset',
    '-d': '--database',
    '-l': '--listen',
  },
})

if (options['--help']) {
  println('Options:')
  println('  -h, --help      Show available options')
  println('  -r, --reset     Delete the local database and start with a new one')
  println('  -d, --database  Pathname of the database file (default: ~/ztm.db)')
  println('  -l, --listen    Port number of the administration API (default: 127.0.0.1:6666)')
  return
}

var dbPath = opt['--database']
if (dbPath.startsWith('~/')) {
  dbPath = os.home() + dbPath.substring(1)
}

db.open(dbPath, opt['--reset'])
api.init()

//
// Data model:
//   MeshA
//     EndpointA
//       Port1 -> some service
//       Port2 -> some service
//       ServiceX
//       ServiceY
//       ...
//     EndpointB
//     ...
//   MeshB
//   ...
//

var routes = Object.entries({

  //
  // Mesh
  //   name: string
  //   agent:
  //     id: string (UUID)
  //     name: string
  //     certificate: string (PEM)
  //     privateKey: string (PEM)
  //   bootstraps: string[] (host:port)
  //   status: string
  //

  '/api/meshes': {

    'GET': function () {
      return response(200, api.allMeshes())
    },
  },

  '/api/meshes/{mesh}': {

    'GET': function ({ mesh }) {
      var obj = api.getMesh(mesh)
      return obj ? response(200, obj) : response(404)
    },

    'POST': function ({ mesh }, req) {
      return response(201, api.setMesh(mesh, JSON.decode(req.body)))
    },

    'DELETE': function ({ mesh }) {
      api.delMesh(mesh)
      return response(204)
    },
  },

  //
  // Endpoint
  //   id: string (UUID)
  //   name: string
  //   certificate: string (PEM)
  //   isLocal: boolean
  //   ip: string
  //   port: number
  //   heartbeat: number
  //   status: string
  //

  '/api/meshes/{mesh}/endpoints': {
    'GET': function (params) {
      return api.allEndpoints(params.mesh).then(
        ret => response(200, ret)
      )
    },
  },

  //
  // Service
  //   name: string
  //   protocol: string (tcp|udp)
  //   endpoints?: { id: string, name: string }[]
  //   isDiscovered: boolean
  //   isLocal: boolean
  //   host?: string (only when isLocal == true)
  //   port?: number (only when isLocal == true)
  //

  '/api/meshes/{mesh}/services': {
    'GET': function ({ mesh }) {
      return api.allServices(mesh).then(
        ret => response(200, ret)
      )
    },
  },

  '/api/meshes/{mesh}/endpoints/{ep}/services': {
    'GET': function ({ mesh, ep }) {
      return api.allServices(mesh, ep).then(
        ret => response(200, ret)
      )
    },
  },

  '/api/meshes/{mesh}/endpoints/{ep}/services/{proto}/{svc}': {
    'GET': function ({ mesh, ep, proto, svc }) {
      return api.getService(mesh, ep, proto, svc).then(
        ret => ret ? response(200, ret) : response(404)
      )
    },

    'POST': function ({ mesh, ep, proto, svc }, req) {
      return api.setService(mesh, ep, proto, svc, JSON.decode(req.body)).then(
        ret => response(201, ret)
      )
    },

    'DELETE': function ({ mesh, ep, proto, svc }) {
      return api.delService(mesh, ep, proto, svc).then(response(204))
    },
  },

  //
  // User
  //   name: string
  //   certificate: string (PEM)
  //

  '/api/meshes/{mesh}/services/{proto}/{svc}/users': {
    'GET': notImplemented,
  },

  '/api/meshes/{mesh}/services/{proto}/{svc}/users/{usr}': {
    'GET': notImplemented,
    'POST': notImplemented,
    'DELETE': notImplemented,
  },

  //
  // Port
  //   protocol: string (tcp|udp)
  //   listen:
  //     ip: string
  //     port: number
  //   target:
  //     endpoint: string?
  //     service: string
  //

  '/api/meshes/{mesh}/endpoints/{ep}/ports': {
    'GET': function ({ mesh, ep }) {
      return api.allPorts(mesh, ep).then(
        ret => response(200, ret)
      )
    },
  },

  '/api/meshes/{mesh}/endpoints/{ep}/ports/{ip}/{proto}/{port}': {
    'GET': function ({ mesh, ep, ip, proto, port }) {
      return api.getPort(mesh, ep, ip, proto, Number.parseInt(port)).then(
        ret => ret ? response(200, ret) : response(404)
      )
    },

    'POST': function ({ mesh, ep, ip, proto, port }, req) {
      return api.setPort(mesh, ep, ip, proto, Number.parseInt(port), JSON.decode(req.body).target).then(
        ret => response(201, ret)
      )
    },

    'DELETE': function ({ mesh, ep, ip, proto, port }) {
      return api.delPort(mesh, ep, ip, proto, Number.parseInt(port)).then(response(204))
    },
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

pipy.listen(opt['--listen'], $=>$
  .serveHTTP(
    function (req) {
      var path = req.head.path
      var params = null
      var route = routes.find(r => Boolean(params = r.match(path)))
      if (route) {
        try {
          return route.handler(params, req)
        } catch (e) {
          return response(500, e)
        }
      }
      return new Message({ status: 404 })
    }
  )
)

function notImplemented(params, req) {
  throw {
    message: 'Not implemented',
    path: req.head.path,
    params,
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
