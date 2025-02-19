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

    //
    // Groups
    //
    '/api/groups': {
      'GET': responder(({}) => {
        return api.getGroups().then(
          ret => ret ? response(200, ret) : response(404)
        )
      }),
    },
    '/api/groups/{group}': {
      'GET': responder(({group}) => {
        return api.getGroup(group).then(
          ret => ret ? response(200, ret) : response(404)
        )
      }),
      'POST': responder(({group}, req) => {
        var obj = JSON.decode(req.body)
        var name = obj.name
        var users = obj.users
        return api.setGroups(group, name, users).then(
          ret => response(ret ? 201 : 403)
        )
      }),
      'DELETE': responder(({group}) => {
        return api.deleteGroup(group).then(
          ret => response(ret ? 200 : 404)
        )
      }),
    },

    '/api/groups/user/{user}': {
      'GET': responder(({user}) => {
        return api.getUserGroups(user).then(
          ret => ret ? response(200, ret) : response(404)
        )
      }),
    },

    '/api/users': {
      'GET': responder(() => api.allUsers().then(
        ret => ret ? response(200, ret) : response(404)
      ))
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
