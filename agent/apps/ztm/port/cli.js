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

    function lookupEndpointNames(list) {
      return Promise.all(list.map(id => api.allEndpoints(id))).then(
        endpoints => {
          endpoints = endpoints.flat()
          return list.map(id => {
            var ep = endpoints.find(ep => ep.id === id)
            return ep ? ep.name : id
          })
        }
      )
    }

    function lookupEndpointIDs(list) {
      return Promise.all(list.map(name => api.allEndpoints(name, name))).then(
        endpoints => {
          endpoints = endpoints.flat()
          var all = {}
          list.forEach(name => {
            if (endpoints.some(ep => ep.id === name)) return all[name] = true
            var list = endpoints.filter(ep => ep.name === name)
            if (list.length === 1) return all[list[0].id] = true
            if (list.length === 0) throw `Endpoint '${name}' not found`
            list.forEach(ep => all[ep.id] = true)
          })
          return Object.keys(all)
        }
      )
    }

    try {
      return utils.parseArgv(argv, {
        help: text => Promise.resolve(output(text + '\n')),
        notes: objectTypeNotes,
        commands: [

          {
            title: 'List objects of the specified type',
            usage: 'get <object type>',
            notes: objectTypeNotes,
            action: (args) => {
              switch (validateObjectType(args, 'get')) {
                case 'port': return getPorts()
                case 'acl': return getACL()
              }
            }
          },

          {
            title: 'Create or change an object of the specified type',
            usage: 'set <object type>',
            options: `
              For ports:

              --protocol  <tcp|udp>         Set protocol of the port (default = tcp)
              --listen    <[ip:]port>       Set local address to listen
              --via       <endpoint>        Set forwarding endpoint
              --target    <ip:port>         Set target address to connect to

              For ACL:

              --protocol  <tcp|udp>         Set protocol of the target (default = tcp)
              --address   <ip|cidr|regexp>  Set target address or address range
              --port      <number>          Set allowed port number (optional)
              --users     <username ...>    Set allowed users
            `,
            notes: objectTypeNotes,
            action: (args) => {
              var proto = validateProtocol(args['--protocol'])
              switch (validateObjectType(args, 'set')) {
                case 'port': return setPort(proto, args['--listen'], args['--via'], args['--target'])
                case 'acl': return setACL(proto, args['--address'], args['--port'], args['--users'])
              }
            }
          },

          {
            title: 'Delete the specified object',
            usage: 'delete <object type>',
            options: `
              For ports:

              --protocol  <tcp|udp>         Set protocol of the port (default = tcp)
              --listen    <[ip:]port>       Set local address to listen

              For ACL:

              --protocol  <tcp|udp>         Set protocol of the target (default = tcp)
              --address   <CIDR[:port]>     Set target address or address range
            `,
            notes: objectTypeNotes,
            action: (args) => {
              var proto = validateProtocol(args['--protocol'])
              switch (validateObjectType(args, 'delete')) {
                case 'port': return deletePort(proto, args['--listen'])
                case 'acl': return deleteACL(proto, args['--address'])
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

    function getPorts() {
      return api.allPorts(endpoint.id).then(list => (
        Promise.all(list.map(p =>
          lookupEndpointNames([p.via]).then(([via]) => ({ ...p, via }))
        )).then(list =>
          printTable(list, {
            'PROTOCOL': p => p.protocol,
            'LISTEN': p => p.listen,
            'VIA': p => p.via,
            'TARGET': p => p.target,
            'STATUS': p => p.open ? 'open' : '',
            'ERROR': p => p.error || '',
          })
        )
      ))
    }

    function getACL() {
      return api.getConfig(endpoint.id).then(config => (
        printTable(config.acl || [], {
          'PROTOCOL': a => a.protocol,
          'ADDRESS': a => a.address,
          'PORT': a => a.port || '(all)',
          'USERS': a => (a.users || []).join(' '),
        })
      ))
    }

    function setPort(protocol, listen, via, target) {
      if (!listen) throw `Option '--listen' is required`
      if (!via) throw `Option '--via' is required`
      if (!target) throw `Options '--target' is required`
      listen = validateListen(listen)
      target = validateTarget(target)
      return lookupEndpointIDs([via]).then(
        ([via]) => {
          return api.getConfig(endpoint.id).then(
            config => {
              config.ports ??= []
              var p = config.ports.find(p => p.protocol === protocol && p.listen === listen)
              if (p) {
                p.via = via
                p.target = target
              } else {
                config.ports.push({ protocol, listen, via, target })
              }
              return api.setConfig(endpoint.id, config)
            }
          )
        }
      )
    }

    function setACL(protocol, address, port, users) {
      if (!address) throw `Option '--address' is required`
      if (!users || users.length === 0) throw `Option '--users' is required`
      address = validateAddressPattern(address)
      port = port && validatePort(port)
      return api.getConfig(endpoint.id).then(
        config => {
          config.acl ??= []
          var a = config.acl.find(p => p.protocol === protocol && p.address === address)
          if (a) {
            a.port = port
            a.users = users
          } else {
            config.acl.push({ protocol, address, port, users })
          }
          return api.setConfig(endpoint.id, config)
        }
      )
    }

    function deletePort(protocol, listen) {
      if (!listen) throw `Option '--listen' is required`
      listen = validateListen(listen)
      return api.getConfig(endpoint.id).then(
        config => {
          config.ports = (config.ports || []).filter(
            p => p.protocol !== protocol || p.listen !== listen
          )
          return api.setConfig(endpoint.id, config)
        }
      )
    }

    function deleteACL(protocol, address) {
      if (!address) throw `Option '--address' is required`
      address = validateAddressPattern(address)
      return api.getConfig(endpoint.id).then(
        config => {
          config.acl = (config.acl || []).filter(
            a => a.protocol !== protocol || a.address !== address
          )
          return api.setConfig(endpoint.id, config)
        }
      )
    }

    function validateObjectType(args, command) {
      var ot = args['<object type>']
      switch (ot) {
        case 'port':
        case 'ports':
          return 'port'
        case 'acl':
          return 'acl'
        default: throw `Invalid object type '${ot}'. Type 'ztm tunnel ${command} for help.'`
      }
    }

    function validateProtocol(proto) {
      if (!proto) return 'tcp'
      if (proto === 'tcp' || proto === 'udp') return proto
      throw `Invalid protocol '${proto}'`
    }

    function validateIP(ip) {
      try {
        new IP(ip)
        return ip
      } catch {
        throw `Invalid IP address '${ip}'`
      }
    }

    function validatePort(port) {
      port = Number.parseInt(port)
      if (Number.isNaN(port)) throw `Invalid port number '${port}'`
      return port
    }

    function validateListen(addr) {
      var i = addr.lastIndexOf(':')
      if (i >= 0) {
        var ip = addr.substring(0,i)
        var port = addr.substring(i+1)
      } else {
        var ip = ''
        var port = addr
      }
      port = validatePort(port)
      ip = ip ? validateIP(ip) : '127.0.0.1'
      return `${ip}:${port}`
    }

    function validateTarget(addr) {
      var i = addr.lastIndexOf(':')
      if (i >= 0) {
        var host = addr.substring(0,i)
        var port = addr.substring(i+1)
      } else {
        var host = ''
        var port = addr
      }
      port = validatePort(port)
      host = host || '127.0.0.1'
      return `${host}:${port}`
    }

    function validateAddressPattern(addr) {
      try {
        new IPMask(addr)
        return addr
      } catch {}
      try {
        new RegExp(addr)
        return addr
      } catch {}
      throw `Invalid IP/CIDR or regexp '${addr}'`
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

    port    Local port that maps to a remote target
    acl     Access control list for remote targets
`
