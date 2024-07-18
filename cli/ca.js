import db from './db.js'

var caCert
var caKey
var caURL

function init(url) {
  if (url) {
    caURL = new URL(url)
  } else {
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
  }
  return Promise.resolve()
}

function getCertificate(name) {
  if (caURL) {
    var url = caURL
    var ha = new http.Agent(url.host)
    return ha.request(
      'GET', os.path.join(url.path, name)
    ).then(res => {
      var status = res?.head?.status
      if (200 <= status && status <= 299) {
        return new crypto.Certificate(res.body.toString())
      }
      return null
    })
  } else {
    var pem = db.getCert(name)
    var crt = pem ? new crypto.Certificate(pem) : null
    return Promise.resolve(crt)
  }
}

function signCertificate(name, pkey) {
  if (caURL) {
    var url = caURL
    var ha = new http.Agent(url.host)
    return ha.request(
      'POST', os.path.join(url.path, name), null, pkey.toPEM()
    ).then(res => {
      var status = res?.head?.status
      if (200 <= status && status <= 299) {
        return new crypto.Certificate(res.body.toString())
      }
      return null
    })
  } else {
    var crt = new crypto.Certificate({
      subject: { CN: name },
      days: 365,
      issuer: caCert,
      privateKey: caKey,
      publicKey: pkey,
    })
    return Promise.resolve(crt)
  }
}

export default {
  init,
  getCertificate,
  signCertificate,
}
