#!/usr/bin/env -S pipy --skip-unknown-arguments

import db from './db.js'
import options from './options.js'

var opt = options({
  defaults: {
    '--help': false,
    '--database': '~/ztm-auth.db',
    '--listen': '0.0.0.0:9999',
  },
  shorthands: {
    '-h': '--help',
    '-d': '--database',
    '-l': '--listen',
  },
})

if (options['--help']) {
  println('Options:')
  println('  -h, --help      Show available options')
  println('  -d, --database  Pathname of the database file (default: ~/ztm.db)')
  println('  -l, --listen    Port number to listen (default: 0.0.0.0:9999)')
  return
}

var dbPath = opt['--database']
if (dbPath.startsWith('~/')) {
  dbPath = os.home() + dbPath.substring(1)
}

db.open(dbPath)

//
// Generate the CA certificate
//

if (!db.getUser('root')) {
  (function () {
    var key = new crypto.PrivateKey({ type: 'rsa', bits: 2048 })
    var cert = new crypto.Certificate({
      subject: { CN: 'root' },
      privateKey: key,
      publicKey: new crypto.PublicKey(key),
      days: 365,
    })
    db.setUser('root', {
      cert: cert.toPEM().toString(),
      key: key.toPEM().toString(),
      roles: {},
    })
  })()
}

//
// Retreive the current CA certificate
//

var caCert = new crypto.Certificate(db.getUser('root').cert)
var caKey = new crypto.PrivateKey(db.getUser('root').key)

//
// REST API paths & methods
//

var routes = Object.entries({

  '/api/users/{name}': {
    GET: (params) => {
      var u = db.getUser(params.name)
      if (!u) return response(404)
      return response(200, {
        name: params.name,
        cert: u.cert,
        roles: u.roles,
      })
    },

    POST: (params, req) => {
      if (db.getUser(params.name)) return response(409)
      var obj = JSON.decode(req.body)
      var key = new crypto.PrivateKey({ type: 'rsa', bits: 2048 })
      var pkey = new crypto.PublicKey(key)
      var cert = new crypto.Certificate({
        subject: { CN: params.name },
        days: 365,
        issuer: caCert,
        publicKey: pkey,
        privateKey: caKey,
      })
      db.setUser(params.name, {
        cert: cert.toPEM().toString(),
        roles: obj.roles,
      })
      return response(200, key.toPEM().toString())
    },

    DELETE: (params) => {
      if (params.name === 'root') return response(403)
      db.delUser(params.name)
      return response(204)
    },
  },

  '/api/users/{name}/certificate': {

    GET: (params) => {
      var u = db.getUser(params.name)
      if (!u) return response(404)
      return response(200, u.cert)
    },
  },

}).map(
  function ([path, methods]) {
    var match = new http.Match(path)
    var handler = function (params, req) {
      var f = methods[req.head.method]
      if (f) return f(params, req)
      return new Message({ status: 405 })
    }
    return { match, handler }
  }
)

//
// Handle requests
//

var $isFromLocal

pipy.listen(opt['--listen'], $=>$
  .onStart(ib => { $isFromLocal = (ib.localAddress === '127.0.0.1') })
  .serveHTTP(
    function (req) {
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
      return new Message({ status: 404 })
    }
  )
)

function response(status, body) {
  if (!body) return new Message({ status })
  if (typeof body === 'string') return responseCT(status, 'text/plain', body)
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
