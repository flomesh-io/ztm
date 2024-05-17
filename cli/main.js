#!/usr/bin/env -S pipy --skip-redundant-arguments --skip-unknown-arguments

import options from './options.js'
import clients from './clients.js'
import help from './help.js'

//
// Options
//

var optionsConfig = {
  defaults: {
    '--ca': '',
    '--agent': '',
  },
  shorthands: {},
}

var optionsCA = {
  defaults: {
    '--database': '~/ztm-ca.db',
    '--listen': '0.0.0.0:9999',
  },
  shorthands: {
    '-d': '--database',
    '-l': '--listen',
  },
}

var optionsHub = {
  defaults: {
    '--ca': 'localhost:9999',
    '--listen': '0.0.0.0:8888',
    '--name': [],
  },
  shorthands: {
    '-l': '--listen',
    '-n': '--name',
  },
}

var optionsAgent = {
  defaults: {
    '--database': '~/ztm.db',
    '--listen': '127.0.0.1:7777',
  },
  shorthands: {
    '-d': '--database',
    '-l': '--listen',
  },
}

var optionsInvite = {
  defaults: {
    '--bootstrap': [],
    '--output': '',
  },
  shorthands: {
    '-b': '--bootstrap',
    '-o': '--output',
  },
}

var optionsJoin = {
  defaults: {
    '--as': '',
    '--permit': '',
  },
  shorthands: {
    '-a': '--as',
    '-p': '--permit',
  },
}

var optionsService = {
  defaults: {
    '--host': '',
    '--port': 0,
  },
  shorthands: {
    '-h': '--host',
    '-p': '--port',
  },
}

var optionsPort = {
  defaults: {
    '--service': '',
    '--endpoint': '',
  },
  shorthands: {
    '-s': '--service',
    '-e': '--endpoint',
    '--ep': '--endpoint',
  },
}

//
// Main
//

try { main() } catch (err) {
  error(err)
}

function main() {
  var argv = [...pipy.argv]
  var program = argv.shift()
  var command = argv.shift()

  if (!command || command.startsWith('-')) return errorInput(`missing command`)

  var f = ({
    help, config,
    start, stop, run, invite, evict, join, leave,
    get, describe, create, 'delete': deleteCmd,
  })[command]

  if (!f) return errorInput(`unknown command: '${command}'`)

  return f(argv, program)
}

//
// Errors
//

function error(err) {
  println('ztm:', err.message || err)
  pipy.exit(-1)
}

function errorInput(msg, command) {
  throw `${msg}. Type 'ztm ${command ? 'help ' + command : 'help'}' for help.`
}

function errorObjectType(type, command) {
  errorInput(`invalid object type '${type}' for command '${command}'`, command)
}

//
// Command parsing utilities
//

function readWord(argv, meaning) {
  var word = argv.shift()
  if (!word || word.startsWith('-')) return errorInput(`missing ${meaning}`)
  return word
}

function readOptionalWord(argv) {
  var word = argv[0]
  if (!word || word.startsWith('-')) return
  return argv.shift()
}

function readObjectType(argv) {
  var type = readWord(argv, 'object type')
  switch (type) {
    case 'ca':
    case 'hub':
    case 'agent':
      return type
    case 'mesh':
    case 'meshes':
      return 'mesh'
    case 'endpoint':
    case 'endpoints':
    case 'ep':
      return 'endpoint'
    case 'service':
    case 'services':
    case 'svc':
      return 'service'
    case 'port':
    case 'ports':
      return 'port'
    default: return errorInput(`unknown object type '${type}'`)
  }
}

function normalizeName(name) {
  if (!name) return
  if (name.indexOf('/') >= 0) throw `invalid character '/' in name '${name}'`
  return name
}

function normalizeServiceName(name) {
  if (!name) return
  var segs = name.split('/')
  if (segs.length === 2) {
    if (segs[0] === 'tcp' || segs[0] === 'udp') {
      return name
    }
  }
  return errorInput(`invalid service name '${name}'`)
}

function normalizePortName(name) {
  if (!name) return
  var segs = name.split('/')
  if (segs.length === 2) segs.unshift('0.0.0.0')
  if (segs.length === 3) {
    var ip = segs[0]
    if (ip === 'localhost') ip = '127.0.0.1'
    if (segs[1] === 'tcp' || segs[1] === 'udp') {
      var num = Number.parseInt(segs[2])
      if (0 < num && num < 65536) {
        try {
          ip = new IP(ip)
          return `${ip.toString()}/${segs[1]}/${num}`
        } catch {}
      }
    }
  }
  return errorInput(`invalid port name '${name}'`)
}

