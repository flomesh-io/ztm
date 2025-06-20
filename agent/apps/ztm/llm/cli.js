export default function ({ app, mesh, api, utils }) {
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
      if (err.stack) {
        output(err.stack)
        output('\n')
      }
    }

    function flush() {
      return [buffer, new StreamEnd]
    }

    function findEndpoint(ep) {
      return mesh.discover(ep, ep).then(
        list => {
          if (list.length === 0) throw `Endpoint '${ep}' not found`
          if (list.length > 1) throw `Ambiguous endpoint '${ep}`
          return list[0]
        }
      )
    }

    try {
      return utils.parseArgv(argv, {
        help: text => Promise.resolve(output(text + '\n')),
        notes: objectTypeNotes + objectNameNotes,
        commands: [

          {
            title: 'List objects of the specified type',
            usage: 'get <object type>',
            notes: objectTypeNotes,
            action: (args) => {
              switch (validateObjectType(args, 'get')) {
                case 'service': return getService()
                case 'route': return getRoute()
              }
            }
          },

          {
            title: 'Show details of the specified object',
            usage: 'describe <object type> <object name>',
            options: `
              For services:

              --ep        <endpoint>        Endpoint from where the service can be reached
              --kind      <kind>            What kind of service
            `,
            notes: objectTypeNotes + objectNameNotes,
            action: (args) => {
              var name = args['<object name>']
              switch (validateObjectType(args, 'describe')) {
                case 'service': return describeService(name, args['--ep'], args['--kind'])
                case 'route': return describeRoute(name)
              }
            }
          },

          {
            title: 'Create an object of the specified type',
            usage: 'create <object type> <object name>',
            options: `
              --ep        <endpoint>        Endpoint from where the service can be reached
              --kind      <kind>            What kind of service
                                            Options: llm, tool

              For services:

              --protocol  <protocol>        What protocol the service speaks
                                            Options: http, mcp
              --metainfo  <name=value ...>  Multiple pairs of name=value as metainfo
                                            Name options: version, provider, description
              --target    <name=value ...>  Multiple pairs of name=value describing the target
                                            Name options: address, headers.xxx, body, argv, env.XXX

              For routes:

              --service   <name>            Name of the service
              --cors      <name=value ...>  Multiple pairs of name=value regarding CORS.
                                            Name options: allowOrigins, allowMethods, allowHeaders
            `,
            notes: objectTypeNotes + objectNameNotes,
            action: (args) => {
              var name = args['<object name>']
              switch (validateObjectType(args, 'open')) {
                case 'service': return createService(name, args['--kind'], args['--protocol'], args['--metainfo'], args['--ep'], args['--target'])
                case 'route': return createRoute(name, args['--service'], args['--ep'], args['--kind'], args['--cors'])
              }
            }
          },

          {
            title: 'Delete the specified object',
            usage: 'delete <object type> <object name>',
            notes: objectTypeNotes + objectNameNotes,
            options: `
              For services:

              --ep        <endpoint>        Endpoint from where the service can be reached
              --kind      <kind>            What kind of service
            `,
            action: (args) => {
              var name = args['<object name>']
              switch (validateObjectType(args, 'close')) {
                case 'service': return deleteService(name, args['--ep'], args['--kind'])
                case 'route': return deleteRoute(name)
              }
            }
          },
        ]

      }).then(flush).catch(err => {
        error(err)
        return flush()
      })

    } catch (err) {
      error(err)
      return Promise.resolve(flush())
    }

    function getService() {
      return api.allServices().then(({ endpoints, services }) => {
        var ownedServices = services.filter(
          service => {
            var ep = endpoints[service.endpoint.id]
            return ep?.username === app.username
          }
        )
        return Promise.all(ownedServices.map(
          s => api.getService(s.endpoint.id, s.kind, s.name).then(
            service => {
              if (service) {
                s.target = service.target
              }
            }
          )
        )).then(() => {
          printTable(services, {
            'NAME': s => s.name,
            'KIND': s => s.kind,
            'ENDPOINT': s => {
              var ep = endpoints[s.endpoint.id]
              return ep.name || ep.id
            },
            'PROTOCOL': s => s.protocol,
            'VERSION': s => s.metainfo.version || '(n/a)',
            'PROVIDER': s => s.metainfo.provider || '(n/a)',
            'TARGET': s => s.target?.address || '(n/a)',
          })
        })
      })
    }

    function getRoute() {
      return api.allRoutes(endpoint.id).then(({ endpoints, routes }) => {
        printTable(routes, {
          'PATH': r => r.path,
          'SERVICE': r => r.service.name,
          'KIND': r => r.service.kind,
          'ENDPOINT': r => {
            var ep = endpoints[r.service.endpoint.id]
            return ep.name || ep.id
          },
        })
      })
    }

    function describeService(name, ep, kind) {
      return findService(ep, kind, name).then(s => {
        return api.getService(s.endpoint.id, s.kind, s.name).then(service => {
          if (service) s.target = service.target
          output(`Name: ${s.name}\n`)
          output(`Kind: ${s.kind}\n`)
          output(`Protocol: ${s.protocol}\n`)
          output(`Version: ${s.metainfo.version || '(n/a)'}\n`)
          output(`Provider: ${s.metainfo.provider || '(n/a)'}\n`)
          output(`Description: ${s.metainfo.description || '(n/a)'}\n`)
          output(`Endpoint:\n`)
          output(`  ID: ${s.endpoint.id}\n`)
          output(`  Name: ${s.endpoint.name || '(n/a)'}\n`)
          output(`  Username: ${s.endpoint.username || '(n/a)'}\n`)
          output(`  Labels: ${s.endpoint.labels?.join?.(' ') || '(none)'}\n`)
          output(`LocalRoutes:\n`)
          if (s.localRoutes?.length > 0) {
            s.localRoutes.forEach(r => output(`  ${r.path}\n`))
          } else {
            output(`  (none)\n`)
          }
          if (s.target) {
            output(`Target:\n`)
            output(`  Address: ${s.target.address || '(n/a)'}\n`)
            if (s.target.headers) {
              output(`  Headers:\n`)
              Object.entries(s.target.headers).forEach(
                ([k, v]) => output(`    ${k}: ${v}\n`)
              )
            }
            if (s.target.body) {
              output(`  Body: ${JSON.stringify(s.target.body)}\n`)
            }
            if (s.target.argv) {
              output(`  Arguments:\n`)
              s.target.argv.forEach(arg => output(`    ${arg}\n`))
            }
            if (s.target.env) {
              output(`  Environment:\n`)
              Object.entries(s.target.env).forEach(
                ([k, v]) => output(`    ${k}=${v}\n`)
              )
            }
          }
        })
      })
    }

    function describeRoute(path) {
      return api.getRoute(endpoint.id, path).then(route => {
        if (!route) return
        output(`Path: ${route.path}\n`)
        output(`Service:\n`)
        output(`  Name: ${route.service.name}\n`)
        output(`  Kind: ${route.service.kind}\n`)
        output(`  Endpoint:\n`)
        output(`    ID: ${route.service.endpoint.id}\n`)
        output(`    Name: ${route.service.endpoint.name || '(n/a)'}\n`)
        output(`    Username: ${route.service.endpoint.username || '(n/a)'}\n`)
        output(`    Labels: ${route.service.endpoint.labels?.join?.(' ') || '(none)'}\n`)
        if (route.cors) {
          output(`CORS:\n`)
          if (route.cors.allowOrigins) output(`  Allow Origins: ${route.cors.allowOrigins.join(', ')}\n`)
          if (route.cors.allowMethods) output(`  Allow Methods: ${route.cors.allowMethods.join(', ')}\n`)
          if (route.cors.allowHeaders) output(`  Allow Headers: ${route.cors.allowHeaders.join(', ')}\n`)
        } else {
          output(`CORS: (n/a)\n`)
        }
      })
    }

    function createService(name, kind, protocol, metainfo, ep, target) {
      return findEndpoint(ep || endpoint.id).then(
        ep => {
          var targetInfo = getNameValues(target)
          if (targetInfo.argv) targetInfo.argv = breakArguments(targetInfo.argv)
          if (targetInfo.body) {
            try {
              targetInfo.body = JSON.parse(targetInfo.body)
            } catch {
              throw `Invalid JSON of field body`
            }
          }
          return api.setService(ep.id, kind, name, {
            protocol,
            metainfo: getNameValues(metainfo),
            target: targetInfo,
          })
        }
      )
    }

    function createRoute(path, service, ep, kind, cors) {
      if (!service) throw `Missing service name`
      var corsInfo = getNameValues(cors)
      if (corsInfo.allowOrigins) corsInfo.allowOrigins = corsInfo.allowOrigins.split(',').map(s => s.trim())
      if (corsInfo.allowMethods) corsInfo.allowMethods = corsInfo.allowMethods.split(',').map(s => s.trim())
      if (corsInfo.allowHeaders) corsInfo.allowHeaders = corsInfo.allowHeaders.split(',').map(s => s.trim())
      return findService(ep, kind, service).then(
        service => api.setRoute(endpoint.id, path, { service, cors: corsInfo })
      )
    }

    function deleteService(name, ep, kind) {
      return findService(ep, kind, name).then(s => (
        api.deleteService(s.endpoint.id, s.kind, s.name)
      ))
    }

    function deleteRoute(path) {
      return api.deleteRoute(endpoint.id, path)
    }

    function validateObjectType(args, command) {
      var ot = args['<object type>']
      switch (ot) {
        case 'service':
        case 'services':
        case 'svc':
          return 'service'
        case 'route':
        case 'routes':
        case 'rt':
          return 'route'
        default: throw `Invalid object type '${ot}'. Type 'ztm llm ${command} for help.'`
      }
    }

    function findService(ep, kind, name) {
      return (ep ? findEndpoint(ep) : Promise.resolve(null)).then(
        ep => api.allServices().then(({ endpoints, services }) => {
          var list = services.filter(
            s => {
              if (kind && s.kind !== kind) return false
              if (name && s.name !== name) return false
              if (ep && ep.id !== s.endpoint.id) return false
              return true
            }
          )
          if (list.length === 0) throw `Service '${name}' not found`
          if (list.length > 1) throw `Ambiguous service '${name}'`
          var service = list[0]
          service.endpoint = endpoints[service.endpoint.id]
          return service
        })
      )
    }

    function getNameValues(pairs) {
      var obj = {}
      pairs?.forEach?.(ent => {
        var i = ent.indexOf('=')
        if (0 < i && i < ent.length - 1) {
          var k = ent.substring(0,i)
          var v = ent.substring(i+1)
          var path = k.split('.')
          var last = path.pop()
          ;[obj, ...path].reduce(
            (obj, key) => {
              var val = obj[key]
              if (typeof val !== 'undefined' && typeof val !== 'object') {
                throw `key '${key}' has conflict value types`
              } else if (typeof val !== 'object') {
                obj[key] = val = {}
              }
              return val
            }
          )[last] = v
        } else {
          throw `Invalid name=value pair '${ent}'`
        }
      })
      return obj
    }

    function breakArguments(str) {
      var terms = str.split(' ').reduce(
        (a, b) => {
          var last = a.pop()
          if (last && last.startsWith('"')) {
            a.push(`${last} ${b}`)
          } else {
            a.push(last, b)
          }
          if (b.endsWith('"')) a.push('')
          return a
        }, []
      )
      return terms.filter(t => t).map(
        term => {
          if (term.startsWith('"')) term = term.substring(1)
          if (term.endsWith('"')) term = term.substring(0, term.length - 1)
          return term
        }
      )
    }

    function printTable(data, columns, indent) {
      var head = ' '.repeat(indent || 0)
      var cols = Object.entries(columns)
      var colHeaders = cols.map(i => i[0])
      var colFormats = cols.map(i => i[1])
      var colSizes = colHeaders.map(name => name.length)
      var rows = data.map(row => colFormats.map(
        (format, i) => {
          var v = format(row).toString()
          colSizes[i] = Math.max(colSizes[i], v.length)
          return v
        }
      ))
      output(head)
      colHeaders.forEach((name, i) => output(name.padEnd(colSizes[i]) + '  '))
      output('\n')
      rows.forEach(row => {
        output(head)
        row.forEach((v, i) => output(v.padEnd(colSizes[i]) + '  '))
        output('\n')
      })
    }
  }
}

var objectTypeNotes = `
  Object Types:

    service  svc   A service object such as a LLM service or MCP server
    route    rt    A route that redirects HTTP requests to a service
`

var objectNameNotes = `
  Object Names:

    Service names can be ambiguous, in which case one can add options
    --ep and/or --kind to clarify further.

    Route names are also their paths.
`
