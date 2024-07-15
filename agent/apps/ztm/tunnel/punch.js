export default function({ app }) {
  // Only available for symmetric NAT
  function Hole(ep, bound, ent, request) {
    // FIXME: throw on init fail?
    // TODO: Add detailed comment.

    var destIP = ent.ip
    var destPort = ent.port
    var role = null

    // closed forwarding connecting(ready punching) connected fail
    var state = 'closed'  // inner state
    var ready = false     // exposed state
    var $connection = null
    var $pHub = new pipeline.Hub
    var $session
    var $response

    // Check if ep is self.
    if(ep === app.endpoint.id) {
      throw 'Must not create a hole to self'
    }

    function directSession() {
      // TODO !!! state error would happen when network is slow
      // must handle this

      if (!role) throw 'Hole not init correctly'
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


    // use THE port sending request to hub.
    function requestPunch() {
      // FIXME: add state check
      // state = 'connecting'
      role = 'client'

      request.spawn(new Message({
        method: 'GET',
        path: `/api/punch/server`,
      }))
    }

    // TODO add cert info into response
    function acceptPunch() {
      // state = 'connecting'
      role = 'server'

      request.spawn(new Message({
        method: 'GET',
        path: `/api/punch/client`,
      }))
    }

    function punch(destIP, destPort) {
      // receive TLS options
      // connectTLS
      // connectLocal or connectRemote

      // TODO add retry logic here
      state = 'punching'
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

    // send a SYN to dest, expect no return.
    // this will cheat the firewall to allow inbound connection from dest.
    function makeFakeCall(destIP, destPort) {
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
      request.spawn(
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
  }

  function createInboundHole(ep, ent, bound, request) {
    updateHoles()
    try {
      var hole = Hole(ep, ent, bound, request)
      hole.requestPunch()
      holes.set(ep, hole)
    } catch {
      app.log(`Failed to create Inbound Hole, peer ${ep}`)
    }

    return hole
  }

  function createOutboundHole(ep, ent, bound, request) {
    updateHoles()
    try {
      var hole = Hole(ep)
      hole.acceptPunch()
      holes.set(ep, hole)
    } catch {
      app.log(`Failed to create Inbound Hole, peer ${ep}`)
    }

    return hole
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
    deleteHole,
    findHole,
    randomPort,
  }
}
