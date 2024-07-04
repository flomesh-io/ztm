export default function ({ app, mesh }) {

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
        config => config.inbound.find(
          i => i.protocol === protocol && i.name === name
        ) || null
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
        advertiseLocalConfig()
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
        advertiseLocalConfig()
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
          advertiseLocalConfig()
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
          advertiseLocalConfig()
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

  function getLocalConfig() {
    return mesh.read('/local/config.json').then(
      data => data ? JSON.decode(data) : { inbound: [], outbound: [] }
    )
  }

  function setLocalConfig(config) {
    mesh.write('/local/config.json', JSON.encode(config))
  }

  function advertiseLocalConfig() {
    mesh.read('/local/config.json').then(
      data => mesh.write(`/endpoints/${app.endpoint.id}/config.json`, data)
    )
  }

  function requestPeer(ep, req) {
    var $response
    return pipeline($=>$
      .onStart(req)
      .muxHTTP().to($=>$
        .pipe(mesh.connect(ep))
      )
      .replaceMessage(res => {
        $response = res
        return new StreamEnd
      })
      .onEnd(() => $response)
    ).spawn()
  }

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