function parseOptions(meta, argv, command) {
  try {
    return options([null, ...argv], meta)
  } catch (err) {
    throw `${err.toString()}. Type 'ztm help ${command}' for help.`
  }
}

function requiredOption(opts, name, command) {
  var v = opts[name]
  if (v instanceof Array || typeof v === 'string') {
    if (v.length > 0) return v
  }
  throw `missing option: ${name}. Type 'ztm help ${command}' for help.`
}

//
// Command: config
//

function config(argv) {
  var opts = parseOptions(optionsConfig, argv, 'config')
  var conf = {
    ca: opts['--ca'],
    agent: opts['--agent'],
  }
  if (Object.values(conf).filter(i=>i).length === 0) return errorInput('missing options', 'config')
  clients.config(conf)
}

//
// Command: start
//

function start(argv, program) {
  var type = readObjectType(argv)
  switch (type) {
    case 'ca': return startCA(argv, program)
    case 'hub': return startHub(argv, program)
    case 'agent': return startAgent(argv, program)
    default: return errorObjectType(type, 'start')
  }
}

function startCA(argv, program) {
  var opts = parseOptions(optionsCA, argv, 'start ca')
  println(program, opts)
}

function startHub(argv, program) {
  var opts = parseOptions(optionsHub, argv, 'start hub')
  println(program, opts)
}

function startAgent(argv, program) {
  var opts = parseOptions(optionsAgent, argv, 'start agent')
  println(program, opts)
}

//
// Command: stop
//

function stop(argv) {
  var type = readObjectType(argv)
  switch (type) {
    case 'ca': return stopCA()
    case 'hub': return stopHub()
    case 'agent': return stopAgent()
    default: return errorObjectType(type, 'stop')
  }
}

function stopCA() {
}

function stopHub() {
}

function stopAgent() {
}

//
// Command: run
//

function run(argv, program) {
  var type = readObjectType(argv)
  switch (type) {
    case 'ca': return runCA(argv, program)
    case 'hub': return runHub(argv, program)
    case 'agent': return runAgent(argv, program)
    default: return errorObjectType(type, 'run')
  }
}

function runCA(argv, program) {
  parseOptions(optionsCA, argv, 'run ca')
  exec([program, 'repo://ztm/ca', '--args', ...argv])
}

function runHub(argv, program) {
  parseOptions(optionsHub, argv, 'run ca')
  exec([program, 'repo://ztm/hub', '--args', ...argv])
}

function runAgent(argv, program) {
  parseOptions(optionsAgent, argv, 'run ca')
  exec([program, 'repo://ztm/agent', '--args', ...argv])
}

function exec(argv) {
  var exitCode
  pipeline($=>$
    .onStart(new Data)
    .exec(argv, { stderr: true, onExit: code => exitCode = code })
    .tee('-')
  ).spawn().then(() => pipy.exit(exitCode))
}

//
// Command: invite
//

function invite(argv) {
  var username = normalizeName(readWord(argv, 'username'))
  var opts = parseOptions(optionsInvite, argv, 'invite')
  var bootstraps = requiredOption(opts, '--bootstrap', 'invite')
  var crtCA
  var crtUser
  var keyUser
  var c = clients.ca()
  c.get(`/api/certificates/ca`).then(ret => {
    crtCA = ret.toString()
    return c.post(`/api/certificates/${username}`, '')
  }).then(ret => {
    keyUser = ret.toString()
    return c.get(`/api/certificates/${username}`)
  }).then(ret => {
    crtUser = ret.toString()
    var json = JSON.stringify({
      ca: crtCA,
      agent: {
        certificate: crtUser,
        key: keyUser,
      },
      bootstraps,
    })
    var pathname = opts['--output']
    if (pathname) {
      try {
        os.write(pathname, json)
      } catch (err) {
        return GenericError(err)
      }
    } else {
      println(json)
    }
    pipy.exit(0)
  }).catch(error)
}

//
// Command: evict
//

function evict(argv) {
  var username = normalizeName(readWord(argv, 'username'))
  var c = clients.ca()
  c.delete(`/api/certificates/${username}`).then(() => {
    pipy.exit(0)
  }).catch(error)
}

