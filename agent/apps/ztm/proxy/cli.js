export default function ({ api, mesh, utils }) {
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
            title: 'View or change proxy rules',
            usage: 'rules',
            options: `
              --index     <number>          Open/close the proxy port
              --insert                      Insert a new rule at the given index
              --delete                      Delete the rule at the given index
              --users     <username ...>    Match specified users
              --groups    <group ...>       Match specified user groups
              --targets   <domain|ip ...>   Match specified targets
                                            e.g. '*.example.com' and '8.88.0.0/16'
              --action    <allow|deny>      Specify the action to take
            `,
            action: (args) => api.getEndpointConfig(endpoint.id).then(config => {
              if (!(config.rules instanceof Array)) config.rules = []

              var index = args['--index']
              var insert = args['--insert']
              var remove = args['--delete']
              var users = args['--users']
              var groups = args['--groups']
              var targets = args['--targets']
              var action = args['--action']

              if (!index && !insert && !remove && !users && !groups && !targets && !action) {
                return printRules(config.rules || [])
              }

              if (!index) throw `Missing option --index`

              index = Number.parseInt(index)
              if (Number.isNaN(index)) throw `Invalid value for option --index`
              if (index < 0 || index > config.rules.length) throw `Value out of range for option --index`

              if (remove) {
                if (insert || users || groups || targets || action) throw `Option --delete can only be used alone`
                config.rules.splice(index, 1)
                return api.setEndpointConfig(endpoint.id, config).then(
                  () => printRules(config.rules)
                )
              }

              if (!action) throw `Missing option --action`
              if (action !== 'allow' && action !== 'deny') throw `Invalid value for option --action`

              var allGroups = []

              return pipeline($=>$
                .onStart(new Message({ method: 'GET', path: '/api/groups' }))
                .muxHTTP().to($=>$.pipe(mesh.connect({ app: 'users' })))
                .replaceMessage(res => {
                  if (res?.head?.status === 200) {
                    allGroups = JSON.decode(res.body)
                  }
                  return new StreamEnd
                })
              ).spawn().then(() => {
                if (groups) {
                  groups = groups.map(name => {
                    var matches = allGroups.filter(g => g.name === name)
                    if (matches.length === 0) throw `No user group '${name}'`
                    if (matches.length > 1) throw `Ambiguous user group '${name}'`
                    return matches[0].id
                  })
                }
                var rule = { targets, users, groups, action }
                if (insert) {
                  config.rules.splice(index, 0, rule)
                } else {
                  config.rules[index] = rule
                }
                return api.setEndpointConfig(endpoint.id, config).then(
                  () => printRules(config.rules)
                )
              })

              function printRules(rules) {
                var groups = {}
                rules.forEach(rule => {
                  if (rule.groups instanceof Array) {
                    rule.groups.forEach(gid => groups[gid] = null)
                  }
                })
                var $result = null
                var queryGroupName = pipeline($=>$
                  .onStart(gid => new Message({ method: 'GET', path: `/api/groups/${gid}` }))
                  .muxHTTP().to($=>$.pipe(mesh.connect({ app: 'users' })))
                  .handleMessage(res => $result = (res?.head?.status === 200 ? JSON.decode(res.body).name : null))
                  .replaceMessage(new StreamEnd)
                  .onEnd(() => $result)
                )
                return Promise.all(
                  Object.keys(groups).map(
                    gid => queryGroupName.spawn(gid).then(
                      name => groups[gid] = name
                    )
                  )
                ).then(() => {
                  printTable(rules, {
                    '': (_, i) => '#' + i,
                    'TARGETS': r => r.targets?.length > 0 ? r.targets.join(' ') : '-',
                    'USERS': r => r.users?.length > 0 ? r.users.join(' ') : '-',
                    'GROUPS': r => r.groups?.length > 0 ? r.groups.map(gid => groups[gid] || gid).join(' ') : '-',
                    'ACTION': r => r.action,
                  })
                })
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

    function printTable(data, columns) {
      var cols = Object.entries(columns)
      var colHeaders = cols.map(i => i[0])
      var colFormats = cols.map(i => i[1])
      var colSizes = colHeaders.map(name => name.length)
      var rows = data.map((row, i) => colFormats.map(
        (format, j) => {
          var v = (format(row, i) || '').toString()
          colSizes[j] = Math.max(colSizes[j], v.length)
          return v
        }
      ))
      colHeaders.forEach((name, i) => output(name.padEnd(colSizes[i] + 2)))
      output('\n')
      rows.forEach(row => {
        row.forEach((v, i) => output(v.padEnd(colSizes[i] + 2)))
        output('\n')
      })
    }
  }
}
