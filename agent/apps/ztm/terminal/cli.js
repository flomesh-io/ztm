export default function ({ app, api, utils }) {
  var $handler

  return pipeline($=>$
    .onStart(ctx => main(ctx).then(h => void ($handler = h)))
    .pipe(() => $handler)
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
      return Promise.resolve(
        pipeline($=>$
          .replaceStreamStart([buffer, new StreamEnd])
        )
      )
    }

    function selectEndpoint(name) {
      if (name) {
        return api.allEndpoints(name, name).then(endpoints => {
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
      return utils.parseArgv(argv, {
        help: text => {
          output(text + '\n')
          return flush()
        },
        commands: [

          {
            title: 'View or set the terminal settings on an endpoint',
            usage: 'config',
            options: `
              --set-shell [command]   Set the command to start the shell program when a terminal is opened
              --add-user  [username]  Allow the specified user to access the terminal
              --del-user  [username]  Forbid the specified user to access the terminal
            `,
            action: (args) => api.getEndpointConfig(endpoint.id).then(config => {
              var changed = false
              if ('--set-shell' in args) {
                config.shell = args['--set-shell']
                changed = true
              }

              if ('--add-user' in args) {
                config.users ??= []
                config.users.push(args['--add-user'])
                changed = true
              }

              if ('--del-user' in args) {
                var user = args['--del-user']
                config.users = (config.users || []).filter(u => u !== user)
                changed = true
              }

              if (changed) {
                return api.setEndpointConfig(endpoint.id, config).then(
                  () => api.getEndpointConfig(endpoint.id).then(printConfig).then(flush)
                )
              } else {
                printConfig(config)
                return flush()
              }

              function printConfig(config) {
                output(`Endpoint: ${endpoint.name} (${endpoint.id})\n`)
                output(`Shell: ${config.shell || '(default)'}\n`)
                output(`Allowed Users:`)
                if (config.users instanceof Array && config.users.length > 0) {
                  output('\n')
                  config.users.forEach(user => output(`  ${user}\n`))
                } else {
                  output(' (owner only)\n')
                }
              }
            })
          },

          {
            title: 'Connect to the terminal on an endpoint',
            usage: 'open <endpoint name>',
            action: (args) => selectEndpoint(args['<endpoint name>']).then(
              ep => api.openTerminal(ep.id)
            )
          },
        ]

      }).catch(err => {
        error(err)
        return flush()
      })

    } catch (err) {
      error(err)
      return flush()
    }
  }
}
