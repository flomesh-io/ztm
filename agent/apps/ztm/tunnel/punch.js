export default function({ app, mesh }) {
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
    if(ep === app.endpoint.id) {
      throw 'Must not create a hole to self'
    }

    function directSession() {
      // TODO !!! state error would happen when network is slow
      // must handle this

      if (!role || !destIP || !destPort) throw 'Hole not init correctly'
      if ($session) return $session

      // TODO: support TLS connection
      if (role === 'client') {
        // make session to server side directly
        $session = pipeline($ => $
          .muxHTTP(() => ep + "direct", { version: 2 }).to($ => $
            .connect(() => `${destIP}:${destPort}`, {
              onState: function (conn) {
                if (conn.state === 'open') {
                  conn.socket.setRawOption(1, 15, new Data([1, 0, 0, 0]))
                } else if (conn.state === 'connected') {
                  app.log(`Connected to remote ${destIP}:${destPort}`)
                  $connection = conn
                  state = 'connected'
                } else if (conn.state === 'closed') {
                  app.log(`Disconnected from remote ${destIP}:${destPort}`)
                  $connection = null
                  state = 'closed'
                }
              },
              bind: bound
            })
            .handleStreamEnd(evt => {
              if (evt.error) {
                state = 'fail'
                leave()
              }
            })
          )
        )

        // reverse server for receiving requests
        pipeline($ => $
          .onStart(new Data)
          .repeat(() => new Timeout(5).wait().then(() => {
            return state != 'fail' || state != 'closed'
          })).to($ => $
            .loop($ => $
              .connectHTTPTunnel(
                new Message({
                  method: 'CONNECT',
                  path: `/api/punch/${config.agent.id}/${ep}`,
                })
              )
              .to($session)
              .pipe(serveHub)
            )
          )
        ).spawn()

      } else if (role === 'server') {
        pipy.listen(bound, 'tcp', serveHub)

        $session = pipeline($ => $
          .muxHTTP(() => ep + "direct", { version: 2 }).to($ => $
            .swap(() => $pHub)
          )
        )
      }

      return $session
    }

    function fwdRequest(req) {
      return pipeline($=>$
        .onStart(req)
        .muxHTTP().to($=>$
          .pipe(mesh.connect(ep, {
            bind: bound,
            onState: conn => {
              if(conn.state === 'open')
                conn.socket.setRawOption(1,15,new Data([1,0,0,0]))
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
      new Timeout(15).wait().then(connectOrFail)
    }

    // TODO add cert info into response
    function acceptPunch() {
      // state = 'connecting'
      role = 'server'

      console.info("Accepting punch")
      fwdRequest(new Message({
        method: 'GET',
        path: '/api/punch/accept',
      }))
      new Timeout(15).wait().then(connectOrFail)
    }

    function updateNatInfo(ip, port) {
      destIP = ip
      destPort = port
    }

    function punch() {
      // receive TLS options
      // connectTLS
      // connectLocal or connectRemote

      // TODO add retry logic here
      state = 'punching'

      console.info("Punching...")
      makeFakeCall(destIP, destPort)
      $session = directSession()
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
      if(state != 'connected') state = fail
      updateHoles()
    }

    // send a SYN to dest, expect no return.
    // this will cheat the firewall to allow inbound connection from dest.
    function makeFakeCall(destIP, destPort) {
      console.info("Making fake call")
      pipy().task().onStart(new Data).connect(`${destIP}:${destPort}`, {
        bind: bound,
        onState: function (conn) {
          // REUSEPORT
          if (conn.state === 'open') conn.socket.setRawOption(1, 15, new Data([1]))

          // abort this connection.
          if (conn.state === 'connecting') conn.close()
        }
      })
    }


    function heartbeat() {
      fwdRequest.spawn(
        new Message(
          { method: 'POST', path: '/api/status' },
          JSON.encode({ name: config.agent.name })
        )
      )
    }

    function leave() {
      $connection?.close()
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
    if(findHole(ep)) return
    console.info(`Creating Inbound Hole to ${ep}`)
    try {
      var hole = Hole(ep, bound, request)
      hole.requestPunch()
      holes.set(ep, hole)
    } catch(err) {
      hole = null
      app.log(`Failed to create Inbound Hole, peer ${ep}, err ${err}`)
    }

    updateHoles()
    return hole
  }

  function createOutboundHole(ep, natIp, natPort) {
    updateHoles()
    if(findHole(ep)) return

    console.info(`Creating Outbound Hole to ${ep}`)
    try {
      var hole = Hole(ep)
      hole.updateNatInfo(natIp, natPort)
      hole.acceptPunch()
      holes.set(ep, hole)
    } catch(err) {
      hole = null
      app.log(`Failed to create Outbound Hole, peer ${ep}, err ${err}`)
    }

    updateHoles()
    return hole
  }

  function updateHoleInfo(ep, natIp, natPort) {
    var hole = findHole(ep)
    if(!hole) throw 'No hole to update'

    hole.updateNatInfo(natIp, natPort)
  }

  function deleteHole(ep) {
    var sel = findHole(ep)
    if(!sel) return
    sel.leave()
    holes.delete(ep)
  }

  function findHole(ep) {
    updateHoles()
    return holes.get(ep)
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
    randomPort,
  }
}
