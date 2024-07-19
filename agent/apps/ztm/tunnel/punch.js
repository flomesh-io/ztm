export default function ({ app, mesh }) {
  // Only available for symmetric NAT
  function Hole(ep) {
    // TODO: Add detailed comment.

    // (idle) (handshake) (punching connected closed) (left fail)
    var state = 'idle'
    var bound = '0.0.0.0:' + randomPort()
    var destIP = null
    var destPort = null
    var role = null
    var session = null
    var rtt = null

    var pHub = new pipeline.Hub
    var $connection = null
    var $response

    console.info(`Creating hole to peer ${ep}, bound ${bound}`)

    // Check if ep is self.
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

      // TODO: support TLS connection
      if (role === 'client') {
        var reverseTunnel = null
        var reverseTunnelStarted = false

        // make session to server side directly
        session = pipeline($ => $
          .muxHTTP(() => ep + "direct", { version: 2 }).to($ => $
            .connect(() => `${destIP}:${destPort}`, {
              bind: bound,
              onState: function (conn) {
                if (conn.state === 'open') {
                  conn.socket.setRawOption(1, 15, new Data([1, 0, 0, 0]))
                } else if (conn.state === 'connected') {
                  app.log(`Connected to peer ${destIP}:${destPort}`)
                  $connection = conn
                  state = 'connected'
                  retryTimes = 0

                  if(!reverseTunnelStarted) {
                    reverseTunnel.spawn()
                    reverseTunnelStarted = true
                  }
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
            }).handleStreamEnd(evt => console.info('Hole connection end, retry: ', retryTimes, ' reason: ', evt?.error))
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

        pacemaker()
      } else if (role === 'server') {
        console.info("Direct Server Listening...")
        var $msg = null
        pipy.listen(bound, 'tcp', $ => $.handleMessage(msg => {
          console.info('Server Received: ', msg)
          $msg = msg
          return new Data
        }).pipe(() => svc(buildCtx())), () => $msg)

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
      // FIXME: add state check
      role = 'client'
      state = 'handshake'

      console.info("Requesting punch")
      request(new Message({
        method: 'GET',
        path: '/api/punch/request',
      }))
      new Timeout(60).wait().then(connectOrFail)
    }

    function acceptPunch() {
      // TODO add cert info into response
      role = 'server'
      state = 'handshake'

      console.info("Accepting punch")
      request(new Message({
        method: 'GET',
        path: '/api/punch/accept',
      }), (resp) => {
        if (resp.head.status != 200) {
          app.log(`Failed on accepting`)
          state = 'fail'
          updateHoles()
        }
      })
      // Just do it, regardless if accept fail.
      // Because it's faster.
      punch()
      new Timeout(60).wait().then(connectOrFail)
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
      // TODO receive TLS options
      // TODO estimate RTT and use it to make peer synchronized.
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
          console.info("Heartbeat OK: ", res.head.status == 200)
          if(pacemaker) return res
          return new StreamEnd
        })
      )

      if (pacemaker)
        return heart

      // if not called from pacemaker
      // the heart should beat automatically :)
      console.info('Heartbeating...')
      heart.spawn()
      new Timeout(10).wait().then(() => heartbeat(false))
    }

    // Used on direct connection setup.
    // To urge the connect filter try to call the peer
    function pacemaker(rtt) {
      if(!rtt) rtt = 0.02

      var $resp = null
      var timeout = [rtt, rtt, rtt, rtt, rtt, 2 * rtt, 3 * rtt, 5 * rtt, 8 *rtt, 13 * rtt]
      var round = 0
      var cont = true

      console.info('Pacemaking......')
      pipeline($=>$
        .onStart(new Data)
        .repeat(() => new Timeout(timeout[round]).wait().then(() => cont && round < 10))
        .to($=>$
          .pipe(() => heartbeat(true))
          .replaceMessage(resp => {
            $resp = resp
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
      punch,
      makeRespTunnel,
      directSession,
      leave,
    }
  } // End of Hole

  var holes = new Map
  var svc = null

  function updateHoles() {
    holes.forEach((key, hole) => {
      if (hole.state() === 'fail' || hole.state() === 'left') {
        hole.leave()
        holes.delete(key)
      }
    })
    console.info(`Holes after updating: `, holes)
  }

  function createInboundHole(ep) {
    updateHoles()
    if (findHole(ep)) return
    console.info(`Creating Inbound Hole to ${ep}`)
    try {
      var hole = Hole(ep)
      hole.requestPunch()
      holes.set(ep, hole)
    } catch (err) {
      updateHoles()
      app.log(`Failed to create Inbound Hole, peer ${ep}, err ${err}`)
    }

    return hole
  }

  function createOutboundHole(ep, natIp, natPort) {
    updateHoles()
    if (findHole(ep)) return

    console.info(`Creating Outbound Hole to ${ep}`)
    try {
      var hole = Hole(ep)
      hole.updateNatInfo(natIp, natPort)
      hole.acceptPunch()
      holes.set(ep, hole)
    } catch (err) {
      updateHoles()
      app.log(`Failed to create Outbound Hole, peer ${ep}, err ${err}`)
    }

    return hole
  }

  function updateHoleInfo(ep, natIp, natPort) {
    var hole = findHole(ep)
    if (!hole) throw `No hole to update, ep ${ep}`

    hole.updateNatInfo(natIp, natPort)
  }

  function deleteHole(ep, remote) {
    var sel = findHole(ep)
    if (!sel) return
    sel.leave(remote)
    updateHoles()
  }

  function findHole(ep) {
    updateHoles()
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
