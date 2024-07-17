import initAPI from './api.js'
import initCLI from './cli.js'

export default function ({ app, mesh, utils }) {
  var api = initAPI({ app, mesh })
  var cli = initCLI({ app, mesh, utils, api })

  var $ctx
  var $ep

  var response = utils.createResponse
  var responder = utils.createResponder

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

    '/api/scripts/{hash}': {
      'GET': responder(({ hash }) => {
        var script = api.getScript(hash)
        return Promise.resolve(script ? response(200, script) : response(404))
      })
    },

    '/api/endpoints/{ep}/script': {
      'POST': pipeline($=>$
        .onStart(params => void ($ep = params.ep))
        .pipe(api.executeScriptRemote, () => $ep)
      ),
    },
  })

  var servePeer = utils.createServer({
    '/api/script': {
      'POST': api.executeScriptLocal,
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
