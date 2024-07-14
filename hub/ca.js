import db from './db.js'

var caCert
var caKey

function init() {
  if (!db.getKey('ca')) {
    var key = new crypto.PrivateKey({ type: 'rsa', bits: 2048 })
    var cert = new crypto.Certificate({
      subject: { CN: 'ca' },
      privateKey: key,
      publicKey: new crypto.PublicKey(key),
      days: 365,
    })
    db.setCert('ca', cert.toPEM().toString())
    db.setKey('ca', key.toPEM().toString())
  }

  caCert = new crypto.Certificate(db.getCert('ca'))
  caKey = new crypto.PrivateKey(db.getKey('ca'))

  return Promise.resolve()
}

function getCertificate(name) {
  var pem = db.getCert(name)
  var crt = pem ? new crypto.Certificate(pem) : null
  return Promise.resolve(crt)
}

function issueCertificate(name) {
  var key = new crypto.PrivateKey({ type: 'rsa', bits: 2048 })
  var pkey = new crypto.PublicKey(key)
  var cert = signCertificate(name, pkey)
  return Promise.resolve({ cert, key })
}

function signCertificate(name, pkey) {
  var crt = new crypto.Certificate({
    subject: { CN: name },
    days: 365,
    issuer: caCert,
    privateKey: caKey,
    publicKey: pkey,
  })
  return Promise.resolve(crt)
}

export default {
  init,
  getCertificate,
  issueCertificate,
  signCertificate,
}
