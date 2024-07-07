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
      return [buffer, new StreamEnd]
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
          if (list.length === 0) throw `Endpoint '${name}' not found`
          throw `Ambiguous endpoint name '${name}'`
        })
      } else {
        return Promise.resolve(app.endpoint)
      }
    }

    function lookupEndpointNames(list) {
      return allEndpoints().then(endpoints => (
        list.map(id => {
          var ep = endpoints.find(ep => ep.id === id)
          return ep ? ep.name : id
        })
      ))
    }

    function lookupEndpointIDs(list) {
      return allEndpoints().then(endpoints => (
        list.flatMap(name => {
          if (endpoints.some(ep => ep.id === name)) return name
          var list = endpoints.filter(ep => ep.name === name)
          if (list.length === 1) return list[0].id
          if (list.length === 0) throw `Endpoint '${name}' not found`
          return list.map(ep => ep.id)
        })
      ))
    }

    try {
      return cmdline(['ztm tunnel', ...argv], {
        help: text => Promise.resolve(output(text + '\n')),
        commands: [

          {
            title: 'List objects of the specified type',
            usage: 'get <object type>',
            options: `
              --mesh  <name>  Specify a mesh by name
              --ep    <name>  Specify an endpoint by name or UUID
            `,
            action: (args) => {
              var ep = args['--ep']
              switch (validateObjectType(args, 'get')) {
                case 'inbound': return getInbound(ep)
                case 'outbound': return getOutbound(ep)
              }
            }
          },

          {
            title: 'Show detailed info of the specified object',
            usage: 'describe <object type> <object name>',
            options: `
              --mesh  <name>  Specify a mesh by name
              --ep    <name>  Specify an endpoint by name or UUID
            `,
            action: (args) => {
              var ep = args['--ep']
              var name = args['<object name>']
              switch (validateObjectType(args, 'describe')) {
                case 'inbound': return describeInbound(ep, name)
                case 'outbound': return describeOutbound(ep, name)
              }
            }
          },

          {
            title: 'Create an object of the specified type',
            usage: 'open <object type> <object name>',
            options: `
              --mesh      <name>            Specify a mesh by name
              --ep        <name>            Specify an endpoint by name or UUID

              For inbound end:

              --listen    <[ip:]port ...>   Set local ports to listen on
              --exit      <endpoint ...>    Select endpoints as the outbound end

              For outbound end:

              --target    <host:port ...>   Set targets to connect to
              --entrance  <endpoint ...>    Select endpoints as the inbound end
            `,
            action: (args) => {
              var ep = args['--ep']
              var name = args['<object name>']
              switch (validateObjectType(args, 'open')) {
                case 'inbound': return openInbound(ep, name, args['--listen'], args['--exit'])
                case 'outbound': return openOutbound(ep, name, args['--target'], args['--entrance'])
              }
            }
          },

          {
            title: 'Delete the specified object',
            usage: 'close <object type> <object name>',
            options: `
              --mesh  <name>  Specify a mesh by name
              --ep    <name>  Specify an endpoint by name or UUID
            `,
            action: (args) => {
              var ep = args['--ep']
              var name = args['<object name>']
              switch (validateObjectType(args, 'close')) {
                case 'inbound': return closeInbound(ep, name)
                case 'outbound': return closeOutbound(ep, name)
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

    function getInbound(epName) {
      return selectEndpoint(epName).then(ep =>
        api.allInbound(ep.id)
      ).then(list => (
        Promise.all(list.map(i =>
          lookupEndpointNames(i.exits || []).then(exits => ({
            ...i,
            exits,
          }))
        )).then(list =>
          printTable(list, {
            'NAME': i => `${i.protocol}/${i.name}`,
            'LISTENS': i => i.listens.map(l => `${l.ip}:${l.port}`).join(', '),
            'EXITS': i => i.exits.join(', '),
          })
        )
      ))
    }

    function getOutbound(epName) {
      return selectEndpoint(epName).then(ep =>
        api.allOutbound(ep.id)
      ).then(list => (
        Promise.all(list.map(o =>
          lookupEndpointNames(o.entrances || []).then(entrances => ({
            ...o,
            entrances,
          }))
        )).then(list =>
          printTable(list, {
            'NAME': o => `${o.protocol}/${o.name}`,
            'TARGETS': o => o.targets.map(t => `${t.host}:${t.port}`).join(', '),
            'ENTRANCES': o => o.entrances.join(', '),
          })
        )
      ))
    }

    function describeInbound(epName, tunnelName) {
      var obj = validateObjectName(tunnelName)
      return selectEndpoint(epName).then(ep =>
        api.getInbound(ep.id, obj.protocol, obj.name).then(obj => {
          if (!obj) return
          return lookupEndpointNames(obj.exits || []).then(exits => {
            output(`Inbound ${obj.protocol}/${obj.name}\n`)
            output(`Endpoint: ${ep.name} (${ep.id})`)
            output(`Listens:\n`)
            obj.listens.forEach(l => output(`  ${l.ip}:${l.port}\n`))
            output(`Exits:\n`)
            exits.forEach(e => output(`  ${e}\n`))
            if (exits.length === 0) output(`  (all endpoints)\n`)
          })
        })
      )
    }

    function describeOutbound(epName, tunnelName) {
      var obj = validateObjectName(tunnelName)
      return selectEndpoint(epName).then(ep =>
        api.getOutbound(ep.id, obj.protocol, obj.name).then(obj => {
          if (!obj) return
          return lookupEndpointNames(obj.entrances || []).then(entrances => {
            output(`Outbound ${obj.protocol}/${obj.name}\n`)
            output(`Endpoint: ${ep.name} (${ep.id})`)
            output(`Targets:\n`)
            obj.targets.forEach(t => output(`  ${t.host}:${t.port}\n`))
            output(`Entrances:\n`)
            entrances.forEach(e => output(`  ${e}\n`))
            if (entrances.length === 0) output(`  (all endpoints)\n`)
          })
        })
      )
    }

    function openInbound(epName, tunnelName, listens, exits) {
      var obj = validateObjectName(tunnelName)
      if (!listens || listens.length === 0) throw `Option '--listen' is required`
      listens = listens.map(l => validateHostPort(l)).map(({ host, port }) => ({ ip: host, port }))
      return lookupEndpointIDs(exits || []).then(
        exits => selectEndpoint(epName).then(
          ep => api.setInbound(ep.id, obj.protocol, obj.name, listens, exits)
        )
      )
    }

    function openOutbound(epName, tunnelName, targets, entrances) {
      var obj = validateObjectName(tunnelName)
      if (!targets || targets.length === 0) throw `Option '--target' is required`
      targets = targets.map(t => validateHostPort(t))
      return lookupEndpointIDs(entrances || []).then(
        entrances => selectEndpoint(epName).then(
          ep => api.setOutbound(ep.id, obj.protocol, obj.name, targets, entrances)
        )
      )
    }

    function closeInbound(epName, tunnelName) {
      var obj = validateObjectName(tunnelName)
      return selectEndpoint(epName).then(ep =>
        api.deleteInbound(ep.id, obj.protocol, obj.name)
      )
    }

    function closeOutbound(epName, tunnelName) {
      var obj = validateObjectName(tunnelName)
      return selectEndpoint(epName).then(ep =>
        api.deleteOutbound(ep.id, obj.protocol, obj.name)
      )
    }

    function validateObjectType(args, command) {
      var ot = args['<object type>']
      switch (ot) {
        case 'inbound':
        case 'in':
          return 'inbound'
        case 'outbound':
        case 'out':
          return 'outbound'
        default: throw `Invalid object type '${ot}'. Type 'ztm tunnel ${command} for help.'`
      }
    }

    function validateObjectName(name) {
      if (!name) return
      var segs = name.split('/')
      if (segs.length === 2) {
        var protocol = segs[0]
        if (protocol === 'tcp' || protocol === 'udp') {
          if (segs[1]) {
            return { protocol, name: segs[1] }
          }
        }
      }
      throw `Invalid inbound/outbound name '${name}'`
    }

    function validateHostPort(addr) {
      var i = addr.lastIndexOf(':')
      if (i >= 0) {
        var host = addr.substring(0,i)
        var port = addr.substring(i+1)
      } else {
        var host = ''
        var port = addr
      }
      port = Number.parseInt(port)
      if (Number.isNaN(port)) throw `Invalid port number in '${addr}'`
      if (!host) host = '127.0.0.1'
      return { host, port }
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
