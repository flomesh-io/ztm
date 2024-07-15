export default function ({ app, mesh }) {
  function allEndpoints() {
    return mesh.discover()
  }

  var scripts = {}

  var $ep
  var $hash
  var $command

  var executeScriptRemote = pipeline($=>$
    .onStart(ep => { $ep = ep })
    .replaceMessageStart(req => {
      var url = new URL(req.head.path)
      return new MessageStart({
        method: 'POST',
        path: `/api/script${url.search}`
      })
    })
    .muxHTTP().to($=>$
      .pipe(() => mesh.connect($ep))
    )
  )

  var executeScriptLocal = pipeline($=>$
    .replaceMessage(req => {
      var url = new URL(req.head.path)
      var argv = JSON.parse(URL.decodeComponent(url.searchParams.get('argv')))
      var exe = app.executable
      var program = exe.endsWith('pipy') || exe.endsWith('pipy.exe') ? [exe] : [exe, '--pipy']
      $hash = addScript(req.body)
      $command = [
        ...program,
        '--no-reload',
        '--log-level=error',
        `${app.url}/api/scripts/${$hash}`,
        '--args', ...argv
      ]
      return new Data
    })
    .exec(() => $command, { stderr: true })
    .replaceStreamStart(evt => [new MessageStart, evt])
    .replaceStreamEnd(() => {
      delete scripts[$hash]
      return new MessageEnd
    })
  )

  function addScript(script) {
    var h = new crypto.Hash('sha256')
    h.update(script)
    h.update(script.size.toString())
    var hash = h.digest().toString('hex')
    scripts[hash] = script
    return hash
  }

  function getScript(hash) {
    return scripts[hash]
  }

  return {
    allEndpoints,
    getScript,
    executeScriptLocal,
    executeScriptRemote,
  }
}
