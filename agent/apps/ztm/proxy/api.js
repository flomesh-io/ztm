import initCertGen from './cert-gen.js'
export default function ({ app, mesh }) {
  var certGen = null

  var currentConfig = null
  var currentListen = ''
  var currentRules = []
  var currentLogger = null

  app.onExit(() => {
    if (currentListen) {
      pipy.listen(currentListen, null)
      currentListen = ''
    }
  })

  function getEndpointCA(ep) {
    if (ep === app.endpoint.id) {
      if (certGen) {
        return Promise.resolve(certGen.getCA().toPEM().toString())
      } else {
        return Promise.resolve('')
      }
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'GET',
          path: '/api/ca',
        }
      )).then(res => res?.body?.toString?.() || '')
    }
  }

  function getEndpointConfig(ep) {
    if (ep === app.endpoint.id) {
      return getLocalConfig()
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'GET',
          path: '/api/config',
        }
      )).then(res => res ? JSON.decode(res.body) : null)
    }
  }

  function setEndpointConfig(ep, config) {
    if (ep === app.endpoint.id) {
      setLocalConfig(config)
      publishConfig(config)
      applyConfig(config)
      applyRules(config)
      return Promise.resolve()
    } else {
      return mesh.request(ep, new Message(
        {
          method: 'POST',
          path: `/api/config`,
        },
        JSON.encode(config)
      )).then(res => {
        var status = res?.head?.status
        if (!(200 <= status && status <= 299)) throw res.head.statusText
      })
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

  function publishConfig(config) {
    var pathname = `/shared/${app.username}/${app.endpoint.id}/config.json`
    if (config?.targets instanceof Array && config.targets.length > 0) {
      mesh.write(pathname, JSON.encode({
        targets: config.targets,
        exclusions: config?.exclusions,
      }))
    } else {
      mesh.erase(pathname)
    }
  }

  function applyConfig(config) {
    currentConfig = config

    if (config.listen !== currentListen) {
      if (currentListen) pipy.listen(currentListen, null)
      currentListen = config.listen || ''
      if (currentListen) {
        var $protocol
        pipy.listen(currentListen, $=>$
          .detectProtocol(proto => $protocol = proto)
          .pipe(() => {
            if ($protocol !== undefined) {
              return $protocol === 'HTTP' ? httpProxy : socksProxy
            }
          })
        )
      }
    }

    if (config.generateCert) {
      certGen ??= initCertGen({ app, mesh })
    } else {
      certGen = null
    }

    if (config.log) {
      currentLogger = new logging.JSONLogger('ztm-proxy')
      if (config.log.splunk) {
        currentLogger.toHTTP(
          `http://${config.log.splunk.address}/services/collector/event`, {
            method: 'POST',
            headers: {
              'Agent': 'ZTM Proxy',
              'Content-Type': 'application/json',
              'Authorization': 'Splunk ' + config.log.splunk.token,
            }
          }
        )
      }
    } else {
      currentLogger = null
    }
  }

  function applyRules(config) {
    // config.rules = [{
    //   users: [string],
    //   groups: [string],
    //   targets: [string],
    //   action: 'allow' | 'deny',
    // }]
    var groups = {}
    var rules = (config.rules || []).map(rule => {
      if (rule.groups instanceof Array) {
        rule.groups.forEach(gid => groups[gid] ??= {})
      }
      return rule
    })
    return Promise.all(
      Object.keys(groups).map(
        gid => queryGroupMembers.spawn(gid).then(
          result => {
            if (result) {
              var members = groups[gid]
              result.users.forEach(
                username => members[username] = true
              )
            }
          }
        )
      )
    ).then(() => {
      currentRules = rules.map(rule => {
        var users = {}
        if (rule.users instanceof Array) {
          rule.users.forEach(username => users[username] = true)
        }
        if (rule.groups instanceof Array) {
          rule.groups.forEach(gid => Object.assign(users, groups[gid]))
        }
        return {
          users: Object.keys(users),
          targets: rule.targets || [],
          action: rule.action,
        }
      })
    })
  }

  var $result = null

  var queryGroupMembers = pipeline($=>$
    .onStart(gid => new Message({ method: 'GET', path: `/api/groups/${gid}` }))
    .muxHTTP().to($=>$.pipe(mesh.connect({ app: 'users' })))
    .handleMessage(res => $result = (res?.head?.status === 200 ? JSON.decode(res.body) : null))
    .replaceMessage(new StreamEnd)
    .onEnd(() => $result)
  )

  var matchPathTargets = new http.Match('/api/targets/*')

  var $ctx
  var $requestHead
  var $requestTime

  var acceptPeer = pipeline($=>$
    .onStart(c => { $ctx = c })
    .acceptHTTPTunnel(req => {
      var params = matchPathTargets(req.head.path)
      if (params) {
        $target = params['*']
        $host = $target.substring(0, $target.lastIndexOf(':'))
        if (!isExit(currentConfig, $host) || !isAllowed(currentRules, $host, $ctx.peer.username)) {
          currentLogger?.log?.({
            event: {
              time: new Date().toUTCString(),
              username: $ctx.peer.username,
              endpoint: $ctx.peer.id,
              ip: $ctx.peer.ip,
              target: $target,
              denied: true,
            }
          })
          return new Message({ status: 403 })
        }
        app.log(`Forward to ${$target}`)
        return new Message({ status: 200 })
      } else {
        return new Message({ status: 404 })
      }
    }).to($=>$
      .onStart(new Data)
      .detectProtocol(proto => $proto = proto)
      .pipe(
        function() {
          if ($proto === undefined) return
          if ($proto === 'TLS' && certGen) return proxyTLS
          return proxyTCP
        }
      )
    )
  )

  var observe = pipeline($=>$
    .fork().to($=>$
      .decodeHTTPRequest()
      .handleMessageStart(
        (msg) => {
          $requestHead = msg.head
          $requestTime = new Date
        }
      )
      .handleMessageEnd(
        (msg) => {
          currentLogger?.log?.({
            event: {
              time: $requestTime.toUTCString(),
              username: $ctx.peer.username,
              endpoint: $ctx.peer.id,
              ip: $ctx.peer.ip,
              target: $target,
              method: $requestHead.method,
              path: $requestHead.path,
              headers: $requestHead.headers,
              size: msg.tail.headSize + msg.tail.bodySize,
            }
          })
        }
      )
    )
  )

  var proxyTCP = pipeline($=>$
    .pipe(observe)
    .connect(() => $target)
  )

  var proxyTLS = pipeline($=>$
    .acceptTLS({
      certificate: sni => sni ? certGen.generateCertificate(sni) : undefined,
    }).to($=>$
      .pipe(observe)
      .connectTLS().to($=>$
        .connect(() => $target)
      )
    )
  )

  var $host
  var $target
  var $targetEP
  var $proto

  var connectPeer = pipeline($=>$
    .onStart(
      () => mesh.list('/shared').then(
        files => {
          var peers = []
          var pattern = new http.Match('/shared/{username}/{ep}/config.json')
          Object.keys(files).forEach(path => {
            var params = pattern(path)
            if (params) {
              peers.push(params.ep)
            }
          })
          return mesh.discover(peers)
        }
      ).then(
        peers => Promise.any(peers.map(
          ep => {
            if (!ep?.online) return Promise.reject(null)
            return mesh.request(
              ep.id,
              new Message({ path: '/api/config' })
            ).then(res => {
              var config = res?.head?.status === 200 ? JSON.decode(res.body) : {}
              if (isExit(config, $host)) return ep
              throw null
            })
          }
        ))
      ).then(ep => {
        $targetEP = ep.id
        app.log(`Forward to ${$target} via ${ep.name} (${ep.id})`)
        return new Data
      }).catch(() => {
        app.log(`No exit found for ${$target}`)
        return new Data
      })
    )
    .pipe(() => $targetEP ? 'pass' : 'deny', {
      'pass': ($=>$
        .connectHTTPTunnel(
          () => new Message({
            method: 'CONNECT',
            path: `/api/targets/${$target}`,
          })
        ).to($=>$
          .muxHTTP().to($=>$
            .pipe(() => mesh.connect($targetEP))
          )
        )
      ),
      'deny': $=>$.replaceStreamStart(new StreamEnd)
    })
  )

  var httpProxy = pipeline($=>$
    .demuxHTTP().to($=>$
      .pipe(
        function (req) {
          if (req instanceof MessageStart) {
            var head = req.head
            if (head.method === 'CONNECT') {
              $target = req.head.path
              $host = $target.substring(0, $target.lastIndexOf(':'))
              return 'tunnel'
            } else {
              var url = new URL(head.path)
              $host = url.hostname
              $target = `${url.hostname}:${url.port}`
              return 'forward'
            }
          }
        }, {
          'tunnel': ($=>$
            .acceptHTTPTunnel(() => new Message({ status: 200 })).to(connectPeer)
          ),
          'forward': ($=>$
            .muxHTTP(() => $target).to(connectPeer)
          )
        }
      )
    )
  )

  var socksProxy = pipeline($=>$
    .acceptSOCKS(
      function (req) {
        $host = req.domain || req.ip
        $target = `${$host}:${req.port}`
        return true
      }
    ).to(connectPeer)
  )

  function isExit(config, host) {
    if (IP.isV4(host) || IP.isV6(host)) {
      return (
        hasIP(config?.exclusions, host) === false &&
        hasIP(config?.targets, host)
      )
    } else {
      return (
        hasDomain(config?.exclusions, host) === false &&
        hasDomain(config?.targets, host)
      )
    }
  }

  function isAllowed(rules, host, username) {
    var rule = rules.find(
      rule => {
        if (rule.users.length > 0 && !rule.users.includes(username)) return false
        if (rule.targets.length > 0) {
          if (IP.isV4(host) || IP.isV6(host)) {
            if (!hasIP(rule.targets, host)) return false
          } else {
            if (!hasDomain(rule.targets, host)) return false
          }
        }
        return true
      }
    )
    return rule ? rule.action === 'allow' : true
  }

  function hasDomain(list, host) {
    return list instanceof Array && list.some(
      domain => {
        if (domain.startsWith('*')) {
          return host.endsWith(domain.substring(1))
        } else {
          return host === domain
        }
      }
    )
  }

  function hasIP(list, host) {
    return list instanceof Array && list.some(
      mask => {
        try {
          var m = new IPMask(mask)
          return m.contains(host)
        } catch {
          return false
        }
      }
    )
  }

  getLocalConfig().then(config => {
    publishConfig(config)
    applyConfig(config)
    applyRules(config)

    function updateRules() {
      new Timeout(10).wait().then(
        () => applyRules(currentConfig)
      ).then(
        () => updateRules()
      )
    }

    updateRules()
  })

  return {
    getEndpointCA,
    getEndpointConfig,
    setEndpointConfig,
    acceptPeer,
  }
}
