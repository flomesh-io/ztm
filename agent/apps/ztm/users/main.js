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

    //
    // Groups
    //
    '/api/groups': {
      'GET': responder(({}) => {
        var obj = [{
          id: "ea4f1005-63b4-3b06-a44f-e952c58250a5",
          name: "group1",
          users: ['user1', 'user2']
        }]
        return Promise.resolve(response(200, obj))
      }),
      'POST': responder(({}) => {
        return Promise.resolve(response(200))
      }),
    },
    '/api/groups/{group}': {
      'GET': responder(({}) => {
        var obj = {
          id: "ea4f1005-63b4-3b06-a44f-e952c58250a5",
          name: "group1",
          users: ['user1', 'user2']
        }
        return Promise.resolve(response(200, obj))
      }),
      'POST': responder(({}) => {
        return Promise.resolve(response(200))
      }),
      'DELETE': responder(({}) => {
        return Promise.resolve(response(200))
      }),
    },

    '/api/groups/user/{user}': {
      'GET': responder(({}) => {
        mesh = URL.decodeComponent(mesh)
        var obj = [{
          id: "ea4f1005-63b4-3b06-a44f-e952c58250a5",
          name: "group1"
        }, {
          id: "3f31e539-455c-f9b0-024e-117af039026a",
          name: "group2"
        }]
        return Promise.resolve(response(200, obj))
      }),
    },

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

    '/api/endpoints': {
      'GET': responder(() => api.allEndpoints().then(
        ret => ret ? response(200, ret) : response(404)
      ))
    },

    '/api/endpoints/{ep}/inbound': {
      'GET': responder(({ ep }) => api.allInbound(ep).then(
        ret => ret ? response(200, ret) : response(404)
      ))
    },

    '/api/endpoints/{ep}/outbound': {
      'GET': responder(({ ep }) => api.allOutbound(ep).then(
        ret => ret ? response(200, ret) : response(404)
      ))
    },

    '/api/endpoints/{ep}/inbound/{proto}/{name}': {
      'GET': responder(({ ep, proto, name }) => {
        return api.getInbound(ep, proto, URL.decodeComponent(name)).then(
          ret => ret ? response(200, ret) : response(404)
        )
      }),

      'POST': responder(({ ep, proto, name }, req) => {
        var obj = JSON.decode(req.body)
        var listens = obj.listens
        var exits = obj.exits || null
        return api.setInbound(ep, proto, URL.decodeComponent(name), listens, exits).then(response(201))
      }),

      'DELETE': responder(({ ep, proto, name }) => {
        return api.deleteInbound(ep, proto, URL.decodeComponent(name)).then(response(204))
      }),

    },

    '/api/endpoints/{ep}/outbound/{proto}/{name}': {
      'GET': responder(({ ep, proto, name }) => {
        return api.getOutbound(ep, proto, URL.decodeComponent(name)).then(
          ret => response(200, ret)
        )
      }),

      'POST': responder(({ ep, proto, name }, req) => {
        var obj = JSON.decode(req.body)
        var targets = obj.targets
        var entrances = obj.entrances
        var users = obj.users
        return api.setOutbound(ep, proto, URL.decodeComponent(name), targets, entrances, users).then(response(201))
      }),

      'DELETE': responder(({ ep, proto, name }) => {
        return api.deleteOutbound(ep, proto, URL.decodeComponent(name)).then(response(204))
      }),
    },

    '*': {
      'GET': responder((_, req) => {
        return Promise.resolve(gui.serve(req) || response(404))
      })
    },
  })

  var servePeer = utils.createServer({
    '/api/tunnels': {
      'GET': responderOwnerOnly(() => api.allTunnels(app.endpoint.id).then(
        ret => ret ? response(200, ret) : response(404)
      ))
    },

    '/api/inbound': {
      'GET': responderOwnerOnly(() => api.allInbound(app.endpoint.id).then(
        ret => ret ? response(200, ret) : response(404)
      ))
    },

    '/api/outbound': {
      'GET': responder(() => api.allOutbound(app.endpoint.id).then(ret => {
        var ep = $ctx.peer.id
        var user = $ctx.peer.username
        return ret ? response(200, ret.filter(o => api.canAccess(o, ep, user))) : response(404)
      }))
    },

    '/api/inbound/{proto}/{name}': {
      'GET': responderOwnerOnly(({ proto, name }) => api.getInbound(app.endpoint.id, proto, URL.decodeComponent(name)).then(
        ret => ret ? response(200, ret) : response(404)
      )),

      'POST': responderOwnerOnly(({ proto, name }, req) => {
        var obj = JSON.decode(req.body)
        var listens = obj.listens
        var exits = obj.exits || null
        return api.setInbound(app.endpoint.id, proto, URL.decodeComponent(name), listens, exits).then(response(201))
      }),

      'DELETE': responderOwnerOnly(({ proto, name }) => {
        return api.deleteInbound(app.endpoint.id, proto, URL.decodeComponent(name)).then(response(204))
      }),
    },

    '/api/outbound/{proto}/{name}': {
      'GET': responder(({ proto, name }) => api.getOutbound(app.endpoint.id, proto, URL.decodeComponent(name)).then(
        ret => ret && api.canAccess(ret, $ctx.peer.id, $ctx.peer.username) ? response(200, ret) : response(404)
      )),

      'POST': responderOwnerOnly(({ proto, name }, req) => {
        var obj = JSON.decode(req.body)
        var targets = obj.targets
        var entrances = obj.entrances
        var users = obj.users
        return api.setOutbound(app.endpoint.id, proto, URL.decodeComponent(name), targets, entrances, users).then(response(201))
      }),

      'DELETE': responderOwnerOnly(({ proto, name }) => {
        return api.deleteOutbound(app.endpoint.id, proto, URL.decodeComponent(name)).then(response(204))
      }),

      'CONNECT': pipeline($=>$.pipe(api.servePeerInbound, () => $ctx)),
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
