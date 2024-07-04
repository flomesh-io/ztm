import options from './options.js'

var optionsGet = {
  defaults: {
    '--mesh': '',
    '--endpoint': '',
  },
  shorthands: {
    '--ep': '--endpoint',
  }
}

var optionsInbound = {
  defaults: {
    ...optionsGet.defaults,
    '--listen': [],
    '--exit': [],
  },
  shorthands: {
    ...optionsGet.shorthands,
    '-l': '--listen',
    '-e': '--exit',
  }
}

var optionsOutbound = {
  defaults: {
    ...optionsGet.defaults,
    '--target': [],
    '--entrance': [],
  },
  shorthands: {
    ...optionsGet.shorthands,
    '-t': '--target',
    '-e': '--entrance',
  }
}

export default function ({ api, app, mesh }) {
  var $argv

  return pipeline($=>$
    .onStart(argv => void ($argv = argv))
    .replaceStreamStart(
      function () {
        var buffer = new Data
        var output = str => buffer.push(str)
        return (
          exec($argv, output).then(
            [buffer, new StreamEnd]
          ).catch(err => {
            output('ztm: ')
            output(err.message || err.toString())
            output('\n')
            return [buffer, new StreamEnd]
          })
        )
      }
    )
  )

  function exec(argv, output) {
    var endpoints = null

    try {
      var command = readWord(argv, 'command')

      var func = ({
        get, describe, open, close,
      })[command]

      if (!func) throw `invalid command '${command}'`

      return func(argv)

    } catch (err) {
      return Promise.reject(err)
    }

    function get(argv) {
      var type = readObjectType(argv, 'get')
      switch (type) {
        case 'inbound': return getInbound(argv)
        case 'outbound': return getOutbound(argv)
        default: return errorObjectType(type, 'get')
      }
    }

    function describe(argv) {
      var type = readObjectType(argv, 'get')
      switch (type) {
        case 'inbound': return describeInbound(argv)
        case 'outbound': return describeOutbound(argv)
        default: return errorObjectType(type, 'get')
      }
    }

    function open(argv) {
      var type = readObjectType(argv, 'get')
      switch (type) {
        case 'inbound': return openInbound(argv)
        case 'outbound': return openOutbound(argv)
        default: return errorObjectType(type, 'get')
      }
    }

    function close(argv) {
      var type = readObjectType(argv, 'get')
      switch (type) {
        case 'inbound': return closeInbound(argv)
        case 'outbound': return closeOutbound(argv)
        default: return errorObjectType(type, 'get')
      }
    }

    function getInbound(argv) {
      var opts = parseOptions(optionsGet, argv, 'get inbound')
      return selectEndpoint(opts).then(ep =>
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

    function getOutbound(argv) {
      var opts = parseOptions(optionsGet, argv, 'get outbound')
      return selectEndpoint(opts).then(ep =>
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

    function describeInbound(argv) {
      var meta = validateName(readWord(argv, 'inbound name', 'describe inbound'))
      var opts = parseOptions(optionsGet, argv, 'describe inbound')
      return selectEndpoint(opts).then(ep =>
        api.getInbound(ep.id, meta.protocol, meta.name).then(obj => {
          if (!obj) return
          return lookupEndpointNames(obj.exits || []).then(exits => {
            output(`Inbound ${obj.protocol}/${obj.name}\n`)
            output(`Listens:\n`)
            obj.listens.forEach(l => output(`  ${l.ip}:${l.port}\n`))
            output(`Exits:\n`)
            exits.forEach(e => output(`  ${e}\n`))
            if (exits.length === 0) output(`  (all endpoints)\n`)
          })
        })
      )
    }

    function describeOutbound(argv) {
      var meta = validateName(readWord(argv, 'outbound name', 'describe outbound'))
      var opts = parseOptions(optionsGet, argv, 'describe outbound')
      return selectEndpoint(opts).then(ep =>
        api.getOutbound(ep.id, meta.protocol, meta.name).then(obj => {
          if (!obj) return
          return lookupEndpointNames(obj.entrances || []).then(entrances => {
            output(`Outbound ${obj.protocol}/${obj.name}\n`)
            output(`Targets:\n`)
            obj.targets.forEach(t => output(`  ${t.host}:${t.port}\n`))
            output(`Entrances:\n`)
            entrances.forEach(e => output(`  ${e}\n`))
            if (entrances.length === 0) output(`  (all endpoints)\n`)
          })
        })
      )
    }

    function openInbound(argv) {
      var meta = validateName(readWord(argv, 'inbound name', 'open inbound'))
      var opts = parseOptions(optionsInbound, argv, 'open inbound')
      var listens = opts['--listen']
      var exits = opts['--exit']
      if (listens.length === 0) return errorInput(`at least one '--listen' option required`)
      listens = listens.map(l => validateHostPort(l)).map(({ host, port }) => ({ ip: host, port }))
      return lookupEndpointIDs(exits).then(list => {
        exits = list
        return selectEndpoint(opts)
      }).then(ep =>
        api.setInbound(ep.id, meta.protocol, meta.name, listens, exits)
      )
    }

    function openOutbound(argv) {
      var meta = validateName(readWord(argv, 'outbound name', 'open outbound'))
      var opts = parseOptions(optionsOutbound, argv, 'open outbound')
      var targets = opts['--target']
      var entrances = opts['--entrance']
      if (targets.length === 0) return errorInput(`at least one '--target' option required`)
      targets = targets.map(t => validateHostPort(t))
      return lookupEndpointIDs(entrances).then(list => {
        entrances = list
        return selectEndpoint(opts)
      }).then(ep =>
        api.setOutbound(ep.id, meta.protocol, meta.name, targets, entrances)
      )
    }

    function closeInbound(argv) {
      var meta = validateName(readWord(argv, 'inbound name', 'close inbound'))
      var opts = parseOptions(optionsGet, argv, 'close inbound')
      return selectEndpoint(opts).then(ep =>
        api.deleteInbound(ep.id, meta.protocol, meta.name)
      )
    }

    function closeOutbound(argv) {
      var meta = validateName(readWord(argv, 'outbound name', 'close outbound'))
      var opts = parseOptions(optionsGet, argv, 'close outbound')
      return selectEndpoint(opts).then(ep =>
        api.deleteOutbound(ep.id, meta.protocol, meta.name)
      )
    }

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
          if (list.length === 0) throw `endpoint '${name}' not found`
          return list.map(ep => ep.id)
        })
      ))
    }

    function selectEndpoint(opts, endpoints) {
      var name = opts['--endpoint']
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

    function readWord(argv, meaning, command) {
      var word = argv.shift()
      if (!word || word.startsWith('-')) return errorUsage(`missing ${meaning}`, command)
      return word
    }

    function readObjectType(argv, command) {
      var type = readWord(argv, 'object type', command)
      switch (type) {
        case 'inbound':
        case 'in':
          return 'inbound'
        case 'outbound':
        case 'out':
          return 'outbound'
        default: return errorUsage(`unknown object type '${type}'`, command)
      }
    }

    function validateName(name) {
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
      return errorInput(`invalid inbound/outbound name '${name}'`)
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
      if (Number.isNaN(port)) return errorInput(`invalid port number in '${addr}'`)
      if (!host) host = '127.0.0.1'
      return { host, port }
    }

    function parseOptions(meta, argv, command) {
      try {
        return options([null, ...argv], meta)
      } catch (err) {
        throw `${err.toString()}. Type 'ztm pass help ${command}' for help.`
      }
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

    function errorInput(msg) {
      throw msg
    }

    function errorUsage(msg, command) {
      throw `${msg}. Type 'ztm pass ${command ? 'help ' + command : 'help'}' for help.`
    }

    function errorObjectType(type, command) {
      errorUsage(`invalid object type '${type}' for command '${command}'`, command)
    }
  }
}
