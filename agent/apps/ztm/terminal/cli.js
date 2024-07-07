export default function ({ app, api, utils }) {
  var $handler

  return pipeline($=>$
    .onStart(argv => main(argv).then(h => void ($handler = h)))
    .pipe(() => $handler)
  )

  function main(argv) {
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
      return Promise.resolve(
        pipeline($=>$
          .replaceStreamStart([buffer, new StreamEnd])
        )
      )
    }

    var endpoints = null

    function allEndpoints() {
      if (endpoints) return Promise.resolve(endpoints)
      return api.allEndpoints().then(list => (endpoints = list))
    }

    function selectEndpoint(name) {
      if (name) {
        return allEndpoints().then(endpoints => {
          var ep = endpoints.find(ep => ep.id === name)
          if (ep) return ep
          var list = endpoints.filter(ep => ep.name === name)
          if (list.length === 1) return list[0]
          if (list.length === 0) throw `endpoint '${name}' not found`
          throw `ambiguous endpoint name '${name}'`
        })
      } else {
        return Promise.resolve(app.endpoint)
      }
    }

    try {
      return utils.parseArgv(['ztm terminal', ...argv], {
        help: text => {
          output(text + '\n')
          return flush()
        },
        commands: [

          {
            title: 'View or set the terminal settings on an endpoint',
            usage: 'config',
            options: `
              --mesh      <name>      Specify a mesh by name
              --ep        <name>      Specify an endpoint by name or UUID
              --set-shell [command]   Set the command to start the shell program when a terminal is opened
            `,
            action: (args) => selectEndpoint(args['--ep']).then(
              ep => api.getEndpointConfig(ep.id).then(config => {
                var changed = false
                if ('--set-shell' in args) {
                  config.shell = args['--set-shell']
                  changed = true
                }

                if (changed) {
                  return api.setEndpointConfig(ep.id, config).then(
                    () => api.getEndpointConfig(ep.id).then(printConfig).then(flush)
                  )
                } else {
                  printConfig(config)
                  return flush()
                }

                function printConfig(config) {
                  output(`Endpoint: ${ep.name} (${ep.id})\n`)
                  output(`Shell: ${config.shell || '(default)'}\n`)
                }
              })
            )
          },

          {
            title: 'Connect to the terminal on an endpoint',
            usage: 'open <endpoint name>',
            options: `
              --mesh  <name>  Specify a mesh by name
                              Can be omitted when only 1 mesh is joined
            `,
            action: (args) => selectEndpoint(args['<endpoint name>']).then(
              ep => api.openTerminal(ep.id)
            )
          },
        ]

      }).catch(err => {
        println(err)
        error(err)
        return flush()
      })

    } catch (err) {
      println(err)
      error(err)
      return flush()
    }
  }
}
