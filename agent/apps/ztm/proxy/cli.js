import cmdline from './cmdline.js'

export default function ({ app, api }) {
  return pipeline($=>$
    .onStart(argv => main(argv))
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
      return pipeline($=>$.replaceStreamStart([buffer, new StreamEnd]))
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
      return cmdline(['ztm proxy', ...argv], {
        help: text => Promise.resolve(output(text + '\n')),
        commands: [
          {
            title: 'Configure an endpoint as a listening side and/or a forwarding side',
            usage: 'config',
            options: `
              --mesh          <name>            Specify a mesh by name
                                                Can be omitted when only 1 mesh is joined
              --ep            <name>            Specify an endpoint by name or UUID
              --set-listen    [[ip:]port]       Open/close the proxy port
              --add-target    <domain|ip ...>   Add targets where traffic leaving from the endpoint can go
                                                e.g. '*.example.com' and '8.88.0.0/16'
              --remove-target <domain|ip ...>   Remove previously added targets
            `,
            action: (args) => selectEndpoint(args['--ep']).then(
              ep => api.getEndpointConfig(ep.id).then(config => {
                var changed = false

                if ('--set-listen' in args) {
                  config.listen = args['--set-listen']
                  changed = true
                }

                if ('--add-target' in args) {
                  if (!(config.targets instanceof Array)) config.targets = []
                  args['--add-target'].forEach(target => {
                    if (!config.targets.includes(target)) {
                      config.targets.push(target)
                    }
                  })
                  changed = true
                }

                if ('--remove-target' in args && config.targets instanceof Array) {
                  args['--remove-target'].forEach(target => {
                    config.targets = config.targets.filter(t => t !== target)
                  })
                  changed = true
                }

                if (changed) {
                  return api.setEndpointConfig(ep.id, config).then(
                    () => api.getEndpointConfig(ep.id).then(printConfig)
                  )
                } else {
                  return Promise.resolve(printConfig(config))
                }

                function printConfig(config) {
                  output(`Endpoint: ${ep.name} (${ep.id})\n`)
                  output(`Listen: ${config.listen || '(not listening)'}\n`)
                  if (config.targets instanceof Array && config.targets.length > 0) {
                    output('Targets:\n')
                    config.targets.forEach(t => output(`  ${t}\n`))
                  } else {
                    output('Targets: (not an exit)\n')
                  }
                }
              })
            )
          }
        ]

      }).then(flush).catch(err => {
        error(err)
        return flush()
      })

    } catch (err) {
      error(err)
      return Promise.resolve(flush())
    }
  }
}
