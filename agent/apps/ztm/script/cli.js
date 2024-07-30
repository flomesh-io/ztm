export default function ({ app, api, utils }) {
  var $ctx
  var $script
  var $argv
  var $output

  return pipeline($=>$
    .onStart(c => {
      $ctx = c
      return new MessageStart
    })
    .pipe(
      function () {
        try {
          return utils.parseArgv($ctx.argv, {
            help: text => {
              $output = new Data(text)
              $output.push('\n')
              return 'output'
            },
            commands: [
              {
                title: 'Execute a script on a remote endpoint',
                usage: '<filename>',
                options: `
                  --, --args  ...   Pass all options afterwards to the script
                `,
                action: (args) => {
                  $argv = args['--args'] || []
                  var filename = args['<filename>']
                  if (filename === '-') {
                    $script = new Data
                    return 'read'
                  }
                  var pathname = os.path.resolve($ctx.cwd, filename)
                  $script = os.read(pathname)
                  return 'exec'
                }
              }
            ]
          })
        } catch (err) {
          $output = new Data('ztm: ')
          $output.push(err.message || err.toString())
          $output.push('\n')
          return 'output'
        }
      }, {
        'output': $=>$.replaceData().replaceStreamStart(() => [$output, new StreamEnd]),
        'exec': $=>$.replaceData().replaceStreamStart(() => exec().then(output => [output, new StreamEnd])),
        'read': $=>$.replaceData(data => { $script.push(data) }).replaceStreamEnd(() => exec().then(output => [output, new StreamEnd])),
      }
    )
  )

  function exec() {
    var ep = $ctx.endpoint.id
    return pipeline($=>$
      .onStart(new Message(
        {
          method: 'POST',
          path: `/api/script?argv=${URL.encodeComponent(JSON.stringify($argv))}`
        },
        $script
      ))
      .pipe(api.executeScriptRemote, () => ep)
      .replaceMessage(res => {
        $output = res?.body || new Data
        return new StreamEnd
      })
      .onEnd(() => $output)
    ).spawn()
  }
}
