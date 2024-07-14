#!/usr/bin/env -S pipy --args

import db from './db.js'
import ca from './ca.js'
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
    '--agent': '',
  },
  shorthands: {},
}

var optionsHub = {
  defaults: {
    '--listen': '0.0.0.0:8888',
    '--database': '~/.ztm',
    '--name': [],
    '--permit': '',
  },
  shorthands: {
    '-l': '--listen',
    '-d': '--database',
    '-n': '--name',
    '-p': '--permit',
  },
}

var optionsAgent = {
  defaults: {
    '--listen': '127.0.0.1:7777',
    '--database': '~/.ztm',
  },
  shorthands: {
    '-l': '--listen',
    '-d': '--database',
  },
}

var optionsInvite = {
  defaults: {
    '--mesh': '',
    '--permit': '',
  },
  shorthands: {
    '-m': '--mesh',
    '-p': '--permit',
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

var optionsGetGlobal = {
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

var optionsDownloadFile = {
  defaults: {
    '--mesh': '',
    '--output': '-',
  },
  shorthands: {
    '-m': '--mesh',
    '-o': '--output',
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
    get, describe, download, erase, publish, unpublish,
    create, 'delete': deleteCmd,
  })[command]

  if (f) return f(argv, program)

  var c = clients.agent()
  var mesh = null

  var opts = options(argv, {
    defaults: { '--mesh': '' },
    shorthands: {},
    ignoreUnknown: true,
  })

  return selectMesh(c, opts).then(m => {
    mesh = m
    var appName = normalizeAppName(command)
    var ep = { id: m.agent.id }
    return selectApp(c, appName, m, ep)
  }).then(app => {
    return callApp(c.host(), mesh, app, argv)
  }).catch(error)
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
    case 'file':
    case 'files':
      return 'file'
    case 'app':
    case 'apps':
      return 'app'
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

function normalizeAppName(name) {
  if (!name) return
  var segs = name.split('/')
  if (segs.length > 2 ||
    (segs.length == 2 && (!segs[1] || !segs[1]))
  ) {
    return errorInput(`invalid app name '${name}'`)
  }
  var provider = segs[segs.length - 2]
  var app = segs[segs.length - 1]
  var i = app.indexOf('@')
  if (i >= 0) {
    var tag = app.substring(i+1)
    var app = app.substring(0,i)
  } else {
    tag = ''
  }
  if (!app) return errorInput(`invalid app name '${name}'`)
  return { provider, name: app, tag }
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
    agent: opts['--agent'],
  }
  if (Object.values(conf).filter(i=>i).length === 0) {
    var c = clients.config()
    println('Current agent:', c.agent)
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
    case 'hub': return startHub(argv)
    case 'agent': return startAgent(argv)
    case 'app': return startApp(argv)
    default: return errorObjectType(type, 'start')
  }
}

function startHub(argv) {
  var opts = parseOptions(optionsHub, argv, 'start hub')
  var optsChanged = (argv.length > 0)
  if (optsChanged || !hasService('hub')) {
    initHub(opts).then(
      () => {
        delete opts['--permit']
        startService('hub', opts, optsChanged)
      }
    )
  } else {
    delete opts['--permit']
    startService('hub', opts, optsChanged)
  }
}

function startAgent(argv) {
  var opts = parseOptions(optionsAgent, argv, 'start agent')
  var optsChanged = (argv.length > 0)
  startService('agent', opts, optsChanged)
}

function startApp(argv) {
  var c = clients.agent()
  parseApp(c, argv, 'start app').then(({ mesh, ep, provider, name }) => {
    return c.post(
      `/api/meshes/${mesh.name}/endpoints/${ep.id}/apps/${provider}/${name}`,
      JSON.encode({ isRunning: true })
    )
  }).then(() => {
    pipy.exit(0)
  }).catch(error)
}

function initHub(opts) {
  var dbPath = opts['--database'] || '~/.ztm'
  if (dbPath.startsWith('~/')) {
    dbPath = os.home() + dbPath.substring(1)
  }

  var names = opts['--name']
  if (names.length === 0) throw 'at least one --name option is required'

  try {
    dbPath = os.path.resolve(dbPath)
    var st = os.stat(dbPath)
    if (st) {
      if (!st.isDirectory()) {
        throw `directory path already exists as a regular file: ${dbPath}`
      }
    } else {
      os.mkdir(dbPath, { recursive: true })
    }

    db.open(os.path.join(dbPath, 'ztm-hub.db'))

  } catch (e) {
    if (e.stack) println(e.stack)
    println('ztm:', e.toString())
    pipy.exit(0)
  }

  var key = new crypto.PrivateKey({ type: 'rsa', bits: 2048 })
  var pkey = new crypto.PublicKey(key)

  return ca.init().then(
    () => Promise.all([
      ca.getCertificate('ca'),
      ca.signCertificate('root', pkey),
    ])
  ).then(([ca, root]) => {
    var permit = JSON.stringify({
      ca: ca.toPEM().toString(),
      agent: {
        certificate: root.toPEM().toString(),
        privateKey: key.toPEM().toString(),
      },
      bootstraps: names,
    })
    db.close()
    if (opts['--permit']) {
      var filename = os.path.resolve(opts['--permit'])
      try {
        os.write(filename, permit)
      } catch {
        return error(`cannot write to file: ${filename}`)
      }
      var dir = os.path.dirname(filename)
      var name = filename.substring(dir.length + 1)
      println()
      println(`A permit file is saved to ${filename}`)
      println()
      println(`To join the mesh on an endpoint:`)
      println()
      println(`  1. Send the file '${name}' to the endpoint`)
      println(`  2. Execute the following command on the endpoint:`)
      println()
      println(`       ztm join my-mesh --as my-first-ep --permit ${name}`)
      println()
    } else {
      println()
      println(`*****************************************************************`)
      println(`*                                                               *`)
      println(`* How to Join the Mesh                                          *`)
      println(`*                                                               *`)
      println(`* 1. Send the following to an endpoint in a file                *`)
      println(`* 2. Execute command 'ztm join' on the endpoint, e.g.:          *`)
      println(`*                                                               *`)
      println(`*      ztm join my-mesh --as my-first-ep --permit root.json     *`)
      println(`*                                                               *`)
      println(`*    Where 'root.json' is a file containing                     *`)
      println(`*    the following content                                      *`)
      println(`*                                                               *`)
      println(`*****************************************************************`)
      println()
      println(JSON.stringify(permit))
      println()
    }
  })
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

function getServiceFilename(name) {
  switch (os.platform) {
    case 'linux': return `/etc/systemd/system/ztm-${name}.service`
    case 'darwin': return `${os.home()}/Library/LaunchAgents/io.flomesh.ztm.${name}.plist`
    default: return ''
  }
}

function hasService(name) {
  var s = os.stat(getServiceFilename(name))
  return s && s.isFile()
}

function startServiceLinux(name, args, optsChanged) {
  var program = os.abspath(pipy.exec(['sh', '-c', `command -v ${pipy.argv[0]}`]).toString().trim())
  var user = pipy.exec('whoami').toString().trim()
  var opts = args.map(
    arg => arg.startsWith('-') ? arg : `'${arg}'`
  ).join(' ')
  var filename = getServiceFilename(name)
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
  var filename = getServiceFilename(name)
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
    case 'hub': return stopHub()
    case 'agent': return stopAgent()
    case 'app': return stopApp(argv)
    default: return errorObjectType(type, 'stop')
  }
}

function stopHub() {
  stopService('hub')
}

function stopAgent() {
  stopService('agent')
}

function stopApp(argv) {
  var c = clients.agent()
  parseApp(c, argv, 'start app').then(({ mesh, ep, provider, name }) => {
    return c.post(
      `/api/meshes/${mesh.name}/endpoints/${ep.id}/apps/${provider}/${name}`,
      JSON.encode({ isRunning: false })
    )
  }).then(() => {
    pipy.exit(0)
  }).catch(error)
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
    case 'hub': return runHub(argv, program)
    case 'agent': return runAgent(argv, program)
    default: return errorObjectType(type, 'run')
  }
}

function runHub(argv, program) {
  var opts = parseOptions(optionsHub, argv, 'run hub')
  initHub(opts).then(
    () => {
      delete opts.args
      delete opts['--permit']
      exec([program,
        '--pipy', 'repo://ztm/hub',
        '--args',
        '--database', opts['--database'],
        '--listen', opts['--listen'],
      ])
    }
  )
}

function runAgent(argv, program) {
  parseOptions(optionsAgent, argv, 'run agent')
  exec([program, '--pipy', 'repo://ztm/agent', '--args', ...argv])
}

function exec(argv) {
  var exitCode
  pipeline($=>$
    .onStart(new Data)
    .exec(argv, { stderr: true, onExit: code => void (exitCode = code) })
    .tee('-')
  ).spawn().then(() => pipy.exit(exitCode))
}

//
// Command: invite
//

function invite(argv) {
  var username = normalizeName(readWord(argv, 'username', 'invite'))
  var opts = parseOptions(optionsInvite, argv, 'invite')
  var mesh = null
  var ca = null
  var bootstraps = null
  var key = new crypto.PrivateKey({ type: 'rsa', bits: 2048 })
  var pkey = new crypto.PublicKey(key)
  var c = clients.agent()
  selectMesh(c, opts).then(m => {
    mesh = m
    return c.get(`/api/meshes/${mesh.name}`)
  }).then(ret => {
    var info = JSON.decode(ret)
    var user = info.agent.username
    if (user !== username && user !== 'root') return Promise.reject(`no privilege to invite ${username}`)
    ca = info.ca
    bootstraps = info.bootstraps
    return c.post(`/api/meshes/${mesh.name}/certificates/${username}`, pkey.toPEM())
  }).then(ret => {
    var permit = JSON.encode({
      ca,
      agent: {
        certificate: ret.toString(),
        privateKey: key.toPEM().toString(),
      },
      bootstraps,
    })
    var filename = opts['--permit']
    if (filename) {
      try {
        os.write(filename, permit)
      } catch {
        return Promise.reject(`cannot write to file: ${os.path.resolve(filename)}`)
      }
    } else {
      println(permit.toString())
    }
    pipy.exit(0)
  }).catch(error)
}

//
// Command: evict
//

function evict(argv) {
  error('not implemented yet')
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
    case 'file': return getFile(argv)
    case 'app': return getApp(argv)
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
  selectMesh(c, parseOptions(optionsGetGlobal, argv, 'get endpoint')).then(mesh => {
    return c.get(`/api/meshes/${mesh.name}/endpoints`)
  }).then(ret => {
    printTable(
      JSON.decode(ret).filter(ep => !epName || ep.name.index(epName) >= 0),
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

function getFile(argv) {
  var name = normalizeName(readOptionalWord(argv))
  var c = clients.agent()
  selectMesh(c, parseOptions(optionsGetGlobal, argv, 'get file')).then(mesh => {
    return c.get(`/api/meshes/${mesh.name}/files`)
  }).then(ret => {
    printTable(
      Object.entries(JSON.decode(ret)).filter(
        ([k, v]) => !name || k.indexOf(name) >= 0
      ).sort(
        (a, b) => {
          if (a[0] < b[0]) return -1
          if (a[0] > b[1]) return 1
          return 0
        }
      ),
      {
        'PATH': ([k]) => k,
        'SIZE': ([_, v]) => v.size,
        'TIME': ([_, v]) => new Date(v.time).toString(),
        'HASH': ([_, v]) => v.hash,
      }
    )
    pipy.exit(0)
  }).catch(error)
}

function getApp(argv) {
  var appName = normalizeAppName(readOptionalWord(argv))
  var opts = parseOptions(optionsGet, argv, 'get app')
  var epName = opts['--endpoint']
  var mesh = null
  var apps = null
  var endp = null
  var c = clients.agent()
  selectMesh(c, opts).then(m => {
    mesh = m
    return epName ? selectEndpoint(c, opts, m) : null
  }).then(ep => {
    endp = ep
    return c.get(`/api/meshes/${mesh.name}/apps`)
  }).then(ret => {
    apps = JSON.decode(ret)
    return c.get(`/api/meshes/${mesh.name}/endpoints/${endp ? endp.id : mesh.agent.id}/apps`)
  }).then(ret => {
    var list = JSON.decode(ret)
    apps.forEach(app => {
      if (!list.some(a => (
        a.provider === app.provider &&
        a.name === app.name &&
        a.tag === app.tag
      ))) list.push(app)
    })
    printTable(
      list.filter(
        app => {
          if (!appName) return true
          if (appName.name !== app.name) return false
          if (appName.tag && appName.tag !== app.tag) return false
          if (appName.provider && appName.provider !== app.provider) return false
          return true
        }
      ).map(
        app => ({ ...app, name: `${app.provider}/${app.name}` })
      ).sort(
        function (a, b) {
          if (a.name < b.name) return -1
          if (a.name > b.name) return 1
          if (a.tag < b.tag) return -1
          if (a.tag > b.tag) return 1
          return 0
        }
      ),
      {
        'NAME': app => app.name,
        'TAG': app => app.tag,
        'STATE': app => {
          var states = []
          if (app.isBuiltin) states.push('builtin')
          if (app.isDownloaded) states.push('downloaded')
          if (app.isPublished) states.push('published')
          if (app.isRunning) states.push('running')
          return states.join(', ')
        }
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
    case 'file': return describeFile(argv)
    case 'app': return describeApp(argv)
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
  var opts = parseOptions(optionsGetGlobal, argv, 'describe endpoint')
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

function describeFile(argv) {
  var path = os.path.normalize(readWord(argv, 'file name', 'describe file'))
  var opts = parseOptions(optionsGetGlobal, argv, 'describe file')
  var mesh = null
  var c = clients.agent()
  selectMesh(c, opts).then(m => {
    mesh = m
    return c.get(os.path.join(`/api/meshes/${mesh.name}/files/`, path))
  }).then(ret => {
    var file = JSON.decode(ret)
    return Promise.all(file.sources.map(
      id => c.get(`/api/meshes/${mesh.name}/endpoints/${id}`)
    )).then(ret => {
      var sources = ret.map(r => JSON.decode(r))
      println(`Path: ${path}`)
      println(`Size: ${file.size}`)
      println(`Time: ${new Date(file.time).toString()}`)
      println(`Hash: ${file.hash}`)
      println(`Sources:`)
      printTable(sources, {
        'ENDPOINT': ep => ep.name,
        'ENDPOINT ID': ep => ep.id,
      }, 2)
      pipy.exit(0)
    })
  }).catch(error)
}

function describeApp(argv) {
  var c = clients.agent()
  parseApp(c, argv, 'describe app').then(({ mesh, ep, provider, name }) => {
    return c.get(`/api/meshes/${mesh.name}/endpoints/${ep.id}/apps/${provider}/${name}`)
  }).then(ret => {
    var app = JSON.decode(ret)
    println(`App: ${app.name}`)
    println(`Tag: ${app.tag || '(untagged)'}`)
    println(`Provider: ${app.provider}`)
    println(`State:`)
    println(`  Builtin   : ${app.isBuiltin ? 'Yes' : 'No'}`)
    println(`  Downloaded: ${app.isDownloaded ? 'Yes' : 'No'}`)
    println(`  Published : ${app.isPublished ? 'Yes' : 'No'}`)
    println(`  Running   : ${app.isRunning ? 'Yes' : 'No'}`)
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
// Command: download
//

function download(argv) {
  var type = readObjectType(argv, 'download')
  switch (type) {
    case 'app': return downloadApp(argv)
    case 'file': return downloadFile(argv)
    default: return errorObjectType(type, 'download')
  }
}

function downloadApp(argv) {
  var c = clients.agent()
  parseApp(c, argv, 'download app').then(({ mesh, ep, provider, name }) => {
    return c.post(
      `/api/meshes/${mesh.name}/endpoints/${ep.id}/apps/${provider}/${name}`,
      JSON.encode({})
    )
  }).then(() => {
    pipy.exit(0)
  }).catch(error)
}

function downloadFile(argv) {
  var path = os.path.normalize(readWord(argv, 'file name', 'describe file'))
  var opts = parseOptions(optionsDownloadFile, argv, 'download file')
  var mesh = null
  var c = clients.agent()
  selectMesh(c, opts).then(m => {
    mesh = m
    return c.get(os.path.join(`/api/meshes/${mesh.name}/file-data/`, path))
  }).then(ret => {
    pipeline($=>$
      .onStart([ret, new StreamEnd])
      .tee(opts['--output'])
    ).spawn().then(() => {
      pipy.exit(0)
    })
  }).catch(error)
}

//
// Command: erase
//

function erase(argv) {
  var type = readObjectType(argv, 'erase')
  switch (type) {
    case 'app': return eraseApp(argv)
    default: return errorObjectType(type, 'erase')
  }
}

function eraseApp(argv) {
  var c = clients.agent()
  parseApp(c, argv, 'erase app').then(({ mesh, ep, provider, name }) => {
    return c.delete(`/api/meshes/${mesh.name}/endpoints/${ep.id}/apps/${provider}/${name}`)
  }).then(() => {
    pipy.exit(0)
  }).catch(error)
}

//
// Command: publish
//

function publish(argv) {
  var type = readObjectType(argv, 'publish')
  switch (type) {
    case 'app': return publishApp(argv)
    default: return errorObjectType(type, 'publish')
  }
}

function publishApp(argv) {
  var c = clients.agent()
  parseApp(c, argv, 'publish app').then(({ mesh, ep, provider, name }) => {
    return c.post(
      `/api/meshes/${mesh.name}/endpoints/${ep.id}/apps/${provider}/${name}`,
      JSON.encode({ isPublished: true })
    )
  }).then(() => {
    pipy.exit(0)
  }).catch(error)
}

//
// Command: unpublish
//

function unpublish(argv) {
  var type = readObjectType(argv, 'unpublish')
  switch (type) {
    case 'app': return unpublishApp(argv)
    default: return errorObjectType(type, 'unpublish')
  }
}

function unpublishApp(argv) {
  var c = clients.agent()
  parseApp(c, argv, 'unpublish app').then(({ mesh, ep, provider, name }) => {
    return c.post(
      `/api/meshes/${mesh.name}/endpoints/${ep.id}/apps/${provider}/${name}`,
      JSON.encode({ isPublished: false })
    )
  }).then(() => {
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

//
// Command: log
//

function log(argv) {
  var type = readObjectType(argv, 'log')
  switch (type) {
    case 'endpoint': return logEndpoint(argv)
    case 'app': return logApp(argv)
    default: return errorObjectType(type, 'log')
  }
}

function logEndpoint(argv) {
  var epName = normalizeName(readOptionalWord(argv))
  var opts = parseOptions(optionsGetGlobal, argv, 'log')
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

function logApp(argv) {
  var c = clients.agent()
  parseApp(c, argv, 'log app').then(({ mesh, ep, provider, name }) => {
    return c.get(`/api/meshes/${mesh.name}/endpoints/${ep.id}/apps/${provider}/${name}/log`)
  }).then(ret => {
    JSON.decode(ret).forEach(l => {
      println(l.time, l.message)
    })
    pipy.exit(0)
  }).catch(error)
}

//
// Access app CLI
//

function callApp(host, mesh, app, argv) {
  var appname = app.name
  if (app.tag) appname += '@' + app.tag

  var url = `/api/meshes/${mesh.name}/apps/${app.provider}/${appname}/cli`
  url += '?argv=' + URL.encodeComponent(JSON.stringify(argv))

  return pipy.read('-', $=>$
    .onStart(new Data)
    .connectHTTPTunnel(
      new Message({
        method: 'CONNECT',
        path: url,
      })
    ).to($=>$
      .muxHTTP().to($=>$
        .connect(host)
      )
    )
    .tee('-')
  ).then(() => {
    pipy.exit(0)
  })
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

function selectApp(client, appName, mesh, ep) {
  var provider = appName.provider
  var name = appName.name
  var tag = appName.tag || ''
  function select(app) {
    if (provider && app.provider !== provider) return false
    return (app.name === name && (app.tag || '') === tag)
  }
  return client.get(`/api/meshes/${mesh.name}/endpoints/${ep.id}/apps`).then(ret => {
    var list = JSON.decode(ret).filter(select)
    if (list.length === 1) return { name, tag, provider: list[0].provider }
    if (list.length > 1) throw `ambiguous app name '${name}'`
    return client.get(`/api/meshes/${mesh.name}/apps`).then(ret => {
      var list = JSON.decode(ret).filter(select)
      if (list.length === 1) return { name, tag, provider: list[0].provider }
      if (list.length > 1) throw `ambiguous app name '${name}'`
    })
  })
}

function parseApp(client, argv, command) {
  var appName = normalizeAppName(readWord(argv, 'app name', command))
  var name = appName.tag ? `${appName.name}@${appName.tag}` : appName.name
  var opts = parseOptions(optionsGet, argv, command)
  var epName = opts['--endpoint']
  var mesh = null
  var endp = null
  return selectMesh(client, opts).then(m => {
    mesh = m
    return epName ? selectEndpoint(client, opts, m) : null
  }).then(ep => {
    endp = ep || { id: mesh.agent.id }
    return selectApp(client, appName, mesh, endp)
  }).then(app => {
    if (!app) throw `app '${name}' not found`
    return { mesh, ep: endp, provider: app.provider, name }
  })
}

function printTable(data, columns, indent) {
  var head = ' '.repeat(indent || 0)
  var cols = Object.entries(columns)
  var colHeaders = cols.map(i => i[0])
  var colFormats = cols.map(i => i[1])
  var colSizes = colHeaders.map(name => name.length)
  var rows = data.map(row => colFormats.map(
    (format, i) => {
      var v = (format(row) || '').toString()
      colSizes[i] = Math.max(colSizes[i], v.length)
      return v
    }
  ))
  print(head)
  colHeaders.forEach((name, i) => print(name.padEnd(colSizes[i]), ' '))
  println()
  rows.forEach(row => {
    print(head)
    row.forEach((v, i) => print(v.padEnd(colSizes[i]), ' '))
    println()
  })
}
