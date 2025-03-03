export default function ({ app, mesh }) {
  var currentPorts = []
  var currentACL = []

  function getListenStatus(protocol, listen) {
    var l = currentPorts.find(l => (l.protocol === protocol && l.listen === listen))
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
    var acl = config.acl || []

    currentPorts.forEach(l => {
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

    currentPorts = []

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
        currentPorts.push({ protocol, listen, via, target, open: true })
        app.log(`Started ${protocol} listening ${listen}`)
      } catch (err) {
        var error = err.message || err.toString()
        currentPorts.push({ protocol, listen, via, target, open: false, error })
        app.log(`Cannot open ${protocol} port ${listen}: ${error}`)
      }
    })

    currentACL = []

    acl.forEach(a => {
      var protocol = a.protocol || 'tcp'
      var port = Number.parseInt(a.port) || undefined
      var users = a.users || []
      var address = a.address || ''
      var access = { protocol, port, users }
      try {
        var cidr = address
        if (cidr.lastIndexOf('/') < 0) cidr += '/32'
        var mask = new IPMask(cidr)
        currentACL.push({
          ...access,
          match: addr => mask.contains(addr),
        })
        return
      } catch {}
      try {
        var regexp = new RegExp(address)
        currentACL.push({
          ...access,
          match: addr => regexp.test(addr),
        })
      } catch {}
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

  function canAccess(protocol, target, username) {
    if (username === app.username) return true
    var i = target.lastIndexOf(':')
    if (i < 0) return false
    var host = target.substring(0,i)
    var port = target.substring(i+1)
    if (host === 'localhost') host = '127.0.0.1'
    port = Number.parseInt(port)
    return currentACL.some(a => {
      if (a.protocol !== protocol) return false
      if (a.port && a.port !== port) return false
      if (a.match(host)) return a.users.includes(username)
      return false
    })
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
