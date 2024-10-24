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

    '/api/users': {
      'GET': responder(() => api.allUsers().then(
        ret => ret ? response(200, ret) : response(404)
      ))
    },

    '/api/chats': {
      'GET': responder(() => api.allChats().then(
        ret => ret ? response(200, ret) : response(404)
      ))
    },

    '/api/peers/{peer}/messages': {
      'GET': responder((params, req) => {
        var peer = URL.decodeComponent(params.peer)
        var url = new URL(req.head.path)
        var since = url.searchParams.get('since')
        var before = url.searchParams.get('before')
        if (since) since = Number.parseFloat(since)
        if (before) before = Number.parseFloat(before)
        return api.allPeerMessages(peer, since, before).then(
          ret => ret ? response(200, ret) : response(404)
        )
      }),

      'POST': responder((params, req) => {
        var peer = URL.decodeComponent(params.peer)
        return api.addPeerMessage(peer, JSON.decode(req.body)).then(
          ret => response(ret ? 201 : 404)
        )
      }),
    },

    '/api/groups/{creator}/{group}': {
      'GET': responder((params) => {
        var creator = URL.decodeComponent(params.creator)
        var group = URL.decodeComponent(params.group)
        return api.getGroup(creator, group).then(
          ret => ret ? response(200, ret) : response(404)
        )
      }),

      'POST': responder((params, req) => {
        var creator = URL.decodeComponent(params.creator)
        var group = URL.decodeComponent(params.group)
        return api.setGroup(creator, group, JSON.decode(req.body)).then(
          ret => response(ret ? 201 : 403)
        )
      }),
    },

    '/api/groups/{creator}/{group}/messages': {
      'GET': responder((params, req) => {
        var creator = URL.decodeComponent(params.creator)
        var group = URL.decodeComponent(params.group)
        var url = new URL(req.head.path)
        var since = url.searchParams.get('since')
        var before = url.searchParams.get('before')
        if (since) since = Number.parseFloat(since)
        if (before) before = Number.parseFloat(before)
        return api.allGroupMessages(creator, group, since, before).then(
          ret => ret ? response(200, ret) : response(404)
        )
      }),

      'POST': responder((params, req) => {
        var creator = URL.decodeComponent(params.creator)
        var group = URL.decodeComponent(params.group)
        return api.addGroupMessage(creator, group, JSON.decode(req.body)).then(
          ret => response(ret ? 201 : 404)
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
