import initAPI from './api.js'
import initCLI from './cli.js'
import service, { responder, response } from './service.js'

export default function ({ app, mesh }) {
  var api = initAPI({ app, mesh })
  var cli = initCLI({ app, mesh, api })

  var $ctx
  var $argv

  var serveUser = service({
    '/cli': {
      'CONNECT': pipeline($=>$
        .acceptHTTPTunnel(req => {
          var url = new URL(req.head.path)
          $argv = JSON.parse(URL.decodeComponent(url.searchParams.get('argv')))
          return new Message({ status: 200 })
        }).to($=>$
          .onStart(new Data)
          .pipe(cli, () => [$argv])
        )
      ),
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
        return api.getInbound(ep, proto, name).then(
          ret => ret ? response(200, ret) : response(404)
        )
      }),

      'POST': responder(({ ep, proto, name }, req) => {
        var obj = JSON.decode(req.body)
        var listens = obj.listens
        var exits = obj.exits || null
        return api.setInbound(ep, proto, name, listens, exits).then(response(201))
      }),

      'DELETE': responder(({ ep, proto, name }) => {
        return api.deleteInbound(ep, proto, name).then(response(204))
      }),

    },

    '/api/endpoints/{ep}/outbound/{proto}/{name}': {
      'GET': responder(({ ep, proto, name }) => {
        return api.getOutbound(ep, proto, name).then(
          ret => ret ? response(200, ret) : response(404)
        )
      }),

      'POST': responder(({ ep, proto, name }, req) => {
        var obj = JSON.decode(req.body)
        var targets = obj.targets
        var entrances = obj.entrances || null
        return api.setOutbound(ep, proto, name, targets, entrances).then(response(201))
      }),

      'DELETE': responder(({ ep, proto, name }) => {
        return api.deleteOutbound(ep, proto, name).then(response(204))
      }),
    },
  })

  var servePeer = service({
    '/api/inbound': {
      'GET': responder(() => api.allInbound(app.endpoint.id).then(
        ret => ret ? response(200, ret) : response(404)
      ))
    },

    '/api/outbound': {
      'GET': responder(() => api.allOutbound(app.endpoint.id).then(
        ret => ret ? response(200, ret) : response(404)
      ))
    },

    '/api/inbound/{proto}/{name}': {
      'POST': responder(({ proto, name }, req) => {
        var obj = JSON.decode(req.body)
        var listens = obj.listens
        var exits = obj.exits || null
        return api.setInbound(app.endpoint.id, proto, name, listens, exits).then(response(201))
      }),

      'DELETE': responder(({ proto, name }) => {
        return api.deleteInbound(app.endpoint.id, proto, name).then(response(204))
      }),
    },

    '/api/outbound/{proto}/{name}': {
      'POST': responder(({ proto, name }, req) => {
        var obj = JSON.decode(req.body)
        var targets = obj.targets
        var entrances = obj.entrances || null
        return api.setOutbound(app.endpoint.id, proto, name, targets, entrances).then(response(201))
      }),

      'DELETE': responder(({ proto, name }) => {
        return api.deleteOutbound(app.endpoint.id, proto, name).then(response(204))
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
