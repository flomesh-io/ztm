#!/usr/bin/env -S pipy --skip-redundant-arguments --skip-unknown-arguments

import options from './options.js'

function help() {
  println(`Usage: ztm <command> [<object type>] [<object name>] [<options>]`)
  println()
  println(`Commands:`)
  println(`  start     ca | hub | agent`)
  println(`  stop      ca | hub | agent`)
  println(`  run       ca | hub | agent`)
  println(`  invite`)
  println(`  join`)
  println(`  leave`)
  println(`  get       service | port | endpoint | mesh`)
  println(`  describe  service | port | endpoint | mesh`)
  println(`  create    service | port`)
  println(`  delete    service | port`)
  println()
  println(`Object types:`)
  println(`  ca`)
  println(`  hub`)
  println(`  agent`)
  println(`  mesh      meshes`)
  println(`  endpoint  endpoints  ep`)
  println(`  service   services   svc`)
  println(`  port      ports`)
  println()
  println(`Service name:`)
  println(`  tcp/name`)
  println(`  udp/name`)
  println()
  println(`  e.g. 'tcp/my-fancy-service', 'udp/voice-chat-svc'`)
  println()
  println(`Port name:`)
  println(`  ip/tcp/port`)
  println(`  ip/udp/port`)
  println(`  localhost/tcp/port`)
  println(`  localhost/udp/port`)
  println(`  tcp/port`)
  println(`  udp/port`)
  println()
  println(`  e.g. '10.0.0.2/tcp/8080', 'localhost/udp/445', 'tcp/80'`)
  println()
  println(`Type 'ztm help <command> [<object name>]' for details.`)
  println()
}

var CommandError = (msg) => `${msg}. Type 'ztm help' for help.`
var InvalidObjectType = (type, command) => CommandError(`invalid object type '${type}' for command '${command}'`)

function readWord(argv, meaning) {
  var word = argv.shift()
  if (!word || word.startsWith('-')) throw CommandError(`missing ${meaning}`)
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
    default: throw CommandError(`unknown object type '${type}'`)
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
  throw CommandError(`invalid service name '${name}'`)
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
  throw CommandError(`invalid port name '${name}'`)
}

//
// Options
//

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
    '--listen': '0.0.0.0:8888',
    '--name': [],
    '--ca': 'localhost:9999',
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
    '--output': '',
    '--bootstrap': [],
  },
  shorthands: {
    '-o': '--output',
    '-b': '--bootstrap',
  },
}

var optionsJoin = {
  defaults: {
    '--profile': '',
  },
  shorthands: {
    '-p': '--profile',
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

function parseOptions(meta, argv, command) {
  try {
    return options([null, ...argv], meta)
  } catch (err) {
    throw `${err.toString()}. Type 'ztm help ${command}' for help.`
  }
}

//
// Main
//

try { main() } catch (err) {
  println('ztm:', err.toString())
  pipy.exit(-1)
}

function main() {
  var argv = [...pipy.argv]
  var program = argv.shift()
  var command = argv.shift()

  if (!command || command.startsWith('-')) throw CommandError(`missing command`)

  var f = ({
    help, start, stop, run, invite, join, leave,
    get, describe, create, 'delete': deleteCmd,
  })[command]

  if (!f) throw CommandError(`unknown command: '${command}'`)

  return f(argv, program)
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
    default: throw InvalidObjectType(type, 'start')
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
    default: throw InvalidObjectType(type, 'stop')
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
    default: throw InvalidObjectType(type, 'run')
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
  println(username, opts)
}

//
// Command: join
//

function join(argv) {
  var meshName = normalizeName(readWord(argv, 'mesh name'))
  var opts = parseOptions(optionsJoin, argv, 'invite')
  println(meshName, opts)
}

//
// Command: leave
//

function leave(argv) {
  var meshName = normalizeName(readWord(argv, 'mesh name'))
  println(meshName)
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
    default: throw InvalidObjectType(type, 'get')
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
    default: throw InvalidObjectType(type, 'describe')
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
    default: throw InvalidObjectType(type, 'create')
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
    default: throw InvalidObjectType(type, 'delete')
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
