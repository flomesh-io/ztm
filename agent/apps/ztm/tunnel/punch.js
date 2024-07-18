export default function ({ app, mesh }) {
  // Only available for symmetric NAT
  function Hole(ep) {
    // FIXME: throw on init fail?
    // TODO: Add detailed comment.

    var bound = '0.0.0.0:' + randomPort()
    var destIP = null
    var destPort = null
    var role = null

    // closed forwarding connecting(ready punching) connected fail
    var state = 'closed'  // inner state
    var ready = false     // exposed state
    var $connection = null
    var $pHub = new pipeline.Hub
    var $session
    var $response

    console.info(`Creating hole to peer ${ep}, bound ${bound}`)

    // Check if ep is self.
    if (ep === app.endpoint.id) {
      throw 'Must not create a hole to self'
    }

    function directSession() {
      // TODO !!! state error would happen when network is slow
      // must handle this

      if (!role || !destIP || !destPort) throw 'Hole not init correctly'
      if ($session) return $session

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
        $session = pipeline($ => $
          .repeat(() => new Timeout(5).wait().then(() => {
            console.info("Retrying...... ", state != 'fail' && retryTimes <= 5)
            return state != 'fail' && retryTimes <= 5
          })).to($=>$
            .muxHTTP(() => ep + "direct", /* { version: 2 } */).to($ => $
              .connect(() => `${destIP}:${destPort}`, {
                onState: function (conn) {
                  console.info('Conn Info: ', conn)
                  if (conn.state === 'open') {
                    conn.socket.setRawOption(1, 15, new Data([1, 0, 0, 0]))
                  } else if (conn.state === 'connected') {
                    app.log(`Connected to remote ${destIP}:${destPort}`)
                    $connection = conn
                    state = 'connected'
                  } else if (conn.state === 'closed') {
                    app.log(`Disconnected from remote ${destIP}:${destPort}`)
                    $connection = null
                    retryTimes += 1
                  }
                },
                bind: bound
              })
            )
            .onEnd(evt => {
              console.info('Direct session end: ', evt)
            })
          )
          .onEnd(() => {
            app.log(`Direct session to ${ep} failed, hole closing...`)
            state = 'fail'
            leave()
          })
        )

        // reverse server for receiving requests
        pipeline($ => $
          .onStart(new Data)
          .repeat(() => new Timeout(5).wait().then(() => {
            return state != 'fail' && state != 'closed'
          })).to($ => $
            .loop($ => $
              .connectHTTPTunnel(
                new Message({
                  method: 'CONNECT',
                  path: `/api/punch/tunnel`,
                })
              )
              .to($session)
              .pipe(() => svc(buildCtx()))
            )
          )
        ).spawn()

      } else if (role === 'server') {
        console.info("Direct Server Listening...")
        pipy.listen(bound, 'tcp', () => svc(buildCtx()))

        $session = pipeline($ => $
          .muxHTTP(() => ep + "direct", /* { version: 2 } */).to($ => $
            .swap(() => $pHub)
          )
        )
      }

      return $session
    }

    function fwdRequest(req, callback) {
      return pipeline($ => $
        .onStart(req)
        .muxHTTP().to($ => $
          .pipe(mesh.connect(ep, {
            bind: bound,
            onState: conn => {
              if (conn.state === 'open')
                conn.socket.setRawOption(1, 15, new Data([1, 0, 0, 0]))
            }
          }))
        )
        .print()
        .replaceMessage(res => {
          $response = res
          return new StreamEnd
        })
        .onEnd(() => {
          console.info('Hub Answers in hole: ', $response)
          if(callback)
            callback($response)
          return $response
        })
      ).spawn()
    }

    // use THE port sending request to hub.
    function requestPunch() {
      // FIXME: add state check
      // state = 'connecting'
      role = 'client'

      console.info("Requesting punch")
      fwdRequest(new Message({
        method: 'GET',
        path: '/api/punch/request',
      }))
      new Timeout(60).wait().then(connectOrFail)
    }

    function acceptPunch() {
      // TODO add cert info into response
      // state = 'connecting'
      role = 'server'

      console.info("Accepting punch")
      fwdRequest(new Message({
        method: 'GET',
        path: '/api/punch/accept',
      }), (resp) => {
        if(resp.head.status != 200) {
          app.log(`Failed on accepting`)
          state = 'fail'
          leave()
          updateHoles()
          return
        }
        punch()
      })
      new Timeout(60).wait().then(connectOrFail)
    }

    function updateNatInfo(ip, port) {
      console.info(`Peer NAT Info: ${ip}:${port}`)
      destIP = ip
      destPort = port
    }

    // Punch when:
    // 1. Server accept got 200 OK
    // 2. Client receive accept
    function punch() {
      // TODO receive TLS options
      // TODO add retry logic here
      // TODO estimate RTT and use it to make peer synchronized.
      state = 'punching'

      console.info(`Punching to ${destIP}:${destPort} (${ep})`)
      if (role === 'server') {
        makeFakeCall(destIP, destPort)
      }

      directSession()
      heartbeat() // activate the session pipeline
    }

    function makeRespTunnel() {
      // TODO add state check
      state = 'connected'

      return pipeline($ => $
        .acceptHTTPTunnel(() => response200()).to($ => $
          .onStart(new Data)
          .swap(() => $pHub)
          .onEnd(() => console.info(`Direct Connection from ${ep} lost`))
        )
      )
    }

    function connectOrFail() {
      console.info(`Failed unpunchable hole: ${ep}`)
      if (state != 'connected') {
        state = fail
        console.info("Made the hole failed")
        updateHoles()
      }
    }

    // send a SYN to dest, expect no return.
    // this will cheat the firewall to allow inbound connection from dest.
    function makeFakeCall(destIP, destPort) {
      console.info("Making fake call")
      pipeline($=>$
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
      fwdRequest(new Message({
        method: 'GET',
        path: '/api/ping'
      }))
    }

    function leave() {
      if($connection) {
        $connection?.close()
      }
      $connection = null
      if (state != 'fail') state = 'closed'
    }

    return {
      role,
      ready,
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
      if (hole.state === 'fail' || hole.state === 'closed') {
        hole.leave()
        holes.delete(key)
      }
    })
    console.info(`Holes after updating: `, holes)
  }

  function createInboundHole(ep, bound, request) {
    updateHoles()
    if (findHole(ep)) return
    console.info(`Creating Inbound Hole to ${ep}`)
    try {
      var hole = Hole(ep, bound, request)
      hole.requestPunch()
      holes.set(ep, hole)
    } catch (err) {
      hole = null
      app.log(`Failed to create Inbound Hole, peer ${ep}, err ${err}`)
    }

    updateHoles()
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
      hole = null
      app.log(`Failed to create Outbound Hole, peer ${ep}, err ${err}`)
    }

    updateHoles()
    return hole
  }

  function updateHoleInfo(ep, natIp, natPort) {
    var hole = findHole(ep)
    if (!hole) throw 'No hole to update'

    hole.updateNatInfo(natIp, natPort)
  }

  function deleteHole(ep) {
    var sel = findHole(ep)
    if (!sel) return
    sel.leave()
    holes.delete(ep)
  }

  function findHole(ep) {
    updateHoles()
    return holes.get(ep)
  }

  function getCtx() {

  }

  function setService(srvPeer) {
    svc = srvPeer
  }

  function randomPort() {
    return Number.parseInt(Math.random() * (65535 - 1024)) + 1024
  }

  return {
    holes,
    createInboundHole,
    createOutboundHole,
    updateHoleInfo,
    deleteHole,
    findHole,
    setService,
    randomPort,
  }
}
