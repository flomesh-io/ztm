import initAPI from './api.js'
import initCLI from './cli.js'

export default function ({ app, mesh, utils }) {
  var api = initAPI({ app, mesh })
  var cli = initCLI({ app, mesh, utils, api })

  var $ctx
  var $params

  var gui = new http.Directory(os.path.join(app.root, 'gui'))
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

    '/api/endpoints/{ep}/files': {
      'GET': responder(({ ep }) => api.statFile(ep, '/', app.username).then(
        ret => ret ? response(200, ret) : response(404)
      ))
    },

    '/api/endpoints/{ep}/files/*': {
      'GET': responder((params) => {
        var ep = params.ep
        var pathname = URL.decodeComponent(params['*'])
        return api.statFile(ep, pathname, app.username).then(
          ret => ret ? response(200, ret) : response(404)
        )
      }),

      'POST': responder((params, req) => {
        var ep = params.ep
        var pathname = URL.decodeComponent(params['*'])
        var filenames = JSON.decode(req.body)?.dir || []
        return api.createFiles(ep, pathname, app.username, filenames).then(
          ret => response(ret ? 201 : 404)
        )
      }),

      'DELETE': responder((params) => {
        var ep = params.ep
        var pathname = URL.decodeComponent(params['*'])
        return api.deleteFile(ep, pathname, app.username).then(
          ret => response(ret ? 204 : 404)
        )
      }),
    },

    '/api/endpoints/{ep}/file-data/*': {
      'GET': pipeline($=>$
        .onStart(p => { $params = p })
        .pipe(api.downloadFile, () => ({
          endpoint: $params.ep,
          pathname: URL.decodeComponent($params['*']),
          username: app.username,
        }))
      ),

      'POST': pipeline($=>$
        .onStart(p => { $params = p })
        .pipe(api.uploadFile, () => ({
          endpoint: $params.ep,
          pathname: URL.decodeComponent($params['*']),
          username: app.username,
        }))
      ),
    },

    '/api/endpoints/{ep}/transfers': {
      'GET': responder((params) => {
        var ep = params.ep
        return api.allTransfers(ep, app.username).then(
          ret => response(200, ret)
        )
      })
    },

    '/api/endpoints/{ep}/transfers/*': {
      'GET': responder((params) => {
        var ep = params.ep
        var pathname = URL.decodeComponent(params['*'])
        return api.getTransfer(ep, pathname, app.username).then(
          ret => ret ? response(200, ret) : response(404)
        )
      }),

      'POST': responder((params, req) => {
        var ep = params.ep
        var pathname = URL.decodeComponent(params['*'])
        var source = new URL(req.head.path).searchParams.get('source')
        var sourcePath = req.body.toString()
        return api.startTransfer(ep, pathname, source, sourcePath, app.username).then(
          ret => response(ret ? 201 : 404)
        )
      }),

      'DELETE': responder((params) => {
        var ep = params.ep
        var pathname = URL.decodeComponent(params['*'])
        return api.abortTransfer(ep, pathname, app.username).then(
          ret => response(ret ? 204 : 404)
        )
      }),
    },

    '*': {
      'GET': responder((_, req) => {
        return Promise.resolve(gui.serve(req) || response(404))
      })
    },
  })

  var servePeer = utils.createServer({
    '/api/files': {
      'GET': responder(() => api.statFile(app.endpoint.id, '/', $ctx.peer.username).then(
        ret => ret ? response(200, ret) : response(404)
      ))
    },

    '/api/files/*': {
      'GET': responder((params) => {
        var pathname = URL.decodeComponent(params['*'])
        return api.statFile(app.endpoint.id, pathname, $ctx.peer.username).then(
          ret => ret ? response(200, ret) : response(404)
        )
      }),

      'POST': responder((params, req) => {
        var pathname = URL.decodeComponent(params['*'])
        var filenames = JSON.decode(req.body)?.dir || []
        return api.createFiles(app.endpoint.id, pathname, $ctx.peer.username, filenames).then(
          ret => response(ret ? 201 : 404)
        )
      }),

      'DELETE': responder((params) => {
        var pathname = URL.decodeComponent(params['*'])
        return api.deleteFile(app.endpoint.id, pathname, $ctx.peer.username).then(
          ret => response(ret ? 204 : 404)
        )
      }),
    },

    '/api/file-data/*': {
      'GET': pipeline($=>$
        .onStart(p => { $params = p })
        .pipe(api.downloadFile, () => ({
          endpoint: app.endpoint.id,
          pathname: URL.decodeComponent($params['*']),
          username: $ctx.peer.username,
        }))
      ),

      'POST': pipeline($=>$
        .onStart(p => { $params = p })
        .pipe(api.uploadFile, () => ({
          endpoint: app.endpoint.id,
          pathname: URL.decodeComponent($params['*']),
          username: $ctx.peer.username,
        }))
      ),
    },

    '/api/transfers': {
      'GET': responder(() => {
        return api.allTransfers(app.endpoint.id, $ctx.peer.username).then(
          ret => response(200, ret)
        )
      })
    },

    '/api/transfers/*': {
      'GET': responder((params) => {
        var pathname = URL.decodeComponent(params['*'])
        return api.getTransfer(app.endpoint.id, pathname, $ctx.peer.username).then(
          ret => ret ? response(200, ret) : response(404)
        )
      }),

      'POST': responder((params, req) => {
        var pathname = URL.decodeComponent(params['*'])
        var source = new URL(req.head.path).searchParams.get('source')
        var sourcePath = req.body.toString()
        return api.startTransfer(app.endpoint.id, pathname, source, sourcePath, $ctx.peer.username).then(
          ret => response(ret ? 201 : 404)
        )
      }),

      'DELETE': responder((params) => {
        var pathname = URL.decodeComponent(params['*'])
        return api.abortTransfer(app.endpoint.id, pathname, $ctx.peer.username).then(
          ret => response(ret ? 204 : 404)
        )
      }),
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
