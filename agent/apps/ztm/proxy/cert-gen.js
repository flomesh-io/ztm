export default function ({ app, mesh }) {
  var caKey = null
  var caCert = null
  var key = null
  var pkey = null

  Promise.all([
    mesh.read('/local/ca.key'),
    mesh.read('/local/ca.crt'),
  ]).then(([caKeyFile, caCertFile]) => {
    if (caKeyFile && caCertFile) {
      caKey = new crypto.PrivateKey(caKeyFile)
      caCert = new crypto.Certificate(caCertFile)
    } else {
      caKey = new crypto.PrivateKey({ type: 'rsa', bits: 2048 })
      caCert = new crypto.Certificate({
        subject: { CN: 'ztm.flomesh.io' },
        extensions: { basicConstraints: 'CA:TRUE' },
        privateKey: caKey,
        publicKey: new crypto.PublicKey(caKey),
      })
      mesh.write('/local/ca.key', caKey.toPEM())
      mesh.write('/local/ca.crt', caCert.toPEM())
    }
  
    app.log('CA Private Key:\n' + caKey.toPEM().toString())
    app.log('CA Certificate:\n' + caCert.toPEM().toString())

    key = new crypto.PrivateKey({ type: 'rsa', bits: 2048 })
    pkey = new crypto.PublicKey(key)
  })

  var cache = new algo.Cache(
    domain => {
      var cert = new crypto.Certificate({
        subject: { CN: domain },
        extensions: { subjectAltName: `DNS:${domain}` },
        days: 7,
        timeOffset: -3600,
        issuer: caCert,
        publicKey: pkey,
        privateKey: caKey,
      })

      app.log(`Generated certificate for ${domain}`)
      return { key, cert }
    },
    null, { ttl: 60*60 }
  )

  function getCA() {
    return caCert
  }

  function generateCertificate(domain) {
    return cache.get(domain)
  }

  return { getCA, generateCertificate }
}
