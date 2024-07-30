export default function ({ app, api, utils }) {
  var $handler

  return pipeline($=>$
    .onStart(ctx => main(ctx))
  )

  function main({ argv, cwd, endpoint }) {
    var buffer = new Data

    function output(str) {
      buffer.push(str)
    }

    function flush() {
      return Promise.resolve([buffer, new StreamEnd])
    }

    function error(err) {
      output('ztm: ')
      output(err.message || err.toString())
      output('\n')
      return flush()
    }

    try {
      return utils.parseArgv(argv, {
        help: text => Promise.resolve(output(text + '\n')),
        commands: [
          {
            title: 'Execute a script on a remote endpoint',
            usage: '<filename>',
            options: `
              --, --args  ...   Pass all options afterwards to the script
            `,
            action: (args) => {
              var filename = args['<filename>']
              var pathname = os.path.resolve(cwd, filename)
              var script = os.read(pathname)
              var argv = args['--args'] || []
              return pipeline($=>$
                .onStart(new Message(
                  {
                    method: 'POST',
                    path: `/api/script?argv=${URL.encodeComponent(JSON.stringify(argv))}`
                  },
                  script
                ))
                .pipe(api.executeScriptRemote, () => endpoint.id)
                .replaceMessage(res => {
                  output(res?.body || new Data)
                  return new StreamEnd
                })
              ).spawn()
            }
          }
        ]
      }).then(flush).catch(error)

    } catch (err) { return error(err) }
  }
}
