export default function ({ app, mesh }) {
  var $ctx
  var $config
  var $shell

  function allEndpoints() {
    return mesh.discover()
  }

  function getEndpointConfig(ep) {
    if (ep === app.endpoint.id) {
      return getLocalConfig()
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'GET',
          path: `/api/config`,
        }
      )).then(res => {
        var status = res?.head?.status
        if (!(200 <= status && status <= 299)) throw res.head.statusText
        return JSON.decode(res.body)
      })
    }
  }

  function setEndpointConfig(ep, config) {
    if (ep === app.endpoint.id) {
      setLocalConfig(config)
      return Promise.resolve()
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'POST',
          path: `/api/config`,
        },
        JSON.encode(config)
      ))
    }
  }

  function openTerminal(ep) {
    return pipeline($=>$
      .connectHTTPTunnel(
        new Message({
          method: 'CONNECT',
          path: '/api/shell',
        })
      ).to($=>$
        .muxHTTP().to($=>$
          .pipe(mesh.connect(ep))
        )
      )
    )
  }

  var serveTerminal = pipeline($=>$
    .onStart(c => {
      $ctx = c
      return getLocalConfig().then(config => { $config = config })
    })
    .acceptHTTPTunnel(() => new Message({ status: 200 })).to($=>$
      .pipe(() => canAccess($ctx.peer.username) ? 'exec' : 'deny', {
        'exec': ($=>$
          .onStart(() => {
            $shell = $config.shell || os.env['SHELL'] || 'sh'
            return new Data
          })
          .exec(
            () => $shell, {
              pty: true,
              onExit: () => new StreamEnd
            }
          )
        ),
        'deny': ($=>$
          .replaceStreamStart(new StreamEnd)
          .replaceData()
          .replaceStreamEnd(eos => [new Data('Forbidden\n'), eos])
        ),
      })
    )
  )

  function canAccess(username) {
    if (username === app.username) return true
    var users = $config.users
    if (users instanceof Array && users.includes(username)) return true
    return false
  }

  function getLocalConfig() {
    return mesh.read('/local/config.json').then(
      data => data ? JSON.decode(data) : {}
    )
  }

  function setLocalConfig(config) {
    mesh.write('/local/config.json', JSON.encode(config))
  }

  return {
    allEndpoints,
    getEndpointConfig,
    setEndpointConfig,
    openTerminal,
    serveTerminal,
  }
}
