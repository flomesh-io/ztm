#!/usr/bin/env -S pipy --args

import api from './api.js'
import db from './db.js'
import cmdline from './cmdline.js'

try {
  cmdline(pipy.argv, {
    commands: [{
      title: 'ZTM Agent',
      options: `
        -d, --data    <dir>         Specify the location of ZTM storage (default: ~/.ztm)
        -l, --listen  <[ip:]port>   Specify the agent's listening port (default: 127.0.0.1:7777)
            --join    <mesh>        If specified, join a mesh with the given name
            --join-as <endpoint>    When joining a mesh, give the current endpoint a name
        -p, --permit  <filename>    When joining a mesh, use the provided permit file
      `,
      action: (args) => {
        var listen = args['--listen'] || '127.0.0.1:7777'
        if (listen.indexOf(':') <= 0) {
          if (!listen.startsWith(':')) listen = ':' + listen
          listen = '127.0.0.1' + listen
        }

        var dbPath = args['--data'] || '~/.ztm'
        if (dbPath.startsWith('~/')) {
          dbPath = os.home() + dbPath.substring(1)
        }

        if ('--join' in args) {
          var joinMesh = args['--join']
          var joinAs = args['--join-as']
          var joinPermit = args['--permit']
          validateName(joinMesh, `invalid mesh name '${joinMesh}'`)
          validateName(joinAs, `invalid endpoint name '${joinAs}'`)
          if (!joinAs) throw 'option --join-as is required when using --join'
          if (!joinPermit) throw 'option --permit is required when using --join'
          try {
            var permit = JSON.decode(os.read(joinPermit))
          } catch {
            throw `cannot read permit file from: ${joinPermit}`
          }
        }

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

        if (joinMesh) {
          api.setMesh(joinMesh, {
            ca: permit.ca,
            agent: {
              name: joinAs,
              certificate: permit.agent.certificate,
              privateKey: permit.agent.privateKey,
            },
            bootstraps: permit.bootstraps,
          })
        }

        main(listen)
      }
    }]
  })
} catch (e) {
  if (e.stack) println(e.stack)
  println('ztm:', e.toString())
  pipy.exit(-1)
}

