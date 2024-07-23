import initHole from './punch.js'
import initAPI from './api.js'
import initCLI from './cli.js'

export default function ({ app, mesh, utils }) {
  var punch = initHole({ app, mesh })
  var api = initAPI({ app, mesh, punch })
  var cli = initCLI({ app, mesh, utils, api })

  var $ctx

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

    // '/api/punch/{destEp}': {
    //   'GET': responder(({destEp}) => {
    //     return api.createHole(destEp)
    //   }),

    //   'DELETE': responder(({destEp}) => {
    //     api.deleteHole(destEp)
    //     return response(204)
    //   })
    // },

    '*': {
      'GET': responder((_, req) => {
        return Promise.resolve(gui.serve(req) || response(404))
      })
    },
  })

  var servePeer = utils.createServer({
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
      'GET': responder(({ proto, name }) => api.getInbound(app.endpoint.id, proto, name).then(
        ret => ret ? response(200, ret) : response(404)
      )),

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
      'GET': responder(({ proto, name }) => api.getOutbound(app.endpoint.id, proto, name).then(
        ret => ret ? response(200, ret) : response(404)
      )),

      'POST': responder(({ proto, name }, req) => {
        var obj = JSON.decode(req.body)
        var targets = obj.targets
        var entrances = obj.entrances || null
        return api.setOutbound(app.endpoint.id, proto, name, targets, entrances).then(response(201))
      }),

      'DELETE': responder(({ proto, name }) => {
        return api.deleteOutbound(app.endpoint.id, proto, name).then(response(204))
      }),

      'CONNECT': api.servePeerInbound,
    },

    '/api/ping': {
      'GET': responder(() => Promise.resolve(response(200)))
    },

    '/api/punch/{action}': {
      'GET': responder(({action}) => {
        var ep = $ctx.peer.id
        var ip = $ctx.peer.ip
        var port = $ctx.peer.port

        app.log(`Punch Event: ${action} from ${ep} ${ip} ${port}`)
        switch(action) {
          case 'leave':
            api.deleteHole(ep, true)
            break
          default:
            return Promise.resolve(response(500, "Unknown punch action"))
        }
        return Promise.resolve(response(200))
      }),

      'POST': responder(({action}, req) => {
        var obj = JSON.decode(req.body)
        var ep = $ctx.peer.id
        var ip = $ctx.peer.ip
        var port = $ctx.peer.port

        app.log(`Punch Event: ${action} from ${ep} ${ip} ${port}`)
        switch(action) {
          case 'request':
            api.createHole(ep, 'server')
            api.updateHoleInfo(ep, ip, port, obj.cert)
            api.syncPunch(ep)
            // var certs = hole.signPeerCert(new crypto.PublicKey(obj.pkey))
            // return Promise.resolve(response(200, cert))
            break
          case 'accept':
            api.updateHoleInfo(ep, ip, port, obj.cert)
            api.syncPunch(ep)
            break
          default:
            return Promise.resolve(response(500, "Unknown punch action"))
        }
        return Promise.resolve(response(200))
      }),

      'CONNECT': pipeline($=>$.pipe(api.makeRespTunnel, () => $ctx))
    },
  })

  punch.setService((ctx) => {
    // Tricky callback to set ctx,
    // expecting everything in hole works
    // just like it's coming from hub.
    $ctx = ctx
    return servePeer
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
