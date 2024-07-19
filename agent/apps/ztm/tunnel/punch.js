export default function ({ app, mesh }) {
  // Only available for symmetric NAT
  function Hole(ep) {
    // FIXME: throw on init fail?
    // TODO: Add detailed comment.

    var bound = '0.0.0.0:' + randomPort()
    var destIP = null
    var destPort = null
    var role = null

    // idle handshake punching connected closed fail
    var state = 'idle'
    var session
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
          source: 'peer',
          peer: {
            id: ep,
            ip: destIP,
            port: destPort,
          }
        }
      }

      // TODO: support TLS connection
      if (role === 'client') {
        // make session to server side directly
        var reverseServer = null
        session = pipeline($ => $
          .muxHTTP(() => ep + "direct", { version: 2 }).to($ => $
            .connect(() => `${destIP}:${destPort}`, {
              bind: bound,
              onState: function (conn) {
                console.info('Conn Info: ', conn)
                if (conn.state === 'open') {
                  conn.socket.setRawOption(1, 15, new Data([1, 0, 0, 0]))
                } else if (conn.state === 'connected') {
                  app.log(`Connected to peer ${destIP}:${destPort}`)
                  $connection = conn
                  state = 'connected'
                  retryTimes = 0
                  // reverseServer.spawn()
                } else if (conn.state === 'closed') {
                  app.log(`Disconnected from peer ${destIP}:${destPort}`)
                  $connection = null
                  state = 'closed'
                  retryTimes += 1
                }

                if (retryTimes > 5 || state === 'fail') {
                  console.info(`Retry limit exceeded, punch failed.`)
                  state = 'fail'
                  updateHoles()
                }
              },
            }).handleStreamEnd(evt => console.info('Connection End, event: ', evt))
          )
        )

        // reverse server for receiving requests
        // reverseServer = pipeline($ => $
        //   .onStart(new Data)
        //   .loop($ => $
        //     .connectHTTPTunnel(
        //       new Message({
        //         method: 'CONNECT',
        //         path: `/api/punch/tunnel`,
        //       })
        //     )
        //     .to($session)
        //     .pipe(() => svc(buildCtx()))
        //   )
        // )

        heartbeat()
      } else if (role === 'server') {
        console.info("Direct Server Listening...")
        var $msg = null
        pipy.listen(bound, 'tcp', $ => $.handleMessage(msg => {
          console.info('Server Received: ', msg)
          $msg = msg
          return new Data
        }).pipe(() => svc(buildCtx())), () => $msg)

        session = pipeline($ => $
          .muxHTTP(() => ep + "direct", /* { version: 2 } */).to($ => $
            .swap(() => pHub)
          )
        )
      }
      state = 'connected'
      return session
    }

    function request(req, callback) {
      var store = req
      return pipeline($ => $
        .onStart(req)
        .pipe(() => {
          if (state === 'connected' || state === 'closed' || state === 'punching') {
            return session
          }
          return pipeline($ => $
            .muxHTTP().to($ => $.pipe(
              mesh.connect(ep, {
                bind: bound,
                onState: conn => {
                  if (conn.state === 'open')
                    conn.socket.setRawOption(1, 15, new Data([1, 0, 0, 0]))
                }
              })
            ))
          )
        })
        .print()
        .replaceMessage(res => {
          $response = res
          return new StreamEnd
        })
        .onEnd(() => {
          console.info('Answers in hole: ', $response, state === 'connected', store)
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
      // TODO add state check
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
      if (state != 'connected') {
        console.info(`Current state ${state}, made the hole failed`)
        state = 'fail'
        updateHoles()
      }
    }

    // send a SYN to dest, expect no return.
    // this will cheat the firewall to allow inbound connection from dest.
    function makeFakeCall(destIP, destPort) {
      console.info("Making fake call")
      pipeline($ => $
        .onStart(new Data).connect(`${destIP}:${destPort}`, {
          bind: bound,
          onState: function (conn) {
            // REUSEPORT
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


    function heartbeat() {
      // FIXME use direct session
      if (state === 'fail') return

      var resp = null
      console.info("Sending heartbeat...")
      pipeline($ => $
        .onStart(new Message({
          method: 'GET',
          path: '/api/ping'
        }))
        .pipe(session)
        .replaceMessage(res => {
          resp = res
          return new StreamEnd
        })
        .onEnd(() => {
          console.info('Heartbeat: ', resp)
        })
      ).spawn()
      // request(new Message({
      //   method: 'GET',
      //   path: '/api/ping'
      // }), (resp) => {
      //   console.info('Heartbeat: ', resp)
      // })
      new Timeout(10).wait().then(heartbeat)
    }

    function leave(remote) {
      if (role === 'server') {
        pipy.listen(bound, 'tcp', null)
      }

      if ($connection) {
        $connection?.close()
      }
      $connection = null
      if (state != 'fail') state = 'closed'
      if (!remote) {
        app.log("Hole closed by peer ", ep)
        request(new Message({
          method: 'GET',
          path: '/api/punch/leave'
        }))
      }
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
      heartbeat,
      leave,
    }
  } // End of Hole

  var holes = new Map
  var svc = null

  function updateHoles() {
    holes.forEach((key, hole) => {
      if (hole.state() === 'fail' || hole.state() === 'closed') {
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
      hole.leave()
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
      hole.leave()
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
