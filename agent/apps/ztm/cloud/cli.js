export default function ({ api, utils }) {
  return pipeline($=>$
    .onStart(ctx => main(ctx))
  )

  function main({ argv, endpoint }) {
    var buffer = new Data

    function output(str) {
      buffer.push(str)
    }

    function error(err) {
      output('ztm: ')
      output(err.message || err.toString())
      output('\n')
    }

    function flush() {
      return Promise.resolve([buffer, new StreamEnd])
    }

    try {
      return utils.parseArgv(argv, {
        help: text => Promise.resolve(output(text + '\n')),
        commands: [
          {
            title: 'Change endpoint settings',
            usage: 'config',
            options: `
              --local-dir       <pathname>      Set the local directory to mirror the cloud files
              --add-mirror      <pathname ...>  Start auto-downloading the given files or directories
              --remove-mirror   <pathname ...>  Stop auto-downloading the given files or directories
            `,
            action: (args) => api.getEndpointConfig(endpoint.id).then(config => {
              var changed = false

              if ('--local-dir' in args) {
                config.localDir = os.path.resolve(args['--local-dir'])
                changed = true
              }

              if ('--add-mirror' in args) {
                if (!(config.mirrorPaths instanceof Array)) config.mirrorPaths = []
                args['--add-mirror'].forEach(path => {
                  path = os.path.normalize(path)
                  if (!config.mirrorPaths.includes(path)) {
                    config.mirrorPaths.push(path)
                  }
                })
                changed = true
              }

              if ('--remove-mirror' in args && config.mirrorPaths instanceof Array) {
                args['--remove-mirror'].forEach(path => {
                  path = os.path.normalize(path)
                  config.mirrorPaths = config.mirrorPaths.filter(p => p !== path)
                })
                changed = true
              }

              if (changed) {
                return api.setEndpointConfig(endpoint.id, config).then(
                  () => api.getEndpointConfig(endpoint.id).then(printConfig)
                )
              } else {
                return Promise.resolve(printConfig(config))
              }

              function printConfig(config) {
                output(`Endpoint: ${endpoint.name} (${endpoint.id})\n`)
                output(`Local Directory: ${config.localDir}\n`)
                if (config.mirrorPaths instanceof Array && config.mirrorPaths.length > 0) {
                  output('Auto Mirror Paths:\n')
                  config.mirrorPaths.forEach(path => output(`  ${path}\n`))
                } else {
                  output('Auto Mirror Paths: (none)\n')
                }
              }
            })
          }
        ]

      }).then(flush).catch(err => {
        error(err)
        return flush()
      })

    } catch (err) {
      error(err)
      return flush()
    }
  }
}
