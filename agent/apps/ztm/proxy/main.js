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

    '/api/endpoints': {
      'GET': responder(() => api.allEndpoints().then(
        ret => ret ? response(200, ret) : response(404)
      ))
    },

    '/api/endpoints/{ep}/config': {
      'GET': responder(({ ep }) => api.getEndpointConfig(ep).then(
        ret => ret ? response(200, ret) : response(404)
      )),

      'POST': responder(({ ep }, req) => {
        var config = JSON.decode(req.body)
        return api.setEndpointConfig(ep, config).then(response(201))
      }),
    },

    '*': {
      'GET': responder((_, req) => {
        return Promise.resolve(gui.serve(req) || response(404))
      })
    },
  })

  var servePeer = utils.createServer({
    '/api/ca': {
      'GET': responder(() => api.getEndpointCA(app.endpoint.id).then(
        ret => ret ? response(200, ret) : response(404)
      )),
    },

    '/api/config': {
      'GET': responder(() => api.getEndpointConfig(app.endpoint.id).then(
        ret => ret ? response(200, ret) : response(404)
      )),

      'POST': responderOwnerOnly((_, req) => {
        var config = JSON.decode(req.body)
        return api.setEndpointConfig(app.endpoint.id, config).then(response(201))
      }),
    },

    '/api/targets/*': {
      'CONNECT': pipeline($=>$.pipe(api.acceptPeer, () => $ctx)),
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
