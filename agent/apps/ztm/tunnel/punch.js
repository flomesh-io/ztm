export default function ({ app, mesh }) {
  // Only available for symmetric NAT
  function Hole(ep) {
    // (idle) (handshake) (punching connected closed) (left fail)
    var state = 'idle'
    var bound = '0.0.0.0:' + randomPort()
    var destIP = null
    var destPort = null
    var role = null
    var session = null
    var rtt = null

    var tlsOptions = {
      certificate: null,
      trusted: null
    }

    var pHub = new pipeline.Hub
    var $connection = null
    var $response


    // Check if ep is self.
    console.info(`Creating hole to peer ${ep}, bound ${bound}`)
    if (ep === app.endpoint.id) {
      throw 'Must not create a hole to self'
    }

    function directSession() {
      if (!role || !destIP || !destPort) throw 'Hole not init correctly'
      if (session) return session

      var retryTimes = 0

      var buildCtx = () => {
        return {
          source: 'direct',
          self: {
            id: app.endpoint.id,
          },
          peer: {
            id: ep,
            ip: destIP,
            port: destPort,
          }
        }
      }

      if (role === 'client') {
        var reverseTunnel = null
        var reverseTunnelStarted = false

        // make session to server side directly
        session = pipeline($ => $
          .muxHTTP(() => ep + "direct", { version: 2 }).to($ => $
            .connectTLS({
              ...tlsOptions,
              onState: tls => {
                console.info('TLS State: ', tls)
                if($connection.state === 'connected' && tls.state === 'connected') {
                  app.log(`Connected TLS to peer ${destIP}:${destPort}`)
                  state = 'connected'
                  retryTimes = 0

                  if (!reverseTunnelStarted) {
                    reverseTunnel.spawn()
                    reverseTunnelStarted = true
                  }
                }
              }
            }).to($ => $
              .connect(() => `${destIP}:${destPort}`, {
                bind: bound,
                onState: function (conn) {
                  console.info("Conn Info: ", conn)

                  if (conn.state === 'open') {
                    conn.socket.setRawOption(1, 15, new Data([1, 0, 0, 0]))
                  } else if (conn.state === 'connected') {
                    app.log(`Connected to peer ${destIP}:${destPort}`)
                    $connection = conn
                  } else if (conn.state === 'closed') {
                    app.log(`Disconnected from peer ${destIP}:${destPort}`)
                    $connection = null
                    state = 'closed'
                    retryTimes += 1
                  }

                  // Max Retry set to 10
                  if (retryTimes > 10 || state === 'fail') {
                    console.info(`Retry limit exceeded, punch failed.`)
                    state = 'fail'
                    updateHoles()
                  }
                },
              })
              .handleStreamEnd(evt => console.info('Hole connection end, retry: ', retryTimes + 1, ' reason: ', evt?.error))
            )
          )
        )

        // reverse server for receiving requests
        reverseTunnel = pipeline($ => $
          .onStart(new Data)
          .repeat(() => new Timeout(1).wait().then(() => {
            return state != 'fail' && state != 'left'
          })).to($ => $
            .loop($ => $
              .connectHTTPTunnel(
                new Message({
                  method: 'CONNECT',
                  path: `/api/punch/tunnel`,
                })
              )
              .to(session)
              .pipe(() => svc(buildCtx()))
            )
          )
        )

        // Forced Heartbeats
        // Do a PCR to the hole.
        pacemaker()

      } else if (role === 'server') {
        var $msg = null
        var listen = pipeline($ => $
          .acceptTLS({
            ...tlsOptions,
            onState: tls => console.info('TLS State: ', tls)
          }).to($ => $
            .handleMessage(msg => {
              console.info('Server Received: ', msg)
              $msg = msg
              return new Data
            }).pipe(() => svc(buildCtx())), () => $msg
          )
        )

        console.info("Direct Server Listening...")
        pipy.listen(bound, 'tcp', listen)

        session = pipeline($ => $
          .muxHTTP(() => ep + "direct", { version: 2 }).to($ => $
            .swap(() => pHub)
          )
        )
      }
      return session
    }

    function request(req, callback) {
      var store = req
      return pipeline($ => $
        .onStart(req)
        .muxHTTP().to($ => $.pipe(
          mesh.connect(ep, {
            bind: bound,
            onState: conn => {
              if (conn.state === 'open')
                conn.socket.setRawOption(1, 15, new Data([1, 0, 0, 0]))
            }
          })
        ))
        .print()
        .replaceMessage(res => {
          $response = res
          return new StreamEnd
        })
        .onEnd(() => {
          console.info('Answers in hole: ', $response, store)
          if (callback)
            callback($response)
          return $response
        })
      ).spawn()
    }

    // use THE port sending request to hub.
    function requestPunch() {
      role = 'client'
      state = 'handshake'
      var start = Date.now()

      console.info("Requesting punch")
      request(new Message({
        method: 'POST',
        path: '/api/punch/request',
      }, JSON.encode({
        timestamp: Date.now(),
        cert: genCert()
      })), (resp) => {
        var end = Date.now()
        rtt = (end - start) / 2000
        console.info('Estimated RTT: ', rtt)

        if (resp.head.status != 200) {
          app.log(`Failed on requesting`)
          state = 'fail'
          updateHoles()
        }
      })
      new Timeout(60).wait().then(connectOrFail)
    }

    function acceptPunch() {
      role = 'server'
      state = 'handshake'
      var start = Date.now()

      console.info("Accepting punch")
      request(new Message({
        method: 'POST',
        path: '/api/punch/accept',
      }, JSON.encode({
        timestamp: Date.now(),
        cert: genCert()
      })), (resp) => {
        var end = Date.now()
        rtt = (end - start) / 2000
        console.info('Estimated RTT: ', rtt)

        if (!resp || resp.head.status != 200) {
          app.log(`Failed on accepting`)
          state = 'fail'
          updateHoles()
        }
      })

      new Timeout(60).wait().then(connectOrFail)
    }

    // Locally generate certificate.
    // The handshake process and hub
    // will ensure peer is trustworthy
    function genCert() {
      var key = new crypto.PrivateKey({ type: 'rsa', bits: 2048 })
      var pKey = new crypto.PublicKey(key)
      var cert = new crypto.Certificate({
        subject: { CN: 'Fake CA' },
        publicKey: pKey,
        privateKey: key,
        days: 365,
      })

      cert = new crypto.Certificate({
        subject: { CN: role },
        publicKey: pKey,
        privateKey: key,
        issuer: cert,
        days: 365,
      })

      tlsOptions = {
        certificate: {
          cert: cert,
          key: key,
        }
      }

      return cert.toPEM().toString()
    }

    function addPeerCert(cert) {
      var peerCert = new crypto.Certificate(cert)
      console.info("TLS: ", tlsOptions)
      tlsOptions['trusted'] = [peerCert]
    }

    function updateNatInfo(ip, port) {
      console.info(`Peer NAT Info: ${ip}:${port}`)
      destIP = ip
      destPort = port
    }

    // Punch when:
    // 1. Server accept message got 200 OK
    // 2. Client receive accept
    function punch() {
      state = 'punching'

      console.info(`Punching to ${destIP}:${destPort} (${ep})`)
      if (role === 'server') {
        makeFakeCall(destIP, destPort)
      }
      directSession()
    }

    function makeRespTunnel() {
      console.info("Created Resp Tunnel")
      state = 'connected'

      return pipeline($ => $
        .acceptHTTPTunnel(() => new Message({ status: 200 })).to($ => $
          .onStart(new Data)
          .swap(() => pHub)
          .onEnd(() => console.info(`Direct Connection from ${ep} lost`))
        )
      )
    }

    function connectOrFail() {
      if (state === 'left') {
        // Be quiet when left.
        // The hole has been released.
        return
      } else if (state != 'connected') {
        console.info(`Current state ${state}, made the hole failed`)
        state = 'fail'
        updateHoles()
      }
    }

    // send a SYN to dest, expect no return.
    // this will cheat the firewall to allow inbound connection from peer.
    function makeFakeCall(destIP, destPort) {
      console.info("Making fake call")
      pipeline($ => $
        .onStart(new Data).connect(`${destIP}:${destPort}`, {
          bind: bound,
          onState: function (conn) {
            // Socket Option: REUSEPORT
            if (conn.state === 'open') conn.socket.setRawOption(1, 15, new Data([1, 0, 0, 0]))

            // abort this connection.
            if (conn.state === 'connecting') {
              console.info('Performing early close')
              conn.close()
            }
          }
        })
      ).spawn()
    }

    // Send something to server from time to time
    // So the firewall and NAT rule should be held.
    //
    // Params:
    // - pacemaker: whether called from pacemaker function
    //
    function heartbeat(pacemaker) {
      if (state === 'fail' || state === 'left') return
      if (role === 'server') return

      var heart = pipeline($ => $
        .onStart(new Message({
          method: 'GET',
          path: '/api/ping'
        }))
        .pipe(session)
        .replaceMessage(res => {
          if (res.head.status != 200 && !pacemaker)
            app.log("Cardiac Arrest happens, hole: ", ep)
          if (pacemaker) return res
          return new StreamEnd
        })
      )

      if (pacemaker)
        return heart

      // if not called from pacemaker
      // the heart should beat automatically :)
      heart.spawn()
      new Timeout(10).wait().then(() => heartbeat(false))
    }

    // Used on direct connection setup.
    // To urge the connect filter try to call the peer
    function pacemaker() {
      rtt ??= 0.02

      var timeout = [rtt, rtt, rtt, rtt, rtt, 2 * rtt, 3 * rtt, 5 * rtt, 8 * rtt, 13 * rtt]
      var round = 0
      var cont = true

      console.info('Pacemaking......')
      pipeline($ => $
        .onStart(new Data)
        .repeat(() => {
          if(round < 10)
            return new Timeout(timeout[round]).wait().then(() => cont)
          return false
        })
        .to($ => $
          .pipe(() => heartbeat(true))
          .replaceMessage(resp => {
            round += 1
            if (resp.head.status == 200) {
              cont = false
              heartbeat(false)
            }
            console.info('Pacemaker: ', resp)
            return new StreamEnd
          })
        )
      ).spawn()
    }

    function leave(remote) {
      if (role === 'server') {
        pipy.listen(bound, 'tcp', null)
      }

      if ($connection) {
        $connection?.close()
      }
      $connection = null
      if (state != 'fail') state = 'left'
      if (!remote) {
        request(new Message({
          method: 'GET',
          path: '/api/punch/leave'
        }))
      } else app.log("Hole closed by peer ", ep)
    }

    return {
      role: () => role,
      state: () => state,
      ready: () => state === 'connected',
      requestPunch,
      acceptPunch,
      updateNatInfo,
      addPeerCert,
      punch,
      makeRespTunnel,
      directSession,
      leave,
    }
  } // End of Hole

  var holes = new Map
  var fails = {}
  var svc = null

  function updateHoles() {
    holes.forEach((key, hole) => {
      fails[key] ??= 0
      if (hole.state() === 'fail' || hole.state() === 'left') {
        hole.leave()
        holes.delete(key)
        fails[key] += 1
      }
    })
    console.info(`Holes after updating: `, holes)
  }

  function createInboundHole(ep) {
    updateHoles()
    if (findHole(ep)) return
    if (fails[ep] && fails[ep] >= 3) {
      console.info(`Won't create hole to ${ep}, too many fails!`)
      return
    }
    console.info(`Creating Inbound Hole to ${ep}`)
    try {
      var hole = Hole(ep)
      hole.requestPunch()
      holes.set(ep, hole)
    } catch (err) {
      updateHoles()
      app.log('Failed to create Inbound Hole, Error: ', err)
    }

    return hole
  }

  function createOutboundHole(ep, natIp, natPort) {
    updateHoles()
    if (findHole(ep)) return
    console.info(`Creating Outbound Hole to ${ep}`)
    try {
      var hole = Hole(ep)
      hole.acceptPunch()
      holes.set(ep, hole)
    } catch (err) {
      updateHoles()
      app.log('Failed to create Outbound Hole, Error: ', err)
    }

    return hole
  }

  function updateHoleInfo(ep, natIp, natPort, cert) {
    var hole = findHole(ep)
    if (!hole) throw `No hole to update, ep ${ep}`

    hole.updateNatInfo(natIp, natPort)
    hole.addPeerCert(cert)
  }

  function deleteHole(ep, remote) {
    var sel = findHole(ep)
    if (!sel) return
    sel.leave(remote)
    updateHoles()
  }

  function findHole(ep) {
    return holes.get(ep)
  }

  function setService(srvPeer) {
    svc = srvPeer
  }

  function randomPort() {
    return Number.parseInt(Math.random() * (65535 - 1024)) + 1024
  }

  return {
    getHoles: () => holes,
    createInboundHole,
    createOutboundHole,
    updateHoleInfo,
    deleteHole,
    findHole,
    setService,
    randomPort,
  }
}
