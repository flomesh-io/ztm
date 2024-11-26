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
            title: 'Configure an endpoint as a listening side and/or a forwarding side',
            usage: 'config',
            options: `
              --set-listen        [[ip:]port]       Open/close the proxy port
              --add-target        <domain|ip ...>   Add targets where traffic can go via the endpoint
                                                    e.g. '*.example.com' and '8.88.0.0/16'
              --remove-target     <domain|ip ...>   Remove previously added targets
              --add-exclusion     <domain|ip ...>   Add excluded targets where traffic can't go via the endpoint
                                                    e.g. '*.example.com' and '8.88.0.0/16'
              --remove-exclusion  <domain|ip ...>   Remove previously added exclusions
              --gen-cert          <on|off>          Enable/disable certificate generation
              --set-log           <splunk|off>      Enable/disable logging
              --log-address       <host:port>       Set the address of the logging service, used with --set-log
              --log-token         <token>           Set the authentication token for the logging service, used with --set-log
            `,
            action: (args) => api.getEndpointConfig(endpoint.id).then(config => {
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

              if ('--add-exclusion' in args) {
                if (!(config.exclusions instanceof Array)) config.exclusions = []
                args['--add-exclusion'].forEach(target => {
                  if (!config.exclusions.includes(target)) {
                    config.exclusions.push(target)
                  }
                })
                changed = true
              }

              if ('--remove-exclusion' in args && config.exclusions instanceof Array) {
                args['--remove-exclusion'].forEach(target => {
                  config.exclusions = config.exclusions.filter(t => t !== target)
                })
                changed = true
              }

              if ('--gen-cert' in args) {
                switch (args['--gen-cert']) {
                  case 'on': config.generateCert = true; break
                  case 'off': config.generateCert = false; break
                  default: throw `option --gen-cert must be one of: on, off`
                }
                changed = true
              }

              if ('--set-log' in args) {
                switch (args['--set-log']) {
                  case 'splunk':
                    config.log = {
                      splunk: {
                        address: args['--log-address'],
                        token: args['--log-token'],
                      }
                    }
                    break
                  case 'off':
                    config.log = null
                    break
                  default: throw `option --set-log must be one of: splunk, off`
                }
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
                output(`Listen: ${config.listen || '(not listening)'}\n`)
                if (config.targets instanceof Array && config.targets.length > 0) {
                  output('Targets:\n')
                  config.targets.forEach(t => output(`  ${t}\n`))
                  if (config.exclusions instanceof Array && config.exclusions.length > 0) {
                    output('Excluded Targets:\n')
                    config.exclusions.forEach(t => output(`  ${t}\n`))
                  }
                } else {
                  output('Targets: (not an exit)\n')
                }
                output(`Generate Certificate: ${config.generateCert ? 'On' : 'Off'}\n`)
                if (config.log?.splunk) {
                  output(`Logging:\n`)
                  output(`  Target: Splunk\n`)
                  output(`  Address: ${config.log.splunk.address}\n`)
                  output(`  Token: ${config.log.splunk.token}\n`)
                } else {
                  output(`Logging: Off\n`)
                }
              }
            })
          },

          {
            title: 'Print the CA certificate used for issuing MITM certificates',
            usage: 'ca',
            action: () => api.getEndpointCA(endpoint.id).then(cert => {
              if (cert) {
                output(cert)
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
