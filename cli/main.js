#!/usr/bin/env -S pipy --args

import options from './options.js'
import clients from './clients.js'
import help from './help.js'

//
// Options
//

var optionsVersion = {
  defaults: {
    '--json': false,
  },
  shorthands: {},
}

var optionsConfig = {
  defaults: {
    '--ca': '',
    '--agent': '',
  },
  shorthands: {},
}

var optionsCA = {
  defaults: {
    '--listen': '0.0.0.0:9999',
    '--database': '~/ztm-ca.db',
  },
  shorthands: {
    '-l': '--listen',
    '-d': '--database',
  },
}

var optionsHub = {
  defaults: {
    '--listen': '0.0.0.0:8888',
    '--ca': 'localhost:9999',
    '--name': [],
  },
  shorthands: {
    '-l': '--listen',
    '-n': '--name',
  },
}

var optionsAgent = {
  defaults: {
    '--listen': '127.0.0.1:7777',
    '--database': '~/ztm.db',
  },
  shorthands: {
    '-l': '--listen',
    '-d': '--database',
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

var optionsGetEP = {
  defaults: {
    '--mesh': '',
  },
  shorthands: {
    '-m': '--mesh',
  }
}

var optionsGet = {
  defaults: {
    '--mesh': '',
    '--endpoint': '',
  },
  shorthands: {
    '-m': '--mesh',
    '-e': '--endpoint',
    '--ep': '--endpoint',
  }
}

var optionsDelete = {
  defaults: {
    '--mesh': '',
    '--endpoint': '',
  },
  shorthands: {
    '-m': '--mesh',
    '-e': '--endpoint',
    '--ep': '--endpoint',
  }
}

var optionsService = {
  defaults: {
    '--mesh': '',
    '--endpoint': '',
    '--host': '',
    '--port': 0,
  },
  shorthands: {
    '-m': '--mesh',
    '-e': '--endpoint',
    '--ep': '--endpoint',
    '-h': '--host',
    '-p': '--port',
  },
}

var optionsPort = {
  defaults: {
    '--mesh': '',
    '--endpoint': '',
    '--service': '',
  },
  shorthands: {
    '-m': '--mesh',
    '-e': '--endpoint',
    '--ep': '--endpoint',
    '-s': '--service',
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
    help, version, config, log,
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

function readWord(argv, meaning, command) {
  var word = argv.shift()
  if (!word || word.startsWith('-')) return errorInput(`missing ${meaning}`, command)
  return word
}

function readOptionalWord(argv) {
  var word = argv[0]
  if (!word || word.startsWith('-')) return
  return argv.shift()
}

function readObjectType(argv, command) {
  var type = readWord(argv, 'object type', command)
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
    default: return errorInput(`unknown object type '${type}'`, command)
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

function checkPortNumber(v) {
  if (v === undefined) return v
  var n = Number.parseFloat(v)
  if (0 < n && n < 65536) return n
  throw `invalid port number '${v}'`
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
  } else if (typeof v === 'number') {
    return v
  }
  throw `missing option: ${name}. Type 'ztm help ${command}' for help.`
}

//
// Command: version
//

function version(argv) {
  try { var data = JSON.decode(pipy.load('version.json')) } catch {}
  var opts = parseOptions(optionsVersion, argv, 'version')
  var info = {
    ztm: data,
    pipy: pipy.version,
  }
  if (opts['--json']) {
    println(JSON.stringify(info))
  } else {
    println(`ZTM:`)
    println(`  Version : ${info.ztm?.version}`)
    println(`  Commit  : ${info.ztm?.commit}`)
    println(`  Date    : ${info.ztm?.date}`)
    println(`Pipy:`)
    println(`  Version : ${info.pipy?.version}`)
    println(`  Commit  : ${info.pipy?.commit}`)
    println(`  Date    : ${info.pipy?.date}`)
  }
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
  if (Object.values(conf).filter(i=>i).length === 0) {
    var c = clients.config()
    println('Current CA    :', c.ca)
    println('Current agent :', c.agent)
  } else {
    clients.config(conf)
  }
}

//
// Command: start
//

function start(argv) {
  var type = readObjectType(argv, 'start')
  switch (type) {
    case 'ca': return startCA(argv)
    case 'hub': return startHub(argv)
    case 'agent': return startAgent(argv)
    default: return errorObjectType(type, 'start')
  }
}

function startCA(argv) {
  var opts = parseOptions(optionsCA, argv, 'start ca')
  var optsChanged = (argv.length > 0)
  startService('ca', opts, optsChanged)
}

function startHub(argv) {
  var opts = parseOptions(optionsHub, argv, 'start hub')
  var optsChanged = (argv.length > 0)
  startService('hub', opts, optsChanged)
}

function startAgent(argv) {
  var opts = parseOptions(optionsAgent, argv, 'start agent')
  var optsChanged = (argv.length > 0)
  startService('agent', opts, optsChanged)
}

function startService(name, opts, optsChanged) {
  var args = []
  function append(k, v) {
    v = v.toString()
    if (v.startsWith('~/')) {
      v = os.home() + v.substring(1)
    }
    args.push(k)
    args.push(v)
  }
  Object.entries(opts).forEach(
    ([k, v]) => {
      if (k === 'args') return
      switch (typeof v) {
        case 'boolean':
          if (v) args.push(k)
          break
        case 'object':
          if (v instanceof Array) v.forEach(v => append(k, v))
          break
        default: append(k, v)
      }
    }
  )
  switch (os.platform) {
    case 'linux': return startServiceLinux(name, args, optsChanged)
    case 'darwin': return startServiceDarwin(name, args, optsChanged)
    default: throw `starting as service not supported on this platform`
  }
}

function stripIndentation(s) {
  var lines = s.split('\n')
  if (lines[0].trim() === '') lines.shift()
  var depth = lines[0].length - lines[0].trimStart().length
  return lines.map(l => l.substring(depth)).join('\n')
}

function startServiceLinux(name, args, optsChanged) {
  var program = os.abspath(pipy.exec(['sh', '-c', `command -v ${pipy.argv[0]}`]).toString().trim())
  var user = pipy.exec('whoami').toString().trim()
  var opts = args.map(
    arg => arg.startsWith('-') ? arg : `'${arg}'`
  ).join(' ')
  var filename = `/etc/systemd/system/ztm-${name}.service`
  var logdir = `/var/log/ztm`
  if (optsChanged || !os.stat(filename)) {
    os.write(filename, stripIndentation(`
      [Unit]
      Description = ztm ${name} service
      After = network.target

      [Service]
      ExecStart='${program}' run ${name} ${opts}
      ExecStop=/usr/bin/kill $MAINPID
      Restart=on-failure
      User=${user}
      LimitNOFILE=655360
      StandardOutput=append:${logdir}/${name}.log

      [Install]
      WantedBy = multi-user.target
    `))
    os.mkdir(logdir, { recursive: true })
    pipy.exec(`systemctl daemon-reload`)
  }
  pipy.exec(`systemctl restart ztm-${name}`)
}

function startServiceDarwin(name, args, optsChanged) {
  var program = os.abspath(pipy.exec(['sh', '-c', `command -v ${pipy.argv[0]}`]).toString().trim())
  var filename = `${os.home()}/Library/LaunchAgents/io.flomesh.ztm.${name}.plist`
  if (optsChanged || !os.stat(filename)) {
    os.write(filename, stripIndentation(`
      <?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
      <plist version="1.0">
      <dict>
        <key>Label</key>
        <string>io.flomesh.ztm.${name}</string>
        <key>ProgramArguments</key>
        <array>
          <string>${program}</string>
          <string>run</string>
          <string>${name}</string>
          ${args.map(arg => `<string>${arg}</string>`).join('')}
        </array>
        <key>RunAtLoad</key>
        <true/>
        <key>KeepAlive</key>
        <true/>
        <key>StandardOutPath</key>
        <string>/tmp/io.flomesh.ztm.${name}.log</string>
      </dict>
      </plist>
    `))
  }
  pipy.exec(`launchctl load ${filename}`)
}

//
// Command: stop
//

function stop(argv) {
  var type = readObjectType(argv, 'stop')
  switch (type) {
    case 'ca': return stopCA()
    case 'hub': return stopHub()
    case 'agent': return stopAgent()
    default: return errorObjectType(type, 'stop')
  }
}

function stopCA() {
  stopService('ca')
}

function stopHub() {
  stopService('hub')
}

function stopAgent() {
  stopService('agent')
}

function stopService(name) {
  switch (os.platform) {
    case 'linux': return pipy.exec(`systemctl stop ztm-${name}`)
    case 'darwin': return pipy.exec(`launchctl unload ${os.home()}/Library/LaunchAgents/io.flomesh.ztm.${name}.plist`)
    default: throw `service not started`
  }
}

//
// Command: run
//

function run(argv, program) {
  var type = readObjectType(argv, 'run')
  switch (type) {
    case 'ca': return runCA(argv, program)
    case 'hub': return runHub(argv, program)
    case 'agent': return runAgent(argv, program)
    default: return errorObjectType(type, 'run')
  }
}

function runCA(argv, program) {
  parseOptions(optionsCA, argv, 'run ca')
  exec([program, '--pipy', 'repo://ztm/ca', '--args', ...argv])
}

function runHub(argv, program) {
  parseOptions(optionsHub, argv, 'run ca')
  exec([program, '--pipy', 'repo://ztm/hub', '--args', ...argv])
}

function runAgent(argv, program) {
  parseOptions(optionsAgent, argv, 'run ca')
  exec([program, '--pipy', 'repo://ztm/agent', '--args', ...argv])
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
  var username = normalizeName(readWord(argv, 'username', 'invite'))
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
        privateKey: keyUser,
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
  var username = normalizeName(readWord(argv, 'username', 'evict'))
  var c = clients.ca()
  c.delete(`/api/certificates/${username}`).then(() => {
    pipy.exit(0)
  }).catch(error)
}

//
// Command: join
//

function join(argv) {
  var meshName = normalizeName(readWord(argv, 'mesh name', 'join'))
  var opts = parseOptions(optionsJoin, argv, 'join')
  var epName = normalizeName(requiredOption(opts, '--as', 'join'))
  var profilePathname = requiredOption(opts, '--permit', 'join')
  var permit = JSON.decode(os.read(profilePathname))
  if (!permit.ca) throw 'permit missing CA certificate'
  if (!permit.agent?.certificate) throw 'permit missing user certificate'
  if (!permit.agent?.privateKey) throw 'permit missing user key'
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
      privateKey: permit.agent.privateKey,
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
  var meshName = normalizeName(readWord(argv, 'mesh name', 'leave'))
  var c = clients.agent()
  c.delete(`/api/meshes/${meshName}`).then(() => {
    pipy.exit(0)
  }).catch(error)
}

//
// Command: get
//

function get(argv) {
  var type = readObjectType(argv, 'get')
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
  clients.agent().get('/api/meshes').then(ret => {
    printTable(
      JSON.decode(ret).filter(m => !meshName || m.name === meshName),
      {
        'NAME': m => m.name,
        'JOINED AS': m => m.agent.name,
        'USER': m => m.agent.username,
        'HUBS': m => m.bootstraps.join(','),
        'STATUS': m => m.connected ? 'Connected' : `ERROR: ${m.errors[0]?.message}`,
      }
    )
    pipy.exit(0)
  }).catch(error)
}

function getEndpoint(argv) {
  var epName = normalizeName(readOptionalWord(argv))
  var c = clients.agent()
  selectMesh(c, parseOptions(optionsGetEP, argv, 'get endpoint')).then(mesh => {
    return c.get(`/api/meshes/${mesh.name}/endpoints`)
  }).then(ret => {
    printTable(
      JSON.decode(ret).filter(ep => !epName || ep.name === epName),
      {
        'NAME': ep => ep.isLocal ? `${ep.name} (local)` : ep.name,
        'USER': ep => ep.username,
        'IP': ep => ep.ip,
        'PORT': ep => ep.port,
        'STATUS': ep => ep.online ? 'Online' : 'Offline',
      }
    )
    pipy.exit(0)
  }).catch(error)
}

function getService(argv) {
  var svcName = normalizeServiceName(readOptionalWord(argv))
  var opts = parseOptions(optionsGet, argv, 'get service')
  var epName = opts['--endpoint']
  var mesh = null
  var endp = null
  var c = clients.agent()
  selectMesh(c, opts).then(m => {
    mesh = m
    return epName ? selectEndpoint(c, opts, m) : null
  }).then(ep => {
    endp = ep
    return ep ? c.get(`/api/meshes/${mesh.name}/endpoints/${ep.id}/services`) : c.get(`/api/meshes/${mesh.name}/services`)
  }).then(ret => {
    var list = JSON.decode(ret)
    list.forEach(svc => svc.name = `${svc.protocol}/${svc.name}`)
    printTable(
      list.filter(svc => !svcName || svc.name === svcName),
      epName ? {
        'NAME': svc => svc.name,
        'ENDPOINT': () => endp.name,
        'HOST': svc => svc.host,
        'PORT': svc => svc.port,
      } : {
        'NAME': svc => svc.name,
        'ENDPOINTS': svc => svc.endpoints.length,
      }
    )
    pipy.exit(0)
  }).catch(error)
}

function getPort(argv) {
  var portName = normalizePortName(readOptionalWord(argv))
  var opts = parseOptions(optionsGet, argv, 'get port')
  var mesh = null
  var endp = null
  var c = clients.agent()
  selectMesh(c, opts).then(m => {
    mesh = m
    return selectEndpoint(c, opts, m)
  }).then(ep => {
    endp = ep
    return c.get(`/api/meshes/${mesh.name}/endpoints/${ep.id}/ports`)
  }).then(ret => {
    var list = JSON.decode(ret)
    list.forEach(p => p.name = `${p.listen.ip}/${p.protocol}/${p.listen.port}`)
    printTable(
      list.filter(p => !portName || p.name === portName),
      {
        'NAME': p => p.name,
        'ENDPOINT': () => endp.name,
        'SERVICE': p => p.target.endpoint ? `${p.protocol}/${p.target.service} @ ${p.target.endpoint}` : `${p.protocol}/${p.target.service}`,
      }
    )
    pipy.exit(0)
  }).catch(error)
}

//
// Command: describe
//

function describe(argv) {
  var type = readObjectType(argv, 'describe')
  switch (type) {
    case 'mesh': return describeMesh(argv)
    case 'endpoint': return describeEndpoint(argv)
    case 'service': return describeService(argv)
    case 'port': return describePort(argv)
    default: return errorObjectType(type, 'describe')
  }
}

function describeMesh(argv) {
  var meshName = normalizeName(readWord(argv, 'mesh name', 'describe mesh'))
  clients.agent().get(`/api/meshes/${meshName}`).then(ret => {
    var m = JSON.decode(ret)
    println(`Mesh: ${m.name}`)
    println(`Hubs:`)
    m.bootstraps.forEach(h => println(' ', h))
    println(`Agent:`)
    println(`  Endpoint ID: ${m.agent.id}`)
    println(`  Endpoint Name: ${m.agent.name}`)
    println(`  User Name: ${m.agent.username}`)
    println(`CA Certificate:`)
    println(m.ca)
    println(`User Certificate:`)
    println(m.agent.certificate)
    println(`Status:`, m.connected ? 'Connected' : 'Offline')
    if (m.errors.length > 0) {
      println(`Errors:`)
      m.errors.forEach(e => println(' ', e.time, e.message))
    }
    pipy.exit(0)
  }).catch(error)
}

function describeEndpoint(argv) {
  var epName = normalizeName(readOptionalWord(argv, 'endpoint name', 'describe endpoint'))
  var opts = parseOptions(optionsGetEP, argv, 'describe endpoint')
  var mesh = null
  var c = clients.agent()
  selectMesh(c, opts).then(m => {
    mesh = m
    return selectEndpoint(c, { '--endpoint': epName }, m)
  }).then(ep => {
    return c.get(`/api/meshes/${mesh.name}/endpoints/${ep.id}`)
  }).then(ret => {
    var ep = JSON.decode(ret)
    println(`Endpoint: ${ep.name}${ep.isLocal ? ' (local)' : ''}`)
    println(`ID: ${ep.id}`)
    println(`Username: ${ep.username}`)
    println(`Hubs:`)
    ep.hubs.forEach(h => println(' ', h))
    println(`IP: ${ep.ip}`)
    println(`Port: ${ep.port}`)
    println(`Heartbeat: ${new Date(ep.heartbeat).toUTCString()}`)
    println(`Status:`, ep.online ? 'Online' : 'Offline')
    pipy.exit(0)
  }).catch(error)
}

function describeService(argv) {
  var svcName = normalizeServiceName(readWord(argv, 'service name', 'describe service'))
  var opts = parseOptions(optionsGet, argv, 'describe service')
  var epName = opts['--endpoint']
  var mesh = null
  var endp = null
  var c = clients.agent()
  selectMesh(c, opts).then(m => {
    mesh = m
    return epName ? selectEndpoint(c, opts, m) : null
  }).then(ep => {
    endp = ep
    return ep ? c.get(`/api/meshes/${mesh.name}/endpoints/${ep.id}/services/${svcName}`) : c.get(`/api/meshes/${mesh.name}/services/${svcName}`)
  }).then(ret => {
    var svc = JSON.decode(ret)
    println(`Service: ${svc.protocol}/${svc.name}`)
    if (epName) {
      println(`Endpoint: ${endp.name}`)
      println(`Endpoint ID: ${endp.id}`)
      println(`Host: ${svc.host}`)
      println(`Port: ${svc.port}`)
    } else {
      println(`Providers:`)
      svc.endpoints.forEach(ep => {
        println(`  Endpoint: ${ep.name}${ep.isLocal ? ' (local)' : ''}`)
        println(`    ID: ${ep.id}`)
        println(`    Access: ${ep.users ? (ep.users.length > 0 ? ep.users.join(', ') : 'Private') : 'Public'}`)
      })
    }
    pipy.exit(0)
  }).catch(error)
}

function describePort(argv) {
  var portName = normalizePortName(readWord(argv), 'port name', 'describe port')
  var opts = parseOptions(optionsGet, argv, 'describe port')
  var mesh = null
  var endp = null
  var c = clients.agent()
  selectMesh(c, opts).then(m => {
    mesh = m
    return selectEndpoint(c, opts, m)
  }).then(ep => {
    endp = ep
    return c.get(`/api/meshes/${mesh.name}/endpoints/${ep.id}/ports/${portName}`)
  }).then(ret => {
    var p = JSON.decode(ret)
    println(`Port: ${p.listen.ip}/${p.protocol}/${p.listen.port}`)
    println(`Protocol: ${p.protocol}`)
    println(`Listen:`)
    println(`  IP: ${p.listen.ip}`)
    println(`  Port: ${p.listen.port}`)
    println(`Service: ${p.protocol}/${p.service}`)
    println(`Status:`, p.open ? 'Open' : 'Not open')
    if (p.error) println(`Error:`, p.error)
    pipy.exit(0)
  }).catch(error)
}

//
// Command: create
//

function create(argv) {
  var type = readObjectType(argv, 'create')
  switch (type) {
    case 'service': return createService(argv)
    case 'port': return createPort(argv)
    default: return errorObjectType(type, 'create')
  }
}

function createService(argv) {
  var svcName = normalizeServiceName(readWord(argv, 'service name', 'create service'))
  var opts = parseOptions(optionsService, argv, 'create service')
  var host = requiredOption(opts, '--host', 'create service')
  var port = checkPortNumber(requiredOption(opts, '--port', 'create service'))
  var mesh = null
  var c = clients.agent()
  selectMesh(c, opts).then(m => {
    mesh = m
    return selectEndpoint(c, opts, m)
  }).then(ep => {
    return c.post(
      `/api/meshes/${mesh.name}/endpoints/${ep.id}/services/${svcName}`,
      JSON.encode({
        host,
        port,
      })
    )
  }).then(() => {
    pipy.exit(0)
  }).catch(error)
}

function createPort(argv) {
  var portName = normalizePortName(readWord(argv, 'port name', 'create port'))
  var opts = parseOptions(optionsPort, argv, 'create port')
  var svcName = normalizeServiceName(requiredOption(opts, '--service', 'create port'))
  if (portName.split('/')[1] !== svcName.split('/')[0]) throw 'port/service protocol mismatch'
  var mesh = null
  var c = clients.agent()
  selectMesh(c, opts).then(m => {
    mesh = m
    return selectEndpoint(c, opts, m)
  }).then(ep => {
    return c.post(
      `/api/meshes/${mesh.name}/endpoints/${ep.id}/ports/${portName}`,
      JSON.encode({
        target: {
          service: svcName.split('/')[1],
        }
      })
    )
  }).then(() => {
    pipy.exit(0)
  }).catch(error)
}

//
// Command: delete
//

function deleteCmd(argv) {
  var type = readObjectType(argv, 'delete')
  switch (type) {
    case 'service': return deleteService(argv)
    case 'port': return deletePort(argv)
    default: return errorObjectType(type, 'delete')
  }
}

function deleteService(argv) {
  var svcName = normalizeServiceName(readWord(argv, 'service name', 'delete service'))
  var opts = parseOptions(optionsDelete, argv, 'delete service')
  var mesh = null
  var c = clients.agent()
  selectMesh(c, opts).then(m => {
    mesh = m
    return selectEndpoint(c, opts, m)
  }).then(ep => {
    return c.delete(`/api/meshes/${mesh.name}/endpoints/${ep.id}/services/${svcName}`)
  }).then(() => {
    pipy.exit(0)
  }).catch(error)
}

function deletePort(argv) {
  var portName = normalizePortName(readWord(argv, 'port name', 'delete port'))
  var opts = parseOptions(optionsDelete, argv, 'delete port')
  var mesh = null
  var c = clients.agent()
  selectMesh(c, opts).then(m => {
    mesh = m
    return selectEndpoint(c, opts, m)
  }).then(ep => {
    return c.delete(`/api/meshes/${mesh.name}/endpoints/${ep.id}/ports/${portName}`)
  }).then(() => {
    pipy.exit(0)
  }).catch(error)
}

function log(argv) {
  var epName = normalizeName(readOptionalWord(argv))
  var opts = parseOptions(optionsGetEP, argv, 'log')
  var mesh = null
  var c = clients.agent()
  selectMesh(c, opts).then(m => {
    mesh = m
    return selectEndpoint(c, { '--endpoint': epName }, m)
  }).then(ep => {
    return c.get(`/api/meshes/${mesh.name}/endpoints/${ep.id}/log`)
  }).then(ret => {
    JSON.decode(ret).forEach(l => {
      println(l.time, l.message)
    })
    pipy.exit(0)
  }).catch(error)
}

//
// Utilities
//

function selectMesh(client, opts) {
  var m = opts['--mesh']
  if (m) return client.get(`/api/meshes/${m}`).then(ret => JSON.decode(ret))
  return client.get('/api/meshes').then(
    ret => {
      var list = JSON.decode(ret)
      if (list.length === 1) return list[0]
      if (list.length === 0) throw `you haven't joined a mesh yet`
      throw `you've joined multiple meshes, pick a mesh with '--mesh' or '-m' option`
    }
  )
}

function selectEndpoint(client, opts, mesh) {
  var name = opts['--endpoint']
  if (name) {
    return client.get(`/api/meshes/${mesh.name}/endpoints`).then(ret => {
      var list = JSON.decode(ret)
      var ep = list.find(ep => ep.id === name)
      if (ep) return ep
      list = list.filter(ep => ep.name === name)
      if (list.length === 1) return list[0]
      if (list.length === 0) throw `endpoint '${name}' not found`
      throw `ambiguous endpoint name '${name}'`
    })
  } else {
    return client.get(`/api/meshes/${mesh.name}`).then(ret => {
      var id = JSON.decode(ret).agent.id
      return client.get(`/api/meshes/${mesh.name}/endpoints/${id}`)
    }).then(ret => JSON.decode(ret))
  }
}

function printTable(data, columns) {
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
  colHeaders.forEach((name, i) => print(name.padEnd(colSizes[i]), ' '))
  println()
  rows.forEach(row => {
    row.forEach((v, i) => print(v.padEnd(colSizes[i]), ' '))
    println()
  })
}
