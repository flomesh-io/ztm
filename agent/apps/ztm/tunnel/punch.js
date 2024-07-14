export default function({ app }) {
  var holes = {}


  // Only available for symmetric NAT
  function Hole(ep) {
    // FIXME: throw on init fail?
    // TODO: Add detailed comment.

    // create hole when find ep.
    // hub save ep pair that fail or success
    var bound = '0.0.0.0:' + randomPort()   // local port that the hole using
    var destIP                              // dest ip out of NAT
    var destPort                            // dest port out of NAT
    var role = null                         // server or client
    // var managedSvc = {}

    // closed forwarding connecting(ready punching) connected fail
    var state = 'closed'  // inner state
    var ready = false     // exposed state
    var $hubConnection = null
    var $connection = null
    var $hub = null
    var $pHub = new pipeline.Hub
    var $session
    var $response

    console.info("Bound: ", bound)

    // Check if ep is self.
    if(ep === app.endpoint.id) {
      throw 'Must not create a hole to self'
    }

    // A temp tunnel to help hub gather NAT info.
    var hubSession = pipeline($ => $
      .onStart(() => {
        return selectHub(ep).then(res => {
          if(res) {
            $hub = res
          } else {
            state = 'fail'
          }
          return new Data
        })
      })
      .muxHTTP(() => ep + "hub", { version: 2 }).to($ => $
        .connectTLS({
          ...tlsOptions,
          onState: (session) => {
            var err = session.error
            if (err) state = 'fail'
          }
        }).to($ => $
          .connect(() => $hub, {
            onState: function (conn) {
              console.info('Tmp connection state ', conn, state)
              $hubConnection = conn
              if (conn.state === 'open') {
                // SOL_SOCKET & SO_REUSEPORT
                conn.socket.setRawOption(1, 15, new Data([1]))
              } else if (conn.state === 'connected' && state === 'closed') {
                console.info("Tmp Hub Connection created")
                state = 'forwarding'
                reverseServer.spawn()
              } else if (conn.state === 'closed' && state === 'forwarding') {
                // this means closed unexpectedly
                state = 'fail'
                leave()
              }
            },
            bind: bound,
          })
        )
      )
    )

    var reverseServer = pipeline($ => $
      .onStart(new Data)
      .repeat(() => new Timeout(5).wait().then(() => {
        if (state != 'forwarding') {
          $hubConnection.close()
          return false
        }
        return true
      })).to($ => $
        .loop($ => $
          .connectHTTPTunnel(
            new Message({
              method: 'CONNECT',
              path: `/api/punch/${config.agent.id}/${ep}`,
            })
          )
          .to(hubSession)
          .pipe(servePunch)
        )
      )
    )

    var servePunch = pipeline($ => $
      .demuxHTTP().to($ => $.pipe(() => {
        var routes = Object.entries({
          '/api/punch/{srcEp}/{destEp}/sync': {
            // Hub sent synchronize message. Once receive, start punch.
            // Agent <- Hub -> Remote Agent.
            'POST': function (params, req) {
              // TODO use params to check
              var body = JSON.decode(req.body)
              destIP = body.destIP
              destPort = body.port
              state = 'ready'

              punch(destIP, destPort)
            }
          },
        }).map(function ([path, methods]) {
          var match = new http.Match(path)
          var handler = function (params, req) {
            var f = methods[req.head.method]
            if (f) return f(params, req)
            return response(405)
          }
          return { match, handler }
        })

        return pipeline($ => $
          .replaceMessage(
            function (req) {
              var params
              var path = req.head.path
              var route = routes.find(r => Boolean(params = r.match(path)))
              if (route) {
                try {
                  var res = route.handler(params, req)
                  return res instanceof Promise ? res.catch(responseError) : res
                } catch (e) {
                  return responseError(e)
                }
              }
              meshError('Invalid api call from hub')
              return response(404)
            }
          )
        )
      }
      ))
    )

    function directSession() {
      // TODO !!! state error would happen when network is slow
      // must handle this

      if (!role) meshError('Hole not init correctly')
      if ($session) return $session

      // TODO: support TLS connection
      if (role === 'client') {
        // make session to server side directly
        $session = pipeline($ => $
          .muxHTTP(() => ep + "direct", { version: 2 }).to($ => $
            .connect(() => `${destIP}:${destPort}`, {
              onState: function (conn) {
                if (conn.state === 'open') {
                  conn.socket.setRawOption(1, 15, new Data([1]))
                } else if (conn.state === 'connected') {
                  logInfo(`Connected to remote ${destIP}:${destPort}`)
                  $connection = conn
                  state = 'connected'
                } else if (conn.state === 'closed') {
                  logInfo(`Disconnected from remote ${destIP}:${destPort}`)
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

    // Send a request.
    var request = pipeline($ => $
      .onStart(msg => {
        console.info(`Reqesting Remote: ${JSON.encode(msg.head)}`)
        return msg
      })
      .pipe(() => {
        if (state === 'connected') {
          return directSession()
        } else if(state != 'fail') {
          return hubSession
        }

        console.log(`State incorrect: ${state}, reject`)
        return pipeline($=>$.dummy())
      })
      .handleMessage(msg => $response = msg)
      .replaceMessage(new StreamEnd)
      .onEnd(() => $response)
    )

    // use THE port sending request to hub.
    function requestPunch() {
      // FIXME: add state check
      // state = 'connecting'
      role = 'client'

      request.spawn(new Message({
        method: 'GET',
        path: `/api/punch/${config.agent.id}/${ep}/request`,
      }))
    }

    // TODO add cert info into response
    function acceptPunch() {
      // state = 'connecting'
      role = 'server'

      request.spawn(new Message({
        method: 'POST',
        path: `/api/punch/${config.agent.id}/${ep}/reqeust`,
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
      $hubConnection?.close()
      $connection?.close()
      $hubConnection = null
      $connection = null
      if (state != 'fail') state = 'closed'

      // try to find the hub holding this hole
      if($hub) {
        var parent = hubs.find(h => $hub === h.address)
        parent.updateHoles()
      }
    }

    return {
      role,
      ready,
      destIP,
      destPort,
      requestPunch,
      acceptPunch,
      punch,
      makeRespTunnel,
      directSession,
      heartbeat,
      leave,
    }
  } // End of Hole

  function createInboundHole(ep) {
    try {
      var hole = Hole(ep)
    } catch {
      app.log(`Failed to create Inbound Hole, peer ${ep}`)
    }

    hole.requestPunch()
  }

  function createOutboundHole(proto, name) {
    try {
      var hole = Hole(ep)
    } catch {
      app.log(`Failed to create Inbound Hole, peer ${ep}`)
    }

    hole.acceptPunch()
  }

  function deleteHole(ep) {
    
  }

  function findHole(ep) {

  }

  function isHoleReady(hole) {

  }


  return {
    holes,
    createInboundHole,
    createOutboundHole,
    deleteHole,
    findHole,
    isHoleReady,
  }
}