function main(listen) {
  var gui = new http.Directory('gui')
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

    '/api/identity': {
      'GET': function () {
        return response(200, api.getIdentity())
      },

      'POST': function (_, req) {
        api.setIdentity(req.body.toString())
        return response(201, api.getIdentity())
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
    //     offline: boolean?
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
        mesh = URL.decodeComponent(mesh)
        var obj = api.getMesh(mesh)
        if (!obj) return response(404)
        delete obj.agent.privateKey
        return response(200, obj)
      },

      'POST': function ({ mesh }, req) {
        mesh = URL.decodeComponent(mesh)
        return response(201, api.setMesh(mesh, JSON.decode(req.body)))
      },

      'DELETE': function ({ mesh }) {
        mesh = URL.decodeComponent(mesh)
        api.delMesh(mesh)
        return response(204)
      },
    },

    '/api/meshes/{mesh}/log': {
      'GET': function ({ mesh }) {
        mesh = URL.decodeComponent(mesh)
        var obj = api.getMeshLog(mesh)
        if (obj) return response(200, obj)
        return response(404)
      },
    },

    '/api/meshes/{mesh}/ca': {
      'GET': function ({ mesh }) {
        mesh = URL.decodeComponent(mesh)
        var obj = api.getMesh(mesh)
        return obj ? response(200, obj.ca || '') : response(404)
      },

      'POST': function ({ mesh }, req) {
        mesh = URL.decodeComponent(mesh)
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
        mesh = URL.decodeComponent(mesh)
        var obj = api.getMesh(mesh)
        return obj ? response(200, obj.agent.certificate || '') : response(404)
      },

      'POST': function ({ mesh }, req) {
        mesh = URL.decodeComponent(mesh)
        var obj = api.getMesh(mesh)
        if (!obj) return response(404)
        var data = req.body.toString()
        api.setMesh(mesh, { agent: { certificate: data }})
        return response(201, data)
      },
    },

    '/api/meshes/{mesh}/agent/key': {
      'POST': function ({ mesh }, req) {
        mesh = URL.decodeComponent(mesh)
        var obj = api.getMesh(mesh)
        if (!obj) return response(404)
        var data = req.body.toString()
        api.setMesh(mesh, { agent: { privateKey: data }})
        return response(201, data)
      },
    },

    '/api/meshes/{mesh}/permits/{username}': {
      'POST': function ({ mesh, username }, req) {
        mesh = URL.decodeComponent(mesh)
        username = URL.decodeComponent(username)
        return api.getPermit(mesh, username, req.body).then(
          ret => ret ? response(200, ret) : response(403)
        )
      },
    },

    //
    // Hub
    //   id: string (UUID)
    //   zone: string
    //   since: number
    //   ports: [{
    //     name: string,
    //     ping: number,
    //     online: boolean,
    //   }]
    //   capacity:
    //     agents: number
    //   load:
    //     agents: number
    //   connected: boolean
    //

    '/api/meshes/{mesh}/hubs': {
      'GET': function ({ mesh }, req) {
        mesh = URL.decodeComponent(mesh)
        return api.allHubs(mesh).then(
          ret => response(200, ret)
        )
      },
    },

    '/api/meshes/{mesh}/hubs/{id}': {
      'GET': function ({ mesh, id }) {
        mesh = URL.decodeComponent(mesh)
        return api.getHub(mesh, id).then(
          ret => ret ? response(200, ret) : response(404)
        )
      },

      'POST': function ({ mesh, id }, req) {
        mesh = URL.decodeComponent(mesh)
        return api.setHub(mesh, id, JSON.decode(req.body)).then(
          () => response(201)
        )
      }
    },

    '/api/meshes/{mesh}/hubs/{id}/log': {
      'GET': function ({ mesh, id }) {
        mesh = URL.decodeComponent(mesh)
        return api.getHubLog(mesh, id).then(
          ret => ret ? response(200, ret) : response(404)
        )
      },
    },

    //
    // Endpoint
    //   id: string (UUID)
    //   name: string
    //   labels: [string]
    //   username: string
    //   certificate: string (PEM)
    //   isLocal: boolean
    //   ip: string
    //   port: number
    //   heartbeat: number
    //   ping: number
    //   online: boolean
    //

    '/api/meshes/{mesh}/endpoints': {
      'GET': function ({ mesh }, req) {
        mesh = URL.decodeComponent(mesh)
        var params = new URL(req.head.path).searchParams
        var id = params.get('id')
        var name = params.get('name')
        var user = params.get('user')
        var keyw = params.get('keyword')
        var offset = Number.parseInt(params.get('offset')) || 0
        var limit = Number.parseInt(params.get('limit')) || 100
        return api.allEndpoints(
          mesh,
          id && URL.decodeComponent(id),
          name && URL.decodeComponent(name),
          user && URL.decodeComponent(user),
          keyw && URL.decodeComponent(keyw),
          offset, limit
        ).then(
          ret => response(200, ret)
        )
      },
    },

    '/api/meshes/{mesh}/endpoints/{ep}': {
      'GET': function ({ mesh, ep }) {
        mesh = URL.decodeComponent(mesh)
        return api.getEndpoint(mesh, ep).then(
          ret => ret ? response(200, ret) : response(404)
        )
      },
    },

    '/api/meshes/{mesh}/endpoints/{ep}/labels': {
      'GET': function ({ mesh, ep }) {
        mesh = URL.decodeComponent(mesh)
        return api.getEndpointLabels(mesh, ep).then(
          ret => ret ? response(200, ret) : response(404)
        )
      },

      'POST': function ({ mesh, ep }, req) {
        mesh = URL.decodeComponent(mesh)
        var labels = JSON.decode(req.body)
        return api.setEndpointLabels(mesh, ep, labels).then(
          ret => response(ret ? 201 : 403)
        )
      },
    },

    '/api/meshes/{mesh}/endpoints/{ep}/log': {
      'GET': function ({ mesh, ep }) {
        mesh = URL.decodeComponent(mesh)
        return api.getEndpointLog(mesh, ep).then(
          ret => ret ? response(200, ret) : response(404)
        )
      },
    },

    //
    // Users
    //   name: string
    //   endpoints:
    //     count: number
    //     instances: [{
    //       id: string
    //       name: string
    //       labels: [string]
    //       ip: string
    //       port: number
    //       heartbeat: number
    //       ping: number
    //       online: boolean
    //       isLocal: boolean
    //     }]
    //

    '/api/meshes/{mesh}/users': {
      'GET': function ({ mesh }, req) {
        mesh = URL.decodeComponent(mesh)
        var params = new URL(req.head.path).searchParams
        var name = params.get('name')
        var keyw = params.get('keyword')
        var offset = Number.parseInt(params.get('offset')) || 0
        var limit = Number.parseInt(params.get('limit')) || 100
        return api.allUsers(
          mesh,
          name && URL.decodeComponent(name),
          keyw && URL.decodeComponent(keyw),
          offset, limit
        ).then(
          ret => response(200, ret)
        )
      },
    },

    '/api/meshes/{mesh}/users/{username}': {
      'GET': function ({ mesh, username }, req) {
        mesh = URL.decodeComponent(mesh)
        username = URL.decodeComponent(username)
        return api.allUsers(mesh, username).then(
          ret => ret.length > 0 ? response(200, ret[0]) : response(404)
        )
      },

      'DELETE': function ({ mesh, username }) {
        mesh = URL.decodeComponent(mesh)
        username = URL.decodeComponent(username)
        return api.delUser(mesh, username).then(
          () => response(204)
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
      'GET': function ({ mesh }, req) {
        mesh = URL.decodeComponent(mesh)
        var url = new URL(req.head.path)
        var since = url.searchParams.get('since')
        return api.allFiles(mesh, since).then(
          ret => response(200, ret)
        )
      }
    },

    '/api/meshes/{mesh}/files/*': {
      'GET': function (params) {
        var mesh = URL.decodeComponent(params.mesh)
        var path = URL.decodeComponent(params['*'])
        return api.getFileInfo(mesh, path).then(
          ret => ret ? response(200, ret) : response(404)
        )
      },

      'DELETE': function (params) {
        var mesh = URL.decodeComponent(params.mesh)
        var path = URL.decodeComponent(params['*'])
        return api.delFileInfo(mesh, path).then(
          ret => ret ? response(204) : response(404)
        )
      },
    },

    '/api/meshes/{mesh}/file-data/*': {
      'GET': function (params) {
        var mesh = URL.decodeComponent(params.mesh)
        var path = URL.decodeComponent(params['*'])
        return api.getFileData(mesh, path).then(
          ret => ret ? response(200, ret) : response(404)
        )
      },

      'POST': function (params, req) {
        var mesh = URL.decodeComponent(params.mesh)
        var path = URL.decodeComponent(params['*'])
        return api.setFileData(mesh, path, req.body).then(
          ret => ret ? response(201) : response(404)
        )
      },

      'DELETE': function (params) {
        var mesh = URL.decodeComponent(params.mesh)
        var path = URL.decodeComponent(params['*'])
        return api.delFileData(mesh, path).then(
          ret => ret ? response(204) : response(404)
        )
      },
    },

    '/api/meshes/{mesh}/endpoints/{ep}/file-data/{hash}': {
      'GET': function ({ mesh, ep, hash }) {
        mesh = URL.decodeComponent(mesh)
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
        mesh = URL.decodeComponent(mesh)
        return api.allApps(mesh).then(
          ret => response(200, ret)
        )
      },
    },

    '/api/meshes/{mesh}/endpoints/{ep}/apps': {
      'GET': function ({ mesh, ep }) {
        mesh = URL.decodeComponent(mesh)
        return api.allApps(mesh, ep).then(
          ret => response(200, ret)
        )
      },
    },

    '/api/meshes/{mesh}/endpoints/{ep}/apps/{provider}/{app}': {
      'GET': function ({ mesh, ep, provider, app }) {
        mesh = URL.decodeComponent(mesh)
        provider = URL.decodeComponent(provider)
        app = URL.decodeComponent(app)
        return api.getApp(mesh, ep, provider, app).then(
          ret => ret ? response(200, ret) : response(404)
        )
      },

      'POST': function ({ mesh, ep, provider, app }, req) {
        mesh = URL.decodeComponent(mesh)
        provider = URL.decodeComponent(provider)
        app = URL.decodeComponent(app)
        return api.setApp(mesh, ep, provider, app, JSON.decode(req.body)).then(
          ret => response(201, ret)
        )
      },

      'DELETE': function ({ mesh, ep, provider, app }) {
        mesh = URL.decodeComponent(mesh)
        provider = URL.decodeComponent(provider)
        app = URL.decodeComponent(app)
        return api.delApp(mesh, ep, provider, app).then(response(204))
      },
    },

    '/api/meshes/{mesh}/endpoints/{ep}/apps/{provider}/{app}/log': {
      'GET': function ({ mesh, ep, provider, app }) {
        mesh = URL.decodeComponent(mesh)
        provider = URL.decodeComponent(provider)
        app = URL.decodeComponent(app)
        return api.getAppLog(mesh, ep, provider, app).then(
          ret => ret ? response(200, ret) : response(404)
        )
      }
    },

    //
    // Stats
    //

    '/api/meshes/{mesh}/stats/endpoints': {
      'GET': function ({ mesh }) {
        mesh = URL.decodeComponent(mesh)
        return api.getEndpointStats(mesh).then(
          ret => ret ? response(200, ret) : response(404)
        )
      }
    },

    '/api/meshes/{mesh}/stats/endpoints/{ep}': {
      'GET': function ({ mesh, ep }) {
        mesh = URL.decodeComponent(mesh)
        return api.getEndpointStats(mesh, ep).then(
          ret => ret ? response(200, ret) : response(404)
        )
      }
    },

    '/api/meshes/{mesh}/ping/endpoints/{ep}': {
      'GET': function ({ mesh, ep }) {
        mesh = URL.decodeComponent(mesh)
        return api.pingEndpoint(mesh, ep).then(
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

  var appApiMatch = new http.Match('/api/meshes/{mesh}/apps/{provider}/{app}')
  var appPreMatch = new http.Match('/api/meshes/{mesh}/apps/{provider}/{app}/*')

  var $params
  var $appPipeline
  var $appSession

  var appSessionPools = new algo.Cache(
    k => new algo.LoadBalancer([{}])
  )

  pipy.listen(listen, { idleTimeout: 0 }, $=>$
    .demuxHTTP().to($=>$
      .pipe(
        function (evt) {
          if (evt instanceof MessageStart) {
            var path = evt.head.path
            if (path.startsWith('/api/')) {
              if ($params = appApiMatch(path) || appPreMatch(path)) {
                var url = new URL(path)
                evt.head.path = '/' + ($params['*'] || '') + url.search
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
            .onStart(
              () => api.connectApp(
                URL.decodeComponent($params.mesh),
                URL.decodeComponent($params.provider),
                URL.decodeComponent($params.app),
              ).then(p => {
                var pool = appSessionPools.get(p)
                $appPipeline = p
                $appSession = pool.allocate()
              }).catch(() => {})
            )
            .pipe(() => $appPipeline ? 'pass' : 'deny', {
              'pass': $=>$.muxHTTP(() => $appSession).to($=>$
                .pipe(
                  () => $appPipeline,
                  () => ({ source: 'user' })
                )
              ),
              'deny': $=>$.replaceData().replaceMessage(
                new Message({ status: 503 }, 'Cannot start the app')
              ),
            })
            .onEnd(() => $appSession?.free?.())
          ),
          'gui': $=>$.replaceMessage(
            req => gui.serve(req) || new Message({ status: 404 })
          ),
        }
      )
    )
  )
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
  console.error(e)
  if (typeof e === 'object') {
    return response(e.status || 500, e)
  } else {
    return response(500, { status: 500, message: e })
  }
}

function validateName(name, msg) {
  if (name) {
    if (name.indexOf('/') >= 0) {
      throw msg
    }
  }
}
