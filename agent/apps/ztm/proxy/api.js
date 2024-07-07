export default function ({ app, mesh }) {
  var currentListen = ''

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
      ))
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
  }

  var matchPathTargets = new http.Match('/api/targets/*')

  var acceptPeer = pipeline($=>$
    .acceptHTTPTunnel(req => {
      var params = matchPathTargets(req.head.path)
      if (params) {
        $target = params['*']
        app.log(`Forward to ${$target}`)
        return new Message({ status: 200 })
      } else {
        return new Message({ status: 404 })
      }
    }).to($=>$
      .connect(() => $target)
    )
  )

  var $host
  var $target
  var $targetEP

  var connectPeer = pipeline($=>$
    .onStart(
      () => mesh.discover().then(
        peers => Promise.all(peers.map(
          ep => mesh.request(
            ep.id,
            new Message({ path: '/api/config' })
          ).then(res => ({
            ep,
            config: res.head.status === 200 ? JSON.decode(res.body) : {}
          }))
        ))
      ).then(peers => {
        if (IP.isV4($host) || IP.isV6($host)) {
          peers = peers.filter(p => hasIP(p.config))
        } else {
          peers = peers.filter(p => hasDomain(p.config))
        }
        if (peers.length > 0) {
          var peer = peers[Math.floor(Math.random() * peers.length)]
          $targetEP = peer.ep.id
          app.log(`Forward to ${$target} via ${peer.ep.name} (${peer.ep.id})`)
        } else {
          app.log(`No exit found for ${$target}`)
        }
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

  function hasDomain(config) {
    return config.targets instanceof Array && config.targets.some(
      domain => {
        if (domain.startsWith('*')) {
          return $host.endsWith(domain.substring(1))
        } else {
          return $host === domain
        }
      }
    )
  }

  function hasIP(config) {
    return config.targets instanceof Array && config.targets.some(
      mask => {
        try {
          var m = new IPMask(mask)
          return m.contains($host)
        } catch {
          return false
        }
      }
    )
  }

  getLocalConfig().then(applyConfig)

  return {
    allEndpoints,
    getEndpointConfig,
    setEndpointConfig,
    acceptPeer,
  }
}
