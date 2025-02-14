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
      if (err.stack) {
        output(err.stack)
        output('\n')
      }
    }

    function flush() {
      return [buffer, new StreamEnd]
    }

    var endpoints = null

    function allEndpoints() {
      if (endpoints) return Promise.resolve(endpoints)
      return api.allEndpoints().then(list => (endpoints = list))
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
                case 'tunnel': return getTunnels()
                case 'inbound': return getInbound()
                case 'outbound': return getOutbound()
              }
            }
          },

          {
            title: 'Show detailed info of the specified object',
            usage: 'describe <object type> <object name>',
            notes: objectTypeNotes + objectNameNotes,
            action: (args) => {
              var name = args['<object name>']
              switch (validateObjectType(args, 'describe')) {
                case 'tunnel': return describeTunnel(name)
                case 'inbound': return describeInbound(name)
                case 'outbound': return describeOutbound(name)
              }
            }
          },

          {
            title: 'Create an object of the specified type',
            usage: 'open <object type> <object name>',
            options: `
              For inbound end:

              --listen    <[ip:]port ...>   Set local ports to listen on
              --exits     <endpoint ...>    Select endpoints as the outbound end

              For outbound end:

              --targets   <host:port ...>   Set targets to connect to
              --entrances <endpoint ...>    Select endpoints as the inbound end
              --users     <username ...>    Only allow specified users to connect if present
            `,
            notes: objectTypeNotes + objectNameNotes,
            action: (args) => {
              var name = args['<object name>']
              switch (validateObjectType(args, 'open')) {
                case 'inbound': return openInbound(name, args['--listen'], args['--exits'])
                case 'outbound': return openOutbound(name, args['--targets'], args['--entrances'], args['--users'])
              }
            }
          },

          {
            title: 'Delete the specified object',
            usage: 'close <object type> <object name>',
            notes: objectTypeNotes + objectNameNotes,
            action: (args) => {
              var name = args['<object name>']
              switch (validateObjectType(args, 'close')) {
                case 'inbound': return closeInbound(name)
                case 'outbound': return closeOutbound(name)
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

    function getTunnels() {
      var tcp = {}
      var udp = {}
      var tunnels = { tcp, udp }
      return api.allEndpoints().then(
        endpoints => Promise.all(endpoints.map(
          ep => api.allTunnels(ep.id).then(
            ret => {
              if (ret) {
                ret.inbound?.forEach?.(i => {
                  var list = (tunnels[i.protocol][i.name] ??= [])
                  list.push({
                    ep: ep.name,
                    in: i,
                  })
                })
                ret.outbound?.forEach?.(o => {
                  var list = (tunnels[o.protocol][o.name] ??= [])
                  list.push({
                    ep: ep.name,
                    out: o,
                  })
                })
              }
            }
          )
        ))
      ).then(() => {
        var list = [
          ...Object.keys(tcp).sort().map(name => ({ name: `tcp/${name}`, io: tcp[name] })),
          ...Object.keys(udp).sort().map(name => ({ name: `udp/${name}`, io: udp[name] })),
        ]
        printTable(list, {
          'NAME': r => r.name,
          'INBOUND': r => {
            var ib = r.io.filter(i => i.in)
            if (ib.length === 0) return '-'
            var i = ib[0]
            var l = i.in.listens.map(l => `${l.ip}:${l.port}`).join(', ')
            var s = `${i.ep} (${l})`
            if (ib.length > 1) s += ` + ${ib.length - 1} more`
            return s
          },
          'OUTBOUND': r => {
            var ob = r.io.filter(o => o.out)
            if (ob.length === 0) return '-'
            var o = ob[0]
            var t = o.out.targets.map(t => `${t.host}:${t.port}`).join(', ')
            var s = `${o.ep} (${t})`
            if (ob.length > 1) s += ` + ${ob.length - 1} more`
            return s
          },
        })
      })
    }

    function getInbound() {
      return api.allInbound(endpoint.id).then(list => (
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

    function getOutbound() {
      return api.allOutbound(endpoint.id).then(list => (
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

    function describeTunnel(tunnelName) {
      var obj = validateObjectName(tunnelName)
      var protocol = obj.protocol
      var name = obj.name
      var inbound = []
      var outbound = []
      return api.allEndpoints().then(
        endpoints => Promise.all(endpoints.map(
          ep => api.allTunnels(ep.id).then(
            ret => {
              if (ret) {
                ret.inbound?.forEach?.(i => {
                  if (i.protocol === protocol && i.name === name) {
                    inbound.push({ ep, in: i })
                  }
                })
                ret.outbound?.forEach?.(o => {
                  if (o.protocol === protocol && o.name === name) {
                    outbound.push({ ep, out: o })
                  }
                })
              }
            }
          )
        ))
      ).then(() => {
        output(`Tunnel: ${protocol}/${name}\n`)
        output(`Inbound:\n`)
        inbound.forEach(i => {
          output(`  Endpoint: ${i.ep.name} (${i.ep.id})\n`)
          output(`    Listens:\n`)
          i.in.listens.forEach(l => output(`      ${l.ip}:${l.port}\n`))
          output(`    Exits:\n`)
          i.in.exits.forEach(e => output(`      ${e}\n`))
          if (i.in.exits.length === 0) output(`      (all endpoints)\n`)
        })
        output(`Outbound:\n`)
        outbound.forEach(o => {
          output(`  Endpoint: ${o.ep.name} (${o.ep.id})\n`)
          output(`    Targets:\n`)
          o.out.targets.forEach(t => output(`      ${t.host}:${t.port}\n`))
          output(`    Entrances:\n`)
          o.out.entrances.forEach(e => output(`      ${e}\n`))
          if (o.out.entrances.length === 0) output(`      (all endpoints)\n`)
          output(`    Users:\n`)
          if (o.out.users && o.out.users.length > 0) {
            o.out.users.forEach(u => output(`      ${u}\n`))
          } else {
            output(`      (all users)\n`)
          }
        })
      })
    }

    function describeInbound(tunnelName) {
      var obj = validateObjectName(tunnelName)
      return api.getInbound(endpoint.id, obj.protocol, obj.name).then(obj => {
        if (!obj) return
        return lookupEndpointNames(obj.exits || []).then(exits => {
          output(`Inbound ${obj.protocol}/${obj.name}\n`)
          output(`Endpoint: ${endpoint.name} (${endpoint.id})\n`)
          output(`Listens:\n`)
          obj.listens.forEach(l => output(`  ${l.ip}:${l.port}\n`))
          output(`Exits:\n`)
          exits.forEach(e => output(`  ${e}\n`))
          if (exits.length === 0) output(`  (all endpoints)\n`)
        })
      })
    }

    function describeOutbound(tunnelName) {
      var obj = validateObjectName(tunnelName)
      return api.getOutbound(endpoint.id, obj.protocol, obj.name).then(obj => {
        if (!obj) return
        return lookupEndpointNames(obj.entrances || []).then(entrances => {
          output(`Outbound ${obj.protocol}/${obj.name}\n`)
          output(`Endpoint: ${endpoint.name} (${endpoint.id})\n`)
          output(`Targets:\n`)
          obj.targets.forEach(t => output(`  ${t.host}:${t.port}\n`))
          output(`Entrances:\n`)
          entrances.forEach(e => output(`  ${e}\n`))
          if (entrances.length === 0) output(`  (all endpoints)\n`)
          output(`Users:\n`)
          if (obj.users && obj.users.length > 0) {
            obj.users.forEach(u => output(`  ${u}\n`))
          } else {
            output(`  (all users)\n`)
          }
        })
      })
    }

    function openInbound(tunnelName, listens, exits) {
      var obj = validateObjectName(tunnelName)
      if (!listens || listens.length === 0) throw `Option '--listen' is required`
      listens = listens.map(l => validateHostPort(l)).map(({ host, port }) => ({ ip: host, port }))
      return lookupEndpointIDs(exits || []).then(
        exits => api.setInbound(endpoint.id, obj.protocol, obj.name, listens, exits)
      )
    }

    function openOutbound(tunnelName, targets, entrances, users) {
      var obj = validateObjectName(tunnelName)
      if (!targets || targets.length === 0) throw `Option '--target' is required`
      targets = targets.map(t => validateHostPort(t))
      return lookupEndpointIDs(entrances || []).then(
        entrances => api.setOutbound(endpoint.id, obj.protocol, obj.name, targets, entrances, users)
      )
    }

    function closeInbound(tunnelName) {
      var obj = validateObjectName(tunnelName)
      return api.deleteInbound(endpoint.id, obj.protocol, obj.name)
    }

    function closeOutbound(tunnelName) {
      var obj = validateObjectName(tunnelName)
      return api.deleteOutbound(endpoint.id, obj.protocol, obj.name)
    }

    function validateObjectType(args, command) {
      var ot = args['<object type>']
      switch (ot) {
        case 'tunnel':
        case 'tunnels':
        case 'tun':
          return 'tunnel'
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

var objectTypeNotes = `
  Object Types:

    tunnel   tun   A tunnel composed of inbound and outbound ends
    inbound  in    Inbound end of a tunnel
    outbound out   Outbound end of a tunnel
`

var objectNameNotes = `
  Object Names:

    tcp/<name>     Name for a TCP tunnel
    udp/<name>     Name for a UDP tunnel
`
