export default function ({ app, mesh }) {
  function allEndpoints() {
    return mesh.discover()
  }

  var $ctx
  var $ep
  var $filename
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
    .onStart(c => { $ctx = c })
    .pipe(() => $ctx.peer.username === app.username ? 'exec' : 'deny', {
      'exec': ($=>$
        .replaceMessage(req => {
          var url = new URL(req.head.path)
          var argv = JSON.parse(URL.decodeComponent(url.searchParams.get('argv') || '[]'))
          var exe = app.executable
          var program = exe.endsWith('pipy') || exe.endsWith('pipy.exe') ? [exe] : [exe, '--pipy']
          $filename = addScript(req.body)
          $command = [
            ...program,
            '--log-level=error',
            $filename,
            '--args', ...argv
          ]
          app.log(`Execute command: ${$command.map(s => JSON.stringify(s)).join(' ')}`)
          return new Data
        })
        .exec(() => $command, { stderr: true })
        .replaceStreamStart(evt => [new MessageStart, evt])
        .replaceStreamEnd(() => {
          os.unlink($filename)
          return new MessageEnd
        })
      ),
      'deny': $=>$.replaceMessage(new Message({ status: 403 }, 'Forbidden'))
    })

  )

  function addScript(script) {
    var h = new crypto.Hash('sha256')
    h.update(script)
    h.update(script.size.toString())
    var hash = h.digest().toString('hex')
    var filename = os.path.join(app.dataDir, 'tmp/scripts', hash + '.js')
    app.log(`Saved script to file: ${filename}`)
    os.mkdir(os.path.dirname(filename), { recursive: true })
    os.write(filename, script)
    return filename
  }

  return {
    allEndpoints,
    executeScriptLocal,
    executeScriptRemote,
  }
}
