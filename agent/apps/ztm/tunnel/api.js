export default function ({ app, mesh, punch }) {
  var currentListens = []
  var currentTargets = {}

  function allEndpoints() {
    return mesh.discover()
  }

  function allInbound(ep) {
    if (ep === app.endpoint.id) {
      return getLocalConfig().then(
        config => config.inbound
      )
    } else {
      return requestPeer(ep, new Message(
        {
          method: 'GET',
          path: `/api/inbound`,
        }
      )).then(res => res ? JSON.decode(res.body) : null)
    }
  }

  function allOutbound(ep) {
    if (ep === app.endpoint.id) {
      return getLocalConfig().then(
        config => config.outbound
      )
    } else {
      return requestPeer(ep, new Message(
        {
          method: 'GET',
          path: `/api/outbound`,
        }
      )).then(res => res ? JSON.decode(res.body) : null)
    }
  }

  function getInbound(ep, protocol, name) {
    if (ep === app.endpoint.id) {
      return getLocalConfig().then(
        config => {
          config.inbound.find(
            i => i.protocol === protocol && i.name === name
          ) || null
        }
      )
    } else {
      return requestPeer(ep, new Message(
        {
          method: 'GET',
          path: `/api/inbound/${protocol}/${name}`,
        }
      )).then(res => res?.head?.status === 200 ? JSON.decode(res.body) : null)
    }
  }

  function getOutbound(ep, protocol, name) {
    if (ep === app.endpoint.id) {
      return getLocalConfig().then(
        config => config.outbound.find(
          o => o.protocol === protocol && o.name === name
        ) || null
      )
    } else {
      return requestPeer(ep, new Message(
        {
          method: 'GET',
          path: `/api/outbound/${protocol}/${name}`,
        }
      )).then(res => res?.head?.status === 200 ? JSON.decode(res.body) : null)
    }
  }

  function setInbound(ep, protocol, name, listens, exits) {
    if (ep === app.endpoint.id) {
      exits = exits || []
      checkProtocol(protocol)
      checkName(name)
      checkListens(listens)
      checkExits(exits)
      return getLocalConfig().then(config => {
        var all = config.inbound
        var ent = { protocol, name, listens, exits }
        var i = all.findIndex(i => i.protocol === protocol && i.name === name)
        if (i >= 0) {
          all[i] = ent
        } else {
          all.push(ent)
        }
        setLocalConfig(config)
        applyLocalConfig(config)
      })
    } else {
      return requestPeer(ep, new Message(
        {
          method: 'POST',
          path: `/api/inbound/${protocol}/${name}`,
        },
        JSON.encode({ listens, exits })
      ))
    }
  }

  function setOutbound(ep, protocol, name, targets, entrances) {
    if (ep === app.endpoint.id) {
      entrances = entrances || []
      checkProtocol(protocol)
      checkName(name)
      checkTargets(targets)
      checkEntrances(entrances)
      return getLocalConfig().then(config => {
        var all = config.outbound
        var ent = { protocol, name, targets, entrances }
        var i = all.findIndex(o => o.protocol === protocol && o.name === name)
        if (i >= 0) {
          all[i] = ent
        } else {
          all.push(ent)
        }
        setLocalConfig(config)
        applyLocalConfig(config)
      })
    } else {
      return requestPeer(ep, new Message(
        {
          method: 'POST',
          path: `/api/outbound/${protocol}/${name}`,
        },
        JSON.encode({ targets, entrances })
      ))
    }
  }

  function deleteInbound(ep, protocol, name) {
    if (ep === app.endpoint.id) {
      return getLocalConfig().then(config => {
        var all = config.inbound
        var i = all.findIndex(i => i.protocol === protocol && i.name === name)
        if (i >= 0) {
          all.splice(i, 1)
          setLocalConfig(config)
        }
      })
    } else {
      return requestPeer(ep, new Message(
        {
          method: 'DELETE',
          path: `/api/inbound/${protocol}/${name}`,
        }
      ))
    }
  }

  function deleteOutbound(ep, protocol, name) {
    if (ep === app.endpoint.id) {
      return getLocalConfig().then(config => {
        var all = config.outbound
        var i = all.findIndex(o => o.protocol === protocol && o.name === name)
        if (i >= 0) {
          all.splice(i, 1)
          setLocalConfig(config)
        }
      })
    } else {
      return requestPeer(ep, new Message(
        {
          method: 'DELETE',
          path: `/api/outbound/${protocol}/${name}`,
        }
      ))
    }
  }

  function createHole(ep, role) {
    var h = punch.findHole(ep)
    if(h) return h

    if(role === 'server') {
      return punch.createOutboundHole(ep)
    } else if(role === 'client') {
      return punch.createInboundHole(ep)
    }
  }

  function updateHoleInfo(ep, ip, port, cert) {
    checkIP(ip)
    checkPort(Number.parseInt(port))
    punch.updateHoleInfo(ep, ip, port, cert)
  }

  function syncPunch(ep) {
    var hole = punch.findHole(ep)
    if(!hole) throw `Invalid Hole State for ${ep}`
    hole.punch()
  }

  function deleteHole(ep, remote) {
    punch.deleteHole(ep, remote)
  }

  function getLocalConfig() {
    return mesh.read('/local/config.json').then(
      data => data ? JSON.decode(data) : { inbound: [], outbound: [] }
    )
  }

  function setLocalConfig(config) {
    mesh.write('/local/config.json', JSON.encode(config))
  }

  function applyLocalConfig(config) {
    currentListens.forEach(l => {
      var protocol = l.protocol
      var ip = l.ip
      var port = l.port
      if (!config.inbound.some(i => (
        i.protocol === protocol &&
        i.listens.some(l => l.ip === ip && l.port === port)
      ))) {
        pipy.listen(`${ip}:${port}`, protocol, null)
        app.log(`Stopped ${protocol} listening ${ip}:${port}`)
      }
    })

    currentListens = []
    currentTargets = {}

    config.inbound.forEach(i => {
      var protocol = i.protocol
      var name = i.name
      var listens = i.listens
      var $selectedEP

      var connectPeer = pipeline($=>$
        .connectHTTPTunnel(
          new Message({
            method: 'CONNECT',
            path: `/api/outbound/${protocol}/${name}`,
          })
        ).to($=>$.pipe(() => {
          punch.createInboundHole($selectedEP)
          var hole = punch.findHole($selectedEP)
          if(hole && hole.ready()) {
            app.log("Using direct session")
            return hole.directSession()
          }
          app.log("Using hub forwarded session")
          return pipeline($=>$
            .muxHTTP().to($=>$
              .pipe(mesh.connect($selectedEP))
            )
          )
        }))
        .onEnd(() => app.log(`Disconnected from ep ${$selectedEP} for ${protocol}/${name}`))
      )

      var pass = null
      var deny = pipeline($=>$.replaceStreamStart(new StreamEnd))

      switch (protocol) {
        case 'tcp':
          pass = connectPeer
          break
        case 'udp':
          pass = pipeline($=>$
            .replaceData(data => new Message(data))
            .encodeWebSocket()
            .pipe(connectPeer)
            .decodeWebSocket()
            .replaceMessage(msg => msg.body)
          )
          break
      }

      var p = pipeline($=>$
        .onStart(() =>
          ((i.exits && i.exits.length > 0)
            ? Promise.resolve(i.exits)
            : mesh.discover().then(list => list.map(ep => ep.id))
          ).then(exits => Promise.all(
            exits.map(
              id => getOutbound(id, protocol, name).then(
                o => o ? { ep: id, ...o } : null
              )
            )
          )).then(list => {
            list = list.filter(o => (o && (
              !o.entrances ||
              o.entrances.length === 0 ||
              o.entrances.includes(app.endpoint.id)
            )))
            if (list.length > 0) {
              $selectedEP = list[Math.floor(Math.random() * list.length)].ep
              app.log(`Connect to ep ${$selectedEP} for ${protocol}/${name}`)
            } else {
              app.log(`No exit found for ${protocol}/${name}`)
            }
            return new Data
          })
        )
        .pipe(() => $selectedEP ? pass : deny)
      )

      listens.forEach(l => {
        try {
          pipy.listen(`${l.ip}:${l.port}`, protocol, p)
          currentListens.push({ protocol, ip: l.ip, port: l.port })
          app.log(`Started ${protocol} listening ${l.ip}:${l.port}`)
        } catch (err) {
          app.log(`Cannot open port ${l.ip}:${l.port}: ${err}`)
        }
      })
    })

    config.outbound.forEach(o => {
      var key = `${o.protocol}/${o.name}`
      currentTargets[key] = new algo.LoadBalancer(o.targets)
    })
  }

  function requestPeer(ep, req) {
    var $response
    return pipeline($=>$
      .onStart(req)
      .pipe(() => {
        var h = punch.findHole(ep)
        if(h && h.ready()) {
          return h.directSession()
        }
        return pipeline($=>$
          .muxHTTP().to($=>$
          .pipe(mesh.connect(ep))
        ))
      })
      .replaceMessage(res => {
        $response = res
        return new StreamEnd
      })
      .onEnd(() => {
        return $response
      })
    ).spawn()
  }

  var matchApiOutbound = new http.Match('/api/outbound/{proto}/{name}')
  var response200 = new Message({ status: 200 })
  var response404 = new Message({ status: 404 })

  var $resource
  var $target
  var $protocol

  var servePeerInbound = pipeline($=>$
    .acceptHTTPTunnel(req => {
      var params = matchApiOutbound(req.head.path)
      var proto = params?.proto
      var name = params?.name
      var key = `${proto}/${name}`
      var lb = currentTargets[key]
      if (lb) {
        $resource = lb.allocate()
        var target = $resource.target
        var host = target.host
        var port = target.port
        $target = `${host}:${port}`
        $protocol = proto
        app.log(`Connect to ${$target} for ${key}`)
        return response200
      }
      app.log(`No target found for ${key}`)
      return response404
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
        $resource.free()
        app.log(`Disconnected from ${$target}`)
      })
    )
  )

  var tunnelHole = null
  var makeRespTunnel = pipeline($=>$
    .onStart(ctx => {
      var ep = ctx.peer.id
      tunnelHole = punch.findHole(ep)
      if(!tunnelHole) throw `Invalid Hole State for ${ep}`
      return new Data
    })
    .pipe(() => {
      var p = tunnelHole.makeRespTunnel()
      tunnelHole = null
      return p
    }, () => tunnelHole)
  )

  getLocalConfig().then(applyLocalConfig)

  return {
    allEndpoints,
    allInbound,
    allOutbound,
    getInbound,
    getOutbound,
    setInbound,
    setOutbound,
    deleteInbound,
    deleteOutbound,
    createHole,
    updateHoleInfo,
    makeRespTunnel,
    syncPunch,
    deleteHole,
    servePeerInbound,
  }
}

