export default function ({ app, mesh }) {
  var currentListens = []

  function getListenStatus(protocol, listen) {
    var l = currentListens.find(l => (l.protocol === protocol && l.listen === listen))
    if (l) return { open: l.open, error: l.error }
    return { open: false }
  }

  function checkResponse(res, f) {
    var status = res?.head?.status
    if (200 <= status && status <= 299) {
      return typeof f === 'function' ? f(res.body) : f
    }
    throw res?.head?.statusText || 'No response from peer'
  }

  function allEndpoints() {
    return mesh.discover()
  }

  function allPorts(ep) {
    if (ep === app.endpoint.id) {
      return getLocalConfig().then(
        config => (config.ports || []).map(p => ({ ...p, ...getListenStatus(p.protocol, p.listen) }))
      )
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'GET',
          path: `/api/ports`,
        }
      )).then(res => checkResponse(res, body => JSON.decode(body)))
    }
  }

  function getConfig(ep) {
    if (ep === app.endpoint.id) {
      return getLocalConfig()
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'GET',
          path: `/api/config`,
        }
      )).then(res => checkResponse(res, body => JSON.decode(body)))
    }
  }

  function setConfig(ep, config) {
    if (ep === app.endpoint.id) {
      setLocalConfig(config)
      applyLocalConfig(config)
      return Promise.resolve()
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'POST',
          path: `/api/config`,
        },
        JSON.encode(config)
      )).then(checkResponse)
    }
  }

  function getLocalConfig() {
    return mesh.read('/local/config.json').then(
      data => data ? JSON.decode(data) : {}
    )
  }

  function setLocalConfig(config) {
    mesh.write('/local/config.json', JSON.encode(config))
  }

  function applyLocalConfig(config) {
    var ports = config.ports || []

    currentListens.forEach(l => {
      var protocol = l.protocol
      var listen = l.listen
      if (!ports.some(p => (
        p.protocol === protocol &&
        p.listen === listen
      ))) {
        pipy.listen(listen, protocol, null)
        app.log(`Stopped ${protocol} listening ${listen}`)
      }
    })

    currentListens = []

    ports.forEach(p => {
      var protocol = p.protocol
      var listen = p.listen
      var via = p.via
      var target = p.target

      var connectPeer = pipeline($=>$
        .onStart(() => app.log(`Connect to ep ${via} for ${protocol} target ${target}`))
        .connectHTTPTunnel(
          new Message({
            method: 'CONNECT',
            path: `/api/targets/${protocol}/${URL.encodeComponent(target)}`,
          })
        ).to($=>$
          .muxHTTP().to($=>$
            .pipe(() => mesh.connect(via))
          )
        )
        .onEnd(() => app.log(`Disconnected from ep ${via} for ${protocol} target ${target}`))
      )

      switch (protocol) {
        case 'tcp':
          break
        case 'udp':
          connectPeer = pipeline($=>$
            .replaceData(data => new Message(data))
            .encodeWebSocket()
            .pipe(connectPeer)
            .decodeWebSocket()
            .replaceMessage(msg => msg.body)
          )
          break
      }

      try {
        pipy.listen(listen, protocol, connectPeer)
        currentListens.push({ protocol, listen, via, target, open: true })
        app.log(`Started ${protocol} listening ${listen}`)
      } catch (err) {
        var error = err.message || err.toString()
        currentListens.push({ protocol, listen, via, target, open: false, error })
        app.log(`Cannot open ${protocol} port ${listen}: ${error}`)
      }
    })
  }

  var matchApiTargets = new http.Match('/api/targets/{proto}/{target}')
  var response200 = new Message({ status: 200 })
  var response403 = new Message({ status: 403 })

  var $ctx
  var $target
  var $protocol

  var connectTarget = pipeline($=>$
    .onStart(c => { $ctx = c })
    .acceptHTTPTunnel(req => {
      var params = matchApiTargets(req.head.path)
      var proto = params?.proto
      var target = URL.decodeComponent(params?.target)
      var peer = $ctx.peer
      if (canAccess(proto, target, peer.username)) {
        $target = target
        $protocol = proto
        app.log(`Connect to ${proto} target ${target}`)
        return response200
      } else {
        app.log(`Rejected connection from ${peer.id} (user = ${peer.username}) for ${proto} target ${target}`)
        return response403
      }
    }).to($=>$
      .pipe(() => $protocol, {
        'tcp': ($=>$
          .connect(() => $target)
        ),
        'udp': ($=>$
          .decodeWebSocket()
          .replaceMessage(msg => msg.body)
          .connect(() => $target, { protocol: 'udp' })
          .replaceData(data => new Message(data))
          .encodeWebSocket()
        )
      })
      .onEnd(() => {
        app.log(`Disconnected from ${$protocol} target ${$target}`)
      })
    )
  )

  function canAccess(protocol, target, user) {
    return user === app.username
  }

  getLocalConfig().then(applyLocalConfig)

  return {
    allEndpoints,
    allPorts,
    getConfig,
    setConfig,
    connectTarget,
  }
}