//
// Command: join
//

function join(argv) {
  var meshName = normalizeName(readWord(argv, 'mesh name'))
  var opts = parseOptions(optionsJoin, argv, 'join')
  var epName = normalizeName(requiredOption(opts, '--as', 'join'))
  var profilePathname = requiredOption(opts, '--permit', 'join')
  var permit = JSON.decode(os.read(profilePathname))
  if (!permit.ca) throw 'permit missing CA certificate'
  if (!permit.agent?.certificate) throw 'permit missing user certificate'
  if (!permit.agent?.key) throw 'permit missing user key'
  if (!(permit.bootstraps instanceof Array)) throw 'permit missing bootstraps'
  if (permit.bootstraps.some(
    addr => {
      if (typeof addr !== 'string') return true
      var i = addr.lastIndexOf(':')
      if (i < 0) return true
      var n = Number.parseInt(addr.substring(i+1))
      if (0 < n && n < 65536) return false
      return true
    }
  )) throw 'invalid bootstrap address'
  var c = clients.agent()
  c.post(`/api/meshes/${meshName}`, JSON.encode({
    ca: permit.ca,
    agent: {
      name: epName,
      certificate: permit.agent.certificate,
      key: permit.agent.key,
    },
    bootstraps: permit.bootstraps,
  })).then(() => {
    pipy.exit(0)
  }).catch(error)
}

//
// Command: leave
//

function leave(argv) {
  var meshName = normalizeName(readWord(argv, 'mesh name'))
  var c = clients.agent()
  c.delete(`/api/meshes/${meshName}`).then(() => {
    pipy.exit(0)
  }).catch(error)
}

//
// Command: get
//

function get(argv) {
  var type = readObjectType(argv)
  switch (type) {
    case 'mesh': return getMesh(argv)
    case 'endpoint': return getEndpoint(argv)
    case 'service': return getService(argv)
    case 'port': return getPort(argv)
    default: return errorObjectType(type, 'get')
  }
}

function getMesh(argv) {
  var meshName = normalizeName(readOptionalWord(argv))
  println(meshName)
}

function getEndpoint(argv) {
  var epName = normalizeName(readOptionalWord(argv))
  println(epName)
}

function getService(argv) {
  var svcName = normalizeServiceName(readOptionalWord(argv))
  println(svcName)
}

function getPort(argv) {
  var portName = normalizePortName(readOptionalWord(argv))
  println(portName)
}

//
// Command: describe
//

function describe(argv) {
  var type = readObjectType(argv)
  switch (type) {
    case 'mesh': return describeMesh(argv)
    case 'endpoint': return describeEndpoint(argv)
    case 'service': return describeService(argv)
    case 'port': return describePort(argv)
    default: return errorObjectType(type, 'describe')
  }
}

function describeMesh(argv) {
  var meshName = normalizeName(readWord(argv))
  println(meshName)
}

function describeEndpoint(argv) {
  var epName = normalizeName(readWord(argv))
  println(epName)
}

function describeService(argv) {
  var svcName = normalizeServiceName(readWord(argv))
  println(svcName)
}

function describePort(argv) {
  var portName = normalizePortName(readWord(argv))
  println(portName)
}

//
// Command: create
//

function create(argv) {
  var type = readObjectType(argv)
  switch (type) {
    case 'service': return createService(argv)
    case 'port': return createPort(argv)
    default: return errorObjectType(type, 'create')
  }
}

function createService(argv) {
  var svcName = normalizeServiceName(readWord(argv, 'service name'))
  var opts = parseOptions(optionsService, argv, 'create service')
  println(svcName, opts)
}

function createPort(argv) {
  var portName = normalizePortName(readWord(argv, 'port name'))
  var opts = parseOptions(optionsPort, argv, 'create port')
  println(portName, opts)
}

//
// Command: delete
//

function deleteCmd(argv) {
  var type = readObjectType(argv)
  switch (type) {
    case 'service': return deleteService(argv)
    case 'port': return deletePort(argv)
    default: return errorObjectType(type, 'delete')
  }
}

function deleteService(argv) {
  var svcName = normalizeServiceName(readWord(argv, 'service name'))
  println(svcName)
}

function deletePort(argv) {
  var portName = normalizePortName(readWord(argv, 'port name'))
  println(portName)
}
