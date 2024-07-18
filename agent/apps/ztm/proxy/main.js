import initAPI from './api.js'
import initCLI from './cli.js'

export default function ({ app, mesh, utils }) {
  var api = initAPI({ app, mesh })
  var cli = initCLI({ app, mesh, utils, api })

  var $ctx

  var gui = new http.Directory(os.path.join(app.root, 'gui'))
  var response = utils.createResponse
  var responder = utils.createResponder

  var serveUser = utils.createServer({
    '/cli': {
      'CONNECT': utils.createCLIResponder(cli),
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
    '/api/config': {
      'GET': responder(() => api.getEndpointConfig(app.endpoint.id).then(
        ret => ret ? response(200, ret) : response(404)
      )),

      'POST': responder((_, req) => {
        var config = JSON.decode(req.body)
        return api.setEndpointConfig(app.endpoint.id, config).then(response(201))
      }),
    },

    '/api/targets/*': {
      'CONNECT': api.acceptPeer,
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
