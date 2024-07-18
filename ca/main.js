#!/usr/bin/env -S pipy --args

import cmdline from './cmdline.js'

cmdline(pipy.argv, {
  commands: [{
    title: 'A Sample of ZTM CA Service',
    options: `
      -l, --listen  <[ip:]port>   Service port to listen on (default: 127.0.0.1:9999)
      -p, --path    <pathname>    Base path of the REST API (default: /api/certificates)
    `,

    action: (args) => {
      var listen = args['--listen'] || '127.0.0.1:9999'
      var basePath = args['--path'] || '/api/certificates'

      var caKey = new crypto.PrivateKey({
        type: 'rsa',
        bits: 2048,
      })

      var caCert = new crypto.Certificate({
        subject: { CN: 'ca' },
        privateKey: caKey,
        publicKey: new crypto.PublicKey(caKey),
        days: 365,
      })

      var handler = service({

        [`${basePath}/{name}`]: {
          'GET': (params) => {
            var name = params.name
            if (name === 'ca') {
              return response(200, caCert.toPEM().toString())
            } else {
              return response(404)
            }
          },

          'POST': (params, req) => {
            var name = params.name
            var pkey = new crypto.PublicKey(req.body)
            var cert = new crypto.Certificate({
              subject: { CN: name },
              issuer: caCert,
              privateKey: caKey,
              publicKey: pkey,
              days: 365,
            })
            console.info(`Issued certificate to ${name}`)
            return response(201, cert.toPEM().toString())
          },
        }

      })

      pipy.listen(listen, $=>$.serveHTTP(handler))
    }
  }]
})

function service(routes) {
  routes = Object.entries(routes).map(
    function ([path, methods]) {
      var match = new http.Match(path)
      var handler = function (params, req) {
        var f = methods[req.head.method]
        if (f) return f(params, req)
        return response(405)
      }
      return { match, handler }
    }
  )

  return (req) => {
    var path = req.head.path
    var params = null
    var route = routes.find(r => Boolean(params = r.match(path)))
    if (route) {
      try {
        return route.handler(params, req)
      } catch (e) {
        return response(500, e)
      }
    }
    return response(404)
  }
}

function response(status, body) {
  if (!body) return new Message({ status })
  if (typeof body === 'string') return responseCT(status, 'text/plain', body)
  if (body instanceof Data) return responseCT(status, 'application/octet-stream', body)
  return responseCT(status, 'application/json', JSON.encode(body))
}

function responseCT(status, ct, body) {
  return new Message(
    {
      status,
      headers: { 'content-type': ct }
    },
    body
  )
}
