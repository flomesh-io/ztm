#!/usr/bin/env -S pipy --args

import db from './db.js'
import options from './options.js'

var opt = options(pipy.argv, {
  defaults: {
    '--help': false,
    '--database': '~/ztm-ca.db',
    '--listen': '127.0.0.1:9999',
  },
  shorthands: {
    '-h': '--help',
    '-d': '--database',
    '-l': '--listen',
  },
})

if (opt['--help']) {
  println('Options:')
  println('  -h, --help      Show available options')
  println('  -d, --database  Pathname of the database file (default: ~/ztm-ca.db)')
  println('  -l, --listen    Port number to listen (default: 127.0.0.1:9999)')
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

if (!db.getKey('ca')) {
  (function () {
    var key = new crypto.PrivateKey({ type: 'rsa', bits: 2048 })
    var cert = new crypto.Certificate({
      subject: { CN: 'ca' },
      privateKey: key,
      publicKey: new crypto.PublicKey(key),
      days: 365,
    })
    db.setCert('ca', cert.toPEM().toString())
    db.setKey('ca', key.toPEM().toString())
  })()
}

//
// Retreive the current CA certificate
//

var caCert = new crypto.Certificate(db.getCert('ca'))
var caKey = new crypto.PrivateKey(db.getKey('ca'))

//
// REST API paths & methods
//

var routes = Object.entries({

  '/api/certificates/{name}': {
    GET: (params) => {
      var c = db.getCert(params.name)
      if (!c) return responseError(404, 'Username not found')
      return response(200, c)
    },

    POST: (params) => {
      var name = params.name
      if (isReservedName(name)) return responseError(403, 'Reserved username')
      if (db.getCert(name)) return responseError(409, 'Username already exists')
      var c = issueCertificate(name)
      db.setCert(name, c.cert.toPEM().toString());
      return response(200, c.key.toPEM().toString())
    },

    DELETE: (params) => {
      var name = params.name
      if (isReservedName(name)) return responseError(403, 'Reserved username')
      db.delCert(name)
      return response(204)
    },
  },

  '/api/sign/hub/{name}': {
    POST: (params, req) => {
      var pkey = new crypto.PublicKey(req.body)
      var cert = signCertificate(params.name, pkey)
      return response(200, cert.toPEM().toString())
    }
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

function responseError(status, message) {
  return response(status, { status, message })
}

function isReservedName(name) {
  return (name === 'ca' || isHubName(name))
}

function isHubName(name) {
  return (name === 'hub' || name.startsWith('hub/'))
}

function issueCertificate(name) {
  var key = new crypto.PrivateKey({ type: 'rsa', bits: 2048 })
  var pkey = new crypto.PublicKey(key)
  var cert = signCertificate(name, pkey)
  return { cert, key }
}

function signCertificate(name, pkey) {
  return new crypto.Certificate({
    subject: { CN: name },
    days: 365,
    issuer: caCert,
    privateKey: caKey,
    publicKey: pkey,
  })
}
