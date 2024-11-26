import initCertGen from './cert-gen.js'

export default function ({ app, mesh }) {
  var certGen = null

  var currentConfig = null
  var currentListen = ''
  var currentLogger = null

  function allEndpoints() {
    return mesh.discover()
  }

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
      applyConfig(config)
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
        if (IP.isV4($target) || IP.isV6($target)) {
          if (!hasIP(currentConfig, $target)) return new Message({ status: 403 })
        } else {
          if (!hasDomain(currentConfig, $target)) return new Message({ status: 403 })
        }
        app.log(`Forward to ${$target}`)
        return new Message({ status: 200 })
      } else {
        return new Message({ status: 404 })
      }
    }).to($=>$
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
            time: $requestTime.toUTCString(),
            username: $ctx.peer.username,
            endpoint: $ctx.peer.id,
            ip: $ctx.peer.ip,
            target: $target,
            method: $requestHead.method,
            path: $requestHead.path,
            headers: $requestHead.headers,
            size: msg.tail.headSize + msg.tail.bodySize,
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
      () => mesh.discover().then(
        peers => Promise.any(peers.map(
          ep => {
            if (!ep.online) return Promise.reject(null)
            return mesh.request(
              ep.id,
              new Message({ path: '/api/config' })
            ).then(res => {
              var config = res?.head?.status === 200 ? JSON.decode(res.body) : {}
              if (IP.isV4($host) || IP.isV6($host)) {
                if (hasIP(config, $host)) return ep
              } else {
                if (hasDomain(config, $host)) return ep
              }
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

  function hasDomain(config, host) {
    if (config?.exclusions instanceof Array && config.exclusions.some(
      domain => {
        if (domain.startsWith('*')) {
          return host.endsWith(domain.substring(1))
        } else {
          return host === domain
        }
      }
    )) {
      return false
    } else {
      return config?.targets instanceof Array && config.targets.some(
        domain => {
          if (domain.startsWith('*')) {
            return host.endsWith(domain.substring(1))
          } else {
            return host === domain
          }
        }
      )
    }
  }

  function hasIP(config, host) {
    if (config?.exclusions instanceof Array && config.exclusions.some(
      mask => {
        try {
          var m = new IPMask(mask)
          return m.contains(host)
        } catch {
          return false
        }
      }
    )) {
      return false
    } else {
      return config?.targets instanceof Array && config.targets.some(
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
  }

  getLocalConfig().then(applyConfig)

  return {
    allEndpoints,
    getEndpointCA,
    getEndpointConfig,
    setEndpointConfig,
    acceptPeer,
  }
}