function checkProtocol(protocol) {
  switch (protocol) {
    case 'tcp':
    case 'udp':
      return
    default: throw `invalid protocol '${protocol}'`
  }
}

function checkName(name) {
  if (
    typeof name !== 'string' ||
    name.indexOf('/') >= 0
  ) throw `invalid name '${name}'`
}

function checkIP(ip) {
  try {
    new IP(ip)
  } catch {
    throw `malformed IP address '${ip}'`
  }
}

function checkHost(host) {
  if (
    typeof host !== 'string' ||
    host.indexOf(':') >= 0 ||
    host.indexOf('[') >= 0 ||
    host.indexOf(']') >= 0
  ) throw `invalid host '${host}'`
}

function checkPort(port) {
  if (
    typeof port !== 'number' ||
    port < 1 || port > 65535
  ) throw `invalid port number: ${port}`
}

function checkUUID(uuid) {
  if (
    typeof uuid !== 'string' ||
    uuid.length !== 36 ||
    uuid.charAt(8) != '-' ||
    uuid.charAt(13) != '-' ||
    uuid.charAt(18) != '-' ||
    uuid.charAt(23) != '-'
  ) throw `malformed UUID '${uuid}'`
}

function checkListens(listens) {
  if (!(listens instanceof Array)) throw 'invalid listen array'
  listens.forEach(l => {
    if (typeof l !== 'object' || l === null) throw 'invalid listen'
    checkIP(l.ip)
    checkPort(l.port)
  })
}

function checkTargets(targets) {
  if (!(targets instanceof Array)) throw 'invalid target array'
  targets.forEach(t => {
    if (typeof t !== 'object' || t === null) throw 'invalid target'
    checkHost(t.host)
    checkPort(t.port)
  })
}

function checkExits(exits) {
  if (!(exits instanceof Array)) throw 'invalid exit array'
  exits.forEach(e => checkUUID(e))
}

function checkEntrances(entrances) {
  if (!(entrances instanceof Array)) throw 'invalid entrance array'
  entrances.forEach(e => checkUUID(e))
}
