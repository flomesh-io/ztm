import initAPI from './api.js'
import initCLI from './cli.js'

export default function ({ app, mesh, utils }) {
  var api = initAPI({ app, mesh })
  var cli = initCLI({ app, mesh, utils, api })

  var $ctx

  var gui = new http.Directory(os.path.join(app.root, 'gui'))
  var response = utils.createResponse
  var responder = utils.createResponder
  var responderOwnerOnly = (f) => responder((params, req) => (
    $ctx.peer.username === app.username ? f(params, req) : Promise.resolve(response(403))
  ))

  var serveUser = utils.createServer({
    '/cli': {
      'CONNECT': utils.createCLIResponder(cli),
    },

    '/api/appinfo': {
      'GET': responder(() => Promise.resolve(response(200, {
        name: app.name,
        provider: app.provider,
        username: app.username,
        endpoint: app.endpoint,
      })))
    },

    '/api/services': {
      'GET': responder(() => api.allServices().then(
        ret => ret ? response(200, ret) : response(404)
      ))
    },

    '/svc/*': {
      '*': pipeline($=>$.pipe(api.forwardService, () => $ctx))
    },

    //
    // Service:
    //   name: string
    //   kind: 'llm' | 'tool' | ...
    //   protocol: 'openai' | 'mcp' | ...
    //   metainfo:
    //     version: string
    //     provider: string
    //     description: string
    //   endpoint:
    //     id: string (UUID)
    //     name: string
    //     labels: [string]
    //     username: string
    //     isLocal: boolean
    //     ip: string
    //     ping: number
    //     online: boolean
    //   localRoutes:
    //     - path: /a/b/c
    //     - path: /d/e/f
    //   target:
    //     address: <URL> | <pathname>
    //     headers: object
    //     body: object
    //     argv: [string]
    //     env: object
    //

    '/api/endpoints/{ep}/services': {
      'GET': responder(({ ep }) => {
        return api.allServices(ep).then(
          ret => ret ? response(200, ret) : response(404)
        )
      }),
    },

    '/api/endpoints/{ep}/services/{kind}/{name}': {
      'GET': responder(({ ep, kind, name }) => {
        return api.getService(ep, kind, URL.decodeComponent(name)).then(
          ret => ret ? response(200, ret) : response(404)
        )
      }),

      'POST': responder(({ ep, kind, name }, req) => {
        var info = JSON.decode(req.body)
        return api.setService(ep, kind, URL.decodeComponent(name), info).then(response(201))
      }),

      'DELETE': responder(({ ep, kind, name }) => {
        return api.deleteService(ep, kind, URL.decodeComponent(name)).then(response(204))
      }),
    },

    //
    // Route:
    //   path: /a/b/c
    //   service:
    //     name: string
    //     kind: 'llm' | 'tool' | ...
    //     endpoint:
    //       id: string (UUID)
    //   cors:
    //     allowOrigins: [string]
    //     allowMethods: [string]
    //     allowHeaders: [string]
    //

    '/api/endpoints/{ep}/routes': {
      'GET': responder(({ ep }) => {
        return api.allRoutes(ep).then(
          ret => ret ? response(200, ret) : response(404)
        )
      }),
    },

    '/api/endpoints/{ep}/routes/*': {
      'GET': responder((params) => {
        return api.getRoute(params.ep, '/' + params['*']).then(
          ret => ret ? response(200, ret) : response(404)
        )
      }),

      'POST': responder((params, req) => {
        var info = JSON.decode(req.body)
        return api.setRoute(params.ep, '/' + params['*'], info).then(response(201))
      }),

      'DELETE': responder((params) => {
        return api.deleteRoute(params.ep, '/' + params['*']).then(response(204))
      }),
    },

    '/api/routes': {
      'GET': responder(() => {
        return api.allRoutes(app.endpoint.id).then(
          ret => ret ? response(200, ret) : response(404)
        )
      }),
    },

    '/api/routes/*': {
      'GET': responder((params) => {
        return api.getRoute(app.endpoint.id, '/' + params['*']).then(
          ret => ret ? response(200, ret) : response(404)
        )
      }),

      'POST': responder((params, req) => {
        var info = JSON.decode(req.body)
        return api.setRoute(app.endpoint.id, '/' + params['*'], info).then(response(201))
      }),

      'DELETE': responder((params) => {
        return api.deleteRoute(app.endpoint.id, '/' + params['*']).then(response(204))
      }),
    },

    '*': {
      'GET': responder((_, req) => {
        return Promise.resolve(gui.serve(req) || response(404))
      })
    },
  })

  var servePeer = utils.createServer({
    '/api/services': {
      'GET': responderOwnerOnly(() => api.allServices(app.endpoint.id).then(
        ret => ret ? response(200, ret) : response(404)
      ))
    },

    '/api/services/{kind}/{name}': {
      'GET': responderOwnerOnly(({ kind, name }) => {
        return api.getService(app.endpoint.id, kind, URL.decodeComponent(name)).then(
          ret => ret ? response(200, ret) : response(404)
        )
      }),

      'POST': responderOwnerOnly(({ kind, name }, req) => {
        var info = JSON.decode(req.body)
        return api.setService(app.endpoint.id, kind, URL.decodeComponent(name), info).then(response(201))
      }),

      'DELETE': responderOwnerOnly(({ kind, name }) => {
        return api.deleteService(app.endpoint.id, kind, URL.decodeComponent(name)).then(response(204))
      }),
    },

    '/api/routes': {
      'GET': responderOwnerOnly(() => {
        return api.allRoutes(app.endpoint.id).then(
          ret => ret ? response(200, ret) : response(404)
        )
      }),
    },

    '/api/routes/*': {
      'GET': responderOwnerOnly((params) => {
        return api.getRoute(app.endpoint.id, '/' + params['*']).then(
          ret => ret ? response(200, ret) : response(404)
        )
      }),

      'POST': responderOwnerOnly((params, req) => {
        var info = JSON.decode(req.body)
        return api.setRoute(app.endpoint.id, '/' + params['*'], info).then(response(201))
      }),

      'DELETE': responderOwnerOnly((params) => {
        return api.deleteRoute(app.endpoint.id, '/' + params['*']).then(response(204))
      }),
    },

    '/api/forward/{kind}/{name}': {
      '*': pipeline($=>$.pipe(api.connectService, () => $ctx)),
    },

    '/api/forward/{kind}/{name}/*': {
      '*': pipeline($=>$.pipe(api.connectService, () => $ctx)),
    },
  })

  return pipeline($=>$
    .onStart(c => void ($ctx = c))
    .pipe(() => {
      switch ($ctx.source) {
        case 'user': return serveUser
        case 'peer': return servePeer
      }
    })
  )
}
