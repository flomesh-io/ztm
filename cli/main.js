#!/usr/bin/env -S pipy --args

import db from './db.js'
import ca from './ca.js'
import client from './client.js'
import cmdline from './cmdline.js'

try {
  var ztmVersion = JSON.decode(pipy.load('version.json'))
} catch {
  var ztmVersion = {}
}

//
// Main
//

try {
  main().then(
    () => exit(0)
  ).catch(error)
} catch (err) {
  error(err)
}

function error(err) {
  println('ztm:', err.message || err)
  if (err.stack) println(err.stack)
  exit(-1)
}

function exit(code) {
  pipy.exit(code)
}

function main() {
  var argv = [...pipy.argv]
  var program = argv.shift()

  var meshName
  var epName

  if (argv[0] === 'mesh') {
    argv.shift()
    meshName = argv.shift()
    if (!meshName) throw 'missing mesh name'

  } else if (argv[0] === 'endpoint' || argv[0] === 'ep') {
    argv.shift()
    epName = argv.shift()
    if (!epName) throw 'missing endpoint name'

    var i = epName.indexOf('/')
    if (i >= 0) {
      meshName = epName.substring(0, i) || undefined
      epName = epName.substring(i + 1)
    }

    if (!epName) throw 'missing endpoint name'
  }

  argv.unshift(program)
  return doCommand(meshName, epName, argv, program) || Promise.resolve()
}

function doCommand(meshName, epName, argv, program) {
  return cmdline(argv, {
    help: (text, cmd) => {
      if (!cmd) {
        println()
        println(`Usage:`)
        println()
        println(`  ztm <cmd> ...`)
        println(`  ztm <app> ...`)
        println()
        println(`  ztm ep [<mesh name>/]<endpoint name> <cmd> ...`)
        println(`  ztm ep [<mesh name>/]<endpoint name> <app> ...`)
        println()
        println(`  ztm mesh <mesh name> <cmd> ...`)
        println(`  ztm mesh <mesh name> <app> ...`)
      }
      println(text)
    },

    commands: [
      {
        title: `Print ZTM version information`,
        usage: 'version',
        options: `
          --json   Print version information in JSON format
        `,
        action: version,
      },

      {
        title: `View or set the configuration of ZTM command line tool`,
        usage: 'config',
        options: `
          --agent <host:port>   Set the access address and port to the agent
                                Can be overridden by environment variable 'ZTM_AGENT'
          --mesh  <name>        Set the default mesh to operate when not specified
                                Can be overridden by environment variable 'ZTM_MESH'
        `,
        notes: `Print the current configuration when no options are specified`,
        action: config,
      },

      {
        title: `Export or import the CA certificate`,
        usage: 'ca <import|export>',
        options: `
          -d, --data  <dir>       Specify the location of ZTM storage (default: ~/.ztm)
              --cert  <filename>  Specify the certificate file to import or export
              --key   <filename>  Specify the private key file to import or export
        `,
        action: (args) => {
          var op = args['<import|export>']
          var dataDir = args['--data']
          var crtPath = args['--cert']
          var keyPath = args['--key']
          if (!crtPath) throw 'missing option: --cert'
          if (!keyPath) throw 'missing option: --key'
          switch (op) {
            case 'import': return importCA(dataDir, crtPath, keyPath)
            case 'export': return exportCA(dataDir, crtPath, keyPath)
            default: throw 'invalid operation: ' + op
          }
        }
      },

      {
        title: `Generate a permit for the root user`,
        usage: 'root',
        options: `
          -d, --data  <dir>             Specify the location of ZTM storage (default: ~/.ztm)
          -n, --names <host:port ...>   Specify one or more hub addresses (host:port) that are accessible to agents
              --ca    <url>             Specify the location of an external CA service if any
        `,
        action: (args) => {
          var dataDir = args['--data']
          var names = args['--names']
          var caURL = args['--ca']
          return root(dataDir, caURL, names)
        }
      },

      {
        title: `Print the identity of the current running agent`,
        usage: 'identity',
        action: identity,
      },

      {
        title: `View or change labels of an endpoint`,
        usage: 'label',
        options: `
          --add     <label ...>  Add labels
          --delete  <label ...>  Delete labels
        `,
        action: (args) => {
          var add = args['--add'] || []
          var del = args['--delete'] || []
          return selectMeshEndpoint(meshName, epName).then(({ mesh, ep }) => label(mesh, ep, add, del))
        }
      },

      {
        title: `Start running a hub, agent or app as background service`,
        usage: 'start <object type> [app name]',
        options: `
          -d, --data          <dir>             Specify the location of ZTM storage (default: ~/.ztm)
                                                Only applicable to hubs and agents
          -l, --listen        <[ip:]port>       Specify the service listening port (default: 0.0.0.0:8888 for hubs, 127.0.0.1:7777 for agents)
                                                Only applicable to hubs and agents
          -n, --names         <host:port ...>   Specify one or more hub addresses (host:port) that are accessible to agents
                                                Only applicable to hubs
              --ca            <url>             Specify the location of an external CA service if any
                                                Only applicable to hubs

              --max-agents    <number>          Specify the maximum number of agents the hub can handle
                                                Only applicable to hubs
              --max-sessions  <number>          Specify the maximum number of forwarding sessions the hub can handle
                                                Only applicable to hubs
          -p, --permit        <pathname>        Specify an optional output filename for the root user's permit
                                                Only applicable to hubs
        ` + (ztmVersion.edition === 'Enterprise' ? `
              --bootstrap     <host:port ...>   Specify the bootstrap addresses of the hub cluster
                                                Only applicable to hubs
              --zone          <zone>            Specify the zone that the hub is deployed in
                                                Only applicable to hubs
        ` : ''),
        notes: `Available object types include: hub, agent, app`,
        action: (args) => {
          var type = args['<object type>']
          var name = args['[app name]']
          switch (type) {
            case 'hub': return startHub(args)
            case 'agent': return startAgent(args)
            case 'app': return selectMeshEndpoint(meshName, epName).then(({ mesh, ep }) => startApp(name, mesh, ep))
            default: return invalidObjectType(type, 'start')
          }
        }
      },

      {
        title: 'Stop running a hub, agent or app as background service',
        usage: 'stop <object type> [app name]',
        notes: `Available object types include: hub, agent, app`,
        action: (args) => {
          var type = args['<object type>']
          var name = args['[app name]']
          switch (type) {
            case 'hub': return stopHub(args)
            case 'agent': return stopAgent(args)
            case 'app': return selectMeshEndpoint(meshName, epName).then(({ mesh, ep }) => stopApp(name, mesh, ep))
            default: return invalidObjectType(type, 'stop')
          }
        }
      },

      {
        title: `Start running a hub or agent in foreground mode`,
        usage: 'run <object type>',
        options: `
          -d, --data          <dir>             Specify the location of ZTM storage (default: ~/.ztm)
          -l, --listen        <[ip:]port>       Specify the service listening port (default: 0.0.0.0:8888 for hubs, 127.0.0.1:7777 for agents)
          -n, --names         <host:port ...>   Specify one or more hub addresses (host:port) that are accessible to agents
                                                Only applicable to hubs
              --ca            <url>             Specify the location of an external CA service if any
                                                Only applicable to hubs
              --max-agents    <number>          Specify the maximum number of agents the hub can handle
                                                Only applicable to hubs
              --max-sessions  <number>          Specify the maximum number of forwarding sessions the hub can handle
                                                Only applicable to hubs
          -p, --permit        <pathname>        An optional output filename for generating the root user's permit when starting a hub
                                                Or an input filename to load the user permit when joining a mesh while starting an agent
              --join          <mesh>            If specified, join a mesh with the given name
                                                Only applicable to agents
              --join-as       <endpoint>        When joining a mesh, give the current endpoint a name
                                                Only applicable to agents
        ` + (ztmVersion.edition === 'Enterprise' ? `
              --bootstrap     <host:port ...>   Specify the bootstrap addresses of the hub cluster
                                                Only applicable to hubs
              --zone          <zone>            Specify the zone that the hub is deployed in
                                                Only applicable to hubs
        ` : ''),
        notes: `Available object types include: hub, agent`,
        action: (args) => {
          var type = args['<object type>']
          switch (type) {
            case 'hub': return runHub(args, program)
            case 'agent': return runAgent(args, program)
            default: return invalidObjectType(type, 'run')
          }
        }
      },

      {
        title: `Issue a permit to a user for joining the mesh`,
        usage: 'invite <username>',
        options: `
          -i, --identity <pathname>   Specify an input file to read the user identity from
                                      Use '-' to read from stdin
          -p, --permit   <pathname>   Specify an output file to write the user permit to
                                      Print the user permit to stdout if not specified
        `,
        action: (args) => selectMesh(meshName).then(
          mesh => invite(args['<username>'], args['--identity'], args['--permit'], mesh)
        ),
      },

      {
        title: `Revoke a permit and block the user from joining the mesh`,
        usage: 'evict <username>',
        action: (args) => selectMesh(meshName).then(mesh => evict(args['<username>'], mesh)),
      },

      {
        title: `Join a mesh`,
        usage: 'join <mesh name>',
        options: `
          --as          <ep name>    Specify an endpoint name seen by others within the mesh
          --permit, -p  <pathname>   Point to a permit file
        `,
        action: (args) => join(args['<mesh name>'], args['--as'], args['--permit']),
      },

      {
        title: `Leave a mesh`,
        usage: 'leave <mesh name>',
        action: (args) => leave(args['<mesh name>']),
      },

      {
        title: `Enable a mesh`,
        usage: 'enable <object type> <object name>',
        notes: `
          Available object types include:
            mesh
            app
        `,
        options: `
          -p, --permit  <pathname>  Specify a new permit to be used to join the mesh
                                    Only applicable when enabling a mesh
        `,
        action: (args) => {
          var type = args['<object type>']
          var name = args['<object name>']
          switch (type) {
            case 'mesh': return enableMesh(name, args['--permit'])
            case 'app': return selectMeshEndpoint(meshName, epName).then(({ mesh, ep }) => enableApp(name, mesh, ep))
            default: return invalidObjectType(type, 'enable')
          }
        }
      },

      {
        title: `Disable a mesh`,
        usage: 'disable <object type> <object name>',
        notes: `
          Available object types include:
            mesh
            app
        `,
        options: `
          --erase-permit  Erase the permit that was used to join the mesh
                          Only applicable when disabling a mesh
        `,
        action: (args) => {
          var type = args['<object type>']
          var name = args['<object name>']
          switch (type) {
            case 'mesh': return disableMesh(name, args['--erase-permit'])
            case 'app': return selectMeshEndpoint(meshName, epName).then(({ mesh, ep }) => disableApp(name, mesh, ep))
            default: return invalidObjectType(type, 'disable')
          }
        }
      },

      {
        title: `Attach to a specified hub`,
        usage: 'attach <hub name>',
        notes: `
          Only hubs in the current mesh can be attached.
          Type 'ztm get hub' to see the list of available hubs.
        `,
        action: (args) => selectMesh(meshName).then(mesh => attachHub(args['<hub name>'], mesh))
      },

      {
        title: `List objects of a certain type`,
        usage: 'get <object type> [object name]',
        options: `
          --hash  Show the hash of files
                  Only applicable when listing files
        `,
        notes: `
          Available object types include:
            mesh     meshes
            hub      hubs
            endpoint endpoints ep
            file     files
            app      apps
        `,
        action: (args) => {
          var type = args['<object type>']
          var name = args['[object name]']
          switch (type) {
            case 'mesh':
            case 'meshes':
              return getMesh(name)
            case 'hub':
            case 'hubs':
              return selectMesh(meshName).then(mesh => getHub(name, mesh))
            case 'endpoint':
            case 'endpoints':
            case 'ep':
              return selectMesh(meshName).then(mesh => getEndpoint(name, mesh))
            case 'file':
            case 'files':
              return selectMesh(meshName).then(mesh => getFile(name, mesh, args['--hash']))
            case 'app':
            case 'apps':
              return selectMeshEndpoint(meshName, epName).then(({ mesh, ep }) => getApp(name, mesh, ep))
            default: return invalidObjectType(type, 'get')
          }
        }
      },

      {
        title: `View detailed information about an object`,
        usage: 'describe <object type> <object name>',
        notes: `
          Available object types include:
            mesh
            hub
            endpoint ep
            file
            app
        `,
        action: (args) => {
          var type = args['<object type>']
          var name = args['<object name>']
          switch (type) {
            case 'mesh': return describeMesh(name)
            case 'hub': return selectMesh(meshName).then(mesh => describeHub(name, mesh))
            case 'endpoint': case 'ep': return selectMesh(meshName).then(mesh => describeEndpoint(name, mesh))
            case 'file': return selectMesh(meshName).then(mesh => describeFile(name, mesh))
            case 'app': return selectMeshEndpoint(meshName, epName).then(({ mesh, ep }) => describeApp(name, mesh, ep))
            default: return invalidObjectType(type, 'get')
          }
        }
      },

      {
        title: `Download an app or file from the mesh`,
        usage: 'download <object type> <object name>',
        notes: `Available object types include: file, app`,
        options: `
          -o, --output <pathname>   Output to the specified file (default: output to stdout)
                                    Only applicable when downloading a file
        `,
        action: (args) => {
          var type = args['<object type>']
          var name = args['<object name>']
          switch (type) {
            case 'app': return selectMeshEndpoint(meshName, epName).then(({ mesh, ep }) => downloadApp(name, mesh, ep))
            case 'file': return selectMesh(meshName).then(mesh => downloadFile(name, args['--output'], mesh))
            default: return invalidObjectType(type, 'download')
          }
        }
      },

      {
        title: `Erase a downloaded app or file`,
        usage: 'erase <object type> <object name>',
        notes: `Available object types include: file, app`,
        action: (args) => {
          var type = args['<object type>']
          var name = args['<object name>']
          switch (type) {
            case 'app': return selectMeshEndpoint(meshName, epName).then(({ mesh, ep }) => eraseApp(name, mesh, ep))
            case 'file': return selectMesh(meshName).then(mesh => eraseFile(name, mesh))
            default: return invalidObjectType(type, 'erase')
          }
        }
      },

      {
        title: `Publish an app or file to the mesh`,
        usage: 'publish <object type> <object name>',
        notes: `Available object types include: file, app`,
        options: `
          -i, --input <pathname>   Specify a local file containing the data to publish
                                   Use '-' to read data from stdin
                                   Only applicable when publishing a file
        `,
        action: (args) => {
          var type = args['<object type>']
          var name = args['<object name>']
          switch (type) {
            case 'app': return selectMeshEndpoint(meshName, epName).then(({ mesh, ep }) => publishApp(name, mesh, ep))
            case 'file': return selectMesh(meshName).then(mesh => publishFile(name, args['--input'], mesh))
            default: return invalidObjectType(type, 'publish')
          }
        }
      },

      {
        title: `Unpublish an app or file from the mesh`,
        usage: 'unpublish <object type> <object name>',
        notes: `Available object types include: file, app`,
        action: (args) => {
          var type = args['<object type>']
          var name = args['<object name>']
          switch (type) {
            case 'app': return selectMeshEndpoint(meshName, epName).then(({ mesh, ep }) => unpublishApp(name, mesh, ep))
            case 'file': return selectMesh(meshName).then(mesh => unpublishFile(name, mesh))
            default: return invalidObjectType(type, 'unpublish')
          }
        }
      },

      {
        title: `View logs from an app or endpoint`,
        usage: 'log <object type> [object name]',
        notes: `
          Available object types include:
            app
            endpoint ep
            hub
        `,
        action: (args) => {
          var type = args['<object type>']
          var name = args['[object name]']
          switch (type) {
            case 'app': return selectMeshEndpoint(meshName, epName).then(({ mesh, ep }) => logApp(name, mesh, ep))
            case 'endpoint': case 'ep': return selectMeshEndpoint(meshName, epName).then(({ mesh, ep }) => logEndpoint(name, mesh, ep))
            case 'hub': return selectMesh(meshName).then(mesh => logHub(name, mesh))
            default: return invalidObjectType(type, 'log')
          }
        }
      },

      {
        title: `View stats of endpoints`,
        usage: 'stats <object type> [object name]',
        notes: `
          Available object types include:
            endpoint ep
        `,
        action: (args) => {
          var type = args['<object type>']
          var name = args['[object name]']
          switch (type) {
            case 'endpoint': case 'ep':return selectMeshEndpoint(meshName, epName).then(({ mesh, ep }) => statsEndpoint(name, mesh, ep))
            default: return invalidObjectType(type, 'stats')
          }
        }
      },

      {
        title: `Send a ping to an endpoint`,
        usage: 'ping <object type> [object name]',
        notes: `
          Available object types include:
            endpoint ep
        `,
        action: (args) => {
          var type = args['<object type>']
          var name = args['[object name]']
          switch (type) {
            case 'endpoint': case 'ep':return selectMeshEndpoint(meshName, name).then(({ mesh, ep }) => pingEndpoint(mesh, ep))
            default: return invalidObjectType(type, 'ping')
          }
        }
      },
    ],
    fallback: (argv) => {
      if (argv.length === 0) throw `no command or app specified. Type 'ztm help' for help info.`
      return selectMeshEndpoint(meshName, epName).then(
        ({ mesh, ep }) => callApp(argv, mesh, ep)
      )
    }
  })
}

//
// Command: version
//

function version(args) {
  var info = {
    ztm: ztmVersion,
    pipy: pipy.version,
  }
  if (args['--json']) {
    println(JSON.stringify(info))
  } else {
    println(`ZTM:`)
    println(`  Edition: ${info.ztm?.edition}`)
    println(`  Tag    : ${info.ztm?.tag}`)
    println(`  Commit : ${info.ztm?.commit}`)
    println(`  Date   : ${info.ztm?.date}`)
    println(`Pipy:`)
    println(`  Tag    : ${info.pipy?.tag}`)
    println(`  Commit : ${info.pipy?.commit}`)
    println(`  Date   : ${info.pipy?.date}`)
  }
}

//
// Command: config
//

function config(args) {
  var conf = {
    agent: args['--agent'],
    mesh: args['--mesh'],
  }
  if (Object.values(conf).filter(i=>i).length === 0) {
    var c = client.config()
    println('Current agent:', c.agent)
    println('Default mesh:', c.mesh || '(none)')
  } else {
    client.config(conf)
  }
}

//
// Command: ca
//

function importCA(dataDir, crtPath, keyPath) {
  initHubDB(dataDir)

  try {
    var crt = new crypto.Certificate(os.read(crtPath))
  } catch {
    return error(`cannot read certificate from file: ${crtPath}`)
  }

  try {
    var key = new crypto.PrivateKey(os.read(keyPath))
  } catch {
    return error(`cannot read private key from file: ${keyPath}`)
  }

  db.setCert('ca', crt.toPEM().toString())
  db.setKey('ca', key.toPEM().toString())
}

function exportCA(dataDir, crtPath, keyPath) {
  initHubDB(dataDir)

  var crt = db.getCert('ca')
  var key = db.getKey('ca')

  if (!crt || !key) return error('CA certificate not found')

  try {
    os.write(crtPath, crt)
  } catch {
    return error(`cannot write to file: ${crtPath}`)
  }

  try {
    os.write(keyPath, key)
  } catch {
    return error(`cannot write to file: ${keyPath}`)
  }
}

//
// Command: root
//

function root(dataDir, caURL, names) {
  if (!names || names.length === 0) {
    throw 'at least one hub address (host:port) is required (with option --names)'
  }

  return generateRootPermit(dataDir, caURL, names).then(
    permit => println(permit)
  )
}

//
// Command: identity
//

function identity() {
  return client.get('/api/identity').then(
    ret => {
      var s = ret.toString()
      if (s.endsWith('\n')) {
        print(s)
      } else {
        println(s)
      }
    }
  )
}

//
// Command: label
//

function label(mesh, ep, add, del) {
  return client.get(`/api/meshes/${uri(mesh.name)}/endpoints/${ep.id}/labels`).then(ret => {
    var labels = JSON.decode(ret)
    if (add.length > 0 || del.length > 0) {
      del.forEach(label => labels = labels.filter(l => l !== label))
      add.forEach(label => {
        if (!labels.includes(label)) {
          labels.push(label)
        }
      })
      return client.post(`/api/meshes/${uri(mesh.name)}/endpoints/${ep.id}/labels`, JSON.encode(labels)).then(() => {
        labels.sort()
        labels.forEach(l => println(l))
      })
    } else {
      labels.sort()
      labels.forEach(l => println(l))
    }
  })
}

//
// Command: start
//

function startHub(args) {
  var opts = {
    '--data': args['--data'] || '~/.ztm',
    '--listen': args['--listen'] || '0.0.0.0:8888',
  }
  if ('--names' in args) opts['--names'] = args['--names']
  if ('--ca' in args) opts['--ca'] = args['--ca']
  if ('--bootstrap' in args) opts['--bootstrap'] = args['--bootstrap']
  if ('--zone' in args) opts['--zone'] = args['--zone']
  if ('--max-agents' in args) opts['--max-agents'] = args['--max-agents']
  if ('--max-sessions' in args) opts['--max-sessions'] = args['--max-sessions']
  var optsChanged = (
    ('--data' in args) ||
    ('--listen' in args) ||
    ('--names' in args) ||
    ('--ca' in args) ||
    ('--bootstrap' in args) ||
    ('--zone' in args) ||
    ('--max-agents' in args) ||
    ('--max-sessions' in args)
  )
  if (optsChanged || !hasService('hub')) {
    return initHub(args).then(
      () => {
        startService('hub', opts, optsChanged)
      }
    )
  } else {
    startService('hub', opts, optsChanged)
  }
}

function startAgent(args) {
  var opts = {
    '--data': args['--data'] || '~/.ztm',
    '--listen': args['--listen'] || '127.0.0.1:7777',
  }
  var optsChanged = (
    ('--data' in args) ||
    ('--listen' in args)
  )
  startService('agent', opts, optsChanged)
}

function startApp(name, mesh, ep) {
  var appName = normalizeAppName(name)
  if (!appName) throw 'missing app name'
  return selectApp(appName, mesh, ep).then(app => {
    if (!app) throw `app not found: ${name}`
    var provider = app.provider
    var name = app.tag ? `${app.name}@${app.tag}` : app.name
    return client.post(
      `/api/meshes/${uri(mesh.name)}/endpoints/${ep.id}/apps/${uri(provider)}/${uri(name)}`,
      JSON.encode({ isRunning: true })
    )
  })
}

function initHubDB(path) {
  var dbPath = path || '~/.ztm'
  if (dbPath.startsWith('~/')) {
    dbPath = os.home() + dbPath.substring(1)
  }

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
    exit(0)
  }
}

function initHub(args) {
  var names = args['--names'] || []
  if (names.length === 0) {
    throw 'at least one hub address (host:port) is required (with option --names)'
  }

  return generateRootPermit(args['--data'], args['--ca'], names).then(
    permit => {
      if (args['--permit']) {
        var filename = os.path.resolve(args['--permit'])
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
        println(permit)
        println()
      }
    }
  )
}

function generateRootPermit(dataDir, caURL, bootstraps) {
  initHubDB(dataDir)

  var key = new crypto.PrivateKey({ type: 'rsa', bits: 2048 })
  var pkey = new crypto.PublicKey(key)

  return ca.init(caURL).then(
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
      bootstraps,
    })
    db.close()
    return permit
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
          if (v instanceof Array) {
            args.push()
            v.forEach(v => append(k, v))
          }
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
        <key>SoftResourceLimits</key>
        <dict>
          <key>NumberOfFiles</key>
          <integer>10000</integer>
        </dict>
      </dict>
      </plist>
    `))
  }
  pipy.exec(`launchctl load ${filename}`)
}

//
// Command: stop
//

function stopHub() {
  stopService('hub')
}

function stopAgent() {
  stopService('agent')
}

function stopApp(name, mesh, ep) {
  var appName = normalizeAppName(name)
  if (!appName) throw 'missing app name'
  return selectApp(appName, mesh, ep).then(app => {
    if (!app) throw `app not found: ${name}`
    var provider = app.provider
    var name = app.tag ? `${app.name}@${app.tag}` : app.name
    return client.post(
      `/api/meshes/${uri(mesh.name)}/endpoints/${ep.id}/apps/${uri(provider)}/${uri(name)}`,
      JSON.encode({ isRunning: false })
    )
  })
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

function runHub(args, program) {
  return initHub(args).then(
    () => {
      var command = [program,
        '--pipy', 'repo://ztm/hub',
        '--args',
        '--data', args['--data'] || '~/.ztm',
        '--listen', args['--listen'] || '0.0.0.0:8888',
      ]
      if ('--names' in args) {
        command.push('--names')
        args['--names'].forEach(name => command.push(name))
      }
      if ('--bootstrap' in args) {
        command.push('--bootstrap')
        args['--bootstrap'].forEach(name => command.push(name))
      }
      if ('--ca' in args) command.push('--ca', args['--ca'])
      if ('--zone' in args) command.push('--zone', args['--zone'])
      if ('--max-agents' in args) command.push('--max-agents', args['--max-agents'])
      if ('--max-sessions' in args) command.push('--max-sessions', args['--max-sessions'])
      return exec(command)
    }
  )
}

function runAgent(args, program) {
  var cmd = [
    program,
    '--pipy', 'repo://ztm/agent',
    '--args',
    '--data', args['--data'] || '~/.ztm',
    '--listen', args['--listen'] || '127.0.0.1:7777',
  ]
  if ('--join' in args) cmd.push('--join', args['--join'])
  if ('--join-as' in args) cmd.push('--join-as', args['--join-as'])
  if ('--permit' in args) cmd.push('--permit', args['--permit'])
  return exec(cmd)
}

function exec(argv) {
  var exitCode
  return pipeline($=>$
    .onStart(new Data)
    .exec(argv, { stderr: true, onExit: code => void (exitCode = code) })
    .tee('-')
  ).spawn().then(() => exit(exitCode))
}

//
// Command: invite
//

function invite(name, identity, permit, mesh) {
  if (!mesh) throw `no mesh specified`
  if (!identity) throw `missing option --identity`
  var username = normalizeName(name)
  var data = new Data
  return pipy.read(identity, $=>$.handleData(d => data.push(d))).then(
    () => client.post(`/api/meshes/${uri(mesh.name)}/permits/${uri(username)}`, data).then(ret => {
      if (permit) {
        try {
          os.write(permit, ret)
        } catch {
          throw `cannot write to file: ${os.path.resolve(permit)}`
        }
      } else {
        println(ret.toString())
      }
    })
  )
}

//
// Command: evict
//

function evict(name, mesh) {
  if (!mesh) throw `no mesh specified`
  var username = normalizeName(name)
  return client.delete(`/api/meshes/${uri(mesh.name)}/users/${uri(username)}`).catch(
    err => Promise.reject(err.status === 404 ? `user '${username}' not found` : err)
  )
}

//
// Command: join
//

function join(name, epName, permitPathname) {
  var meshName = normalizeName(name)
  if (!epName) throw 'endpoint name not specified (with option --as)'
  if (!permitPathname) throw 'permit file not specified (with option --permit)'
  var permit = validatePermit(permitPathname)
  permit.agent.name = epName
  return client.post(`/api/meshes/${uri(meshName)}`, JSON.encode(permit))
}

//
// Command: leave
//

function leave(name) {
  var meshName = normalizeName(name)
  return client.delete(`/api/meshes/${uri(meshName)}`)
}

//
// Command: enable
//

function enableMesh(name, permitPathname) {
  var meshName = normalizeName(name)
  var path = `/api/meshes/${uri(meshName)}`
  return client.get(path).then(ret => {
    var permit = JSON.decode(ret)
    if (permitPathname) {
      var newPermit = validatePermit(permitPathname)
      permit.ca = newPermit.ca || permit.ca
      permit.agent.certificate = newPermit.agent.certificate || permit.agent.certificate
    }
    if (!permit.ca) throw `Missing CA certificate`
    if (!permit.agent.certificate) throw `Missing agent certificate`
    permit.agent.offline = false
    return client.post(path, JSON.encode(permit))
  })
}

function enableApp(name, mesh, ep) {
  var appName = normalizeAppName(name)
  if (!appName) throw 'missing app name'
  return selectApp(appName, mesh, ep).then(app => {
    if (!app) throw `app not found: ${name}`
    var provider = app.provider
    var name = app.tag ? `${app.name}@${app.tag}` : app.name
    return client.post(
      `/api/meshes/${uri(mesh.name)}/endpoints/${ep.id}/apps/${uri(provider)}/${uri(name)}`,
      JSON.encode({ isDisabled: false })
    )
  })
}

//
// Command: disable
//

function disableMesh(name, erasePermit) {
  var meshName = normalizeName(name)
  var path = `/api/meshes/${uri(meshName)}`
  return client.get(path).then(ret => {
    var permit = JSON.decode(ret)
    permit.agent.offline = true
    if (erasePermit) {
      permit.agent.certificate = ''
    }
    return client.post(path, JSON.encode(permit))
  })
}

function disableApp(name, mesh, ep) {
  var appName = normalizeAppName(name)
  if (!appName) throw 'missing app name'
  return selectApp(appName, mesh, ep).then(app => {
    if (!app) throw `app not found: ${name}`
    var provider = app.provider
    var name = app.tag ? `${app.name}@${app.tag}` : app.name
    return client.post(
      `/api/meshes/${uri(mesh.name)}/endpoints/${ep.id}/apps/${uri(provider)}/${uri(name)}`,
      JSON.encode({ isDisabled: true })
    )
  })
}

//
// Command: attach
//

function attachHub(name, mesh) {
  return selectHub(name, mesh).then(
    id => client.post(
      `/api/meshes/${uri(mesh.name)}/hubs/${id}`,
      JSON.encode({ connected: true })
    )
  )
}

//
// Command: get
//

function getMesh(name) {
  var meshName = normalizeName(name)
  return client.get('/api/meshes').then(ret => {
    printTable(
      JSON.decode(ret).filter(m => !meshName || m.name === meshName),
      {
        'NAME': m => m.name,
        'JOINED AS': m => m.agent.name,
        'USER': m => m.agent.username,
        'HUBS': m => m.bootstraps.join(','),
        'STATUS': m => {
          if (m.connected) return 'Connected'
          if (m.agent.offline) return 'Offline'
          return `ERROR: ${m.errors[0]?.message}`
        }
      }
    )
  })
}

function getHub(name, mesh) {
  return client.get(`/api/meshes/${uri(mesh.name)}/hubs`).then(ret => {
    var list = Object.entries(JSON.decode(ret))
    printTable(
      list.filter(([k, v]) => !name || k === name || v.some(s => s.indexOf(name) >= 0)),
      {
        'NAMES': ([_, v]) => v.ports.join(', '),
        'ZONE': ([_, v]) => v.zone,
        'ATTACHED': ([_, v]) => v.connected ? 'Yes' : '',
        'EDITION': ([_, v]) => v.version?.ztm?.edition || 'n/a',
        'VERSION': ([_, v]) => v.version?.ztm?.tag || 'n/a',
        'ID': ([k]) => k,
      }
    )
  })
}

function getEndpoint(name, mesh) {
  var keyword = normalizeName(name)
  var q = keyword ? '?keyword=' + uri(keyword) : ''
  return client.get(`/api/meshes/${uri(mesh.name)}/endpoints${q}`).then(ret => {
    printTable(
      JSON.decode(ret),
      {
        'NAME': ep => ep.isLocal ? `${ep.name} (local)` : ep.name,
        'USER': ep => ep.username,
        'IP': ep => ep.ip,
        'PORT': ep => ep.port,
        'STATUS': ep => ep.online ? 'Online' : 'Offline',
        'PING': ep => ep.ping ? ep.ping + 'ms' : 'n/a',
        'ID': ep => ep.id,
        'EDITION': ep => ep.agent?.version?.ztm?.edition || 'n/a',
        'VERSION': ep => ep.agent?.version?.ztm?.tag || 'n/a',
        'LABELS': ep => {
          var labels = ep.agent?.labels || []
          if (labels.length > 3) {
            labels.length = 3
            labels[3] = '...'
          }
          return labels.join(' ')
        }
      }
    )
  })
}

function getFile(name, mesh, showHash) {
  return client.get(`/api/meshes/${uri(mesh.name)}/files`).then(ret => {
    var files = JSON.decode(ret)
    printTable(
      Object.keys(files).filter(
        k => !name || k.indexOf(name) >= 0
      ).sort().map(k => [k, files[k]]),
      {
        'PATH': ([k]) => k,
        'SIZE': ([_, v]) => v.size,
        'TIME': ([_, v]) => new Date(v.time).toString(),
        'HASH': showHash ? ([_, v]) => v.hash : null,
      }
    )
  })
}

function getApp(name, mesh, ep) {
  var appName = normalizeAppName(name)
  var apps = null
  return client.get(`/api/meshes/${uri(mesh.name)}/apps`).then(ret => {
    apps = JSON.decode(ret)
    return client.get(`/api/meshes/${uri(mesh.name)}/endpoints/${ep.id}/apps`)
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
          if (app.isDisabled) states.push('disabled')
          if (app.isRunning) states.push('running')
          return states.join(', ')
        }
      }
    )
  })
}

//
// Command: describe
//

function describeMesh(name) {
  var meshName = normalizeName(name)
  return client.get(`/api/meshes/${uri(meshName)}`).then(ret => {
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
  }).catch(err => {
    throw (err.status === 404 ? `mesh '${meshName}' not found` : err)
  })
}

function describeHub(name, mesh) {
  return selectHub(name, mesh).then(
    id => client.get(`/api/meshes/${uri(mesh.name)}/hubs/${id}`)
  ).then(ret => {
    var hub = JSON.decode(ret)
    var cap = hub.capacity
    var use = hub.load
    println(`Hub: ${hub.id}`)
    println(`Zone: ${hub.zone || '(not set)'}`)
    println(`Ports:`)
    printTable(hub.ports, {
      'NAME': p => p.name,
      'STATUS': p => p.online ? 'Online' : 'Offline',
      'PING': p => typeof p.ping === 'number' ? p.ping + 'ms' : 'n/a',
    }, 2)
    if (hub.peers?.length > 0) {
      println(`Peers:`)
      printTable(hub.peers, {
        'ID': p => p.id,
        'ZONE': p => p.zone,
        'PORTS': p => p.ports.join(', '),
        'STATE': p => p.connected ? 'Connected' : 'No response',
      }, 2)
    } else {
      println(`Peers: (no peers)`)
    }
    println(`Load:`)
    println(`  Agents: ${use.agents}/${cap.agents}`)
    println(`  Sessions: ${use.sessions}/${cap.sessions}`)
    println(`Attached: ${hub.connected ? 'Yes' : 'No'}`)
    println(`Version:`)
    printTable([
      { name: 'ztm', version: hub?.version?.ztm },
      { name: 'pipy', version: hub?.version?.pipy },
    ], {
      '': r => r.name,
      'EDITION': r => r.version?.edition || 'n/a',
      'TAG': r => r.version?.tag || 'n/a',
      'COMMIT': r => r.version?.commit || 'n/a',
      'DATE': r => r.version?.date || 'n/a',
    }, 2)
  })
}

function describeEndpoint(name, mesh) {
  var epName = normalizeName(name)
  return selectEndpoint(epName, mesh).then(
    ep => client.get(`/api/meshes/${uri(mesh.name)}/endpoints/${ep.id}`)
  ).then(ret => {
    var ep = JSON.decode(ret)
    return Promise.all(
      ep.hubs.map(id => client.get(`/api/meshes/${uri(mesh.name)}/hubs/${id}`).then(
        data => {
          try {
            var info = JSON.decode(data)
          } catch {}
          return { id, ports: info?.ports || [] }
        }
      ))
    ).then(hubs => {
      println(`Endpoint: ${ep.name}${ep.isLocal ? ' (local)' : ''}`)
      println(`ID: ${ep.id}`)
      println(`Username: ${ep.username}`)
      println(`Hubs:`)
      hubs.forEach(h => println(' ', h.id, h.ports.map(p => p.name).join(', ')))
      println(`IP: ${ep.ip}`)
      println(`Port: ${ep.port}`)
      println(`Ping: ${ep.ping ? ep.ping + 'ms' : 'N/A'}`)
      println(`Status:`, ep.online ? 'Online' : 'Offline')
      println(`Labels:`, ep.agent?.labels?.length > 0 ? ep.agent?.labels.join(' ') : '(none)')
      println(`Version:`)
      printTable([
        { name: 'ztm', version: ep.agent?.version?.ztm },
        { name: 'pipy', version: ep.agent?.version?.pipy },
      ], {
        '': r => r.name,
        'EDITION': r => r.version?.edition || 'n/a',
        'TAG': r => r.version?.tag || 'n/a',
        'COMMIT': r => r.version?.commit || 'n/a',
        'DATE': r => r.version?.date || 'n/a',
      }, 2)
    })
  })
}

function describeFile(name, mesh) {
  var path = os.path.normalize(name)
  return client.get(os.path.join(`/api/meshes/${uri(mesh.name)}/files/`, path)).catch(
    err => Promise.reject(err.status === 404 ? `file not found: ${path}` : err)
  ).then(ret => {
    var file = JSON.decode(ret)
    return Promise.all(file.sources.map(
      id => client.get(`/api/meshes/${uri(mesh.name)}/endpoints/${id}`)
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
    })
  })
}

function describeApp(name, mesh, ep) {
  var appName = normalizeAppName(name)
  return selectApp(appName, mesh, ep).then(app => {
    if (!app) throw `app not found: ${name}`
    var provider = app.provider
    var tagname = app.tag ? `${app.name}@${app.tag}` : app.name
    return client.get(`/api/meshes/${uri(mesh.name)}/endpoints/${ep.id}/apps/${uri(provider)}/${uri(tagname)}`)
  }).then(ret => {
    var app = JSON.decode(ret)
    println(`App: ${app.name}`)
    println(`Tag: ${app.tag || '(untagged)'}`)
    println(`Provider: ${app.provider}`)
    println(`State:`)
    println(`  Builtin   : ${app.isBuiltin ? 'Yes' : 'No'}`)
    println(`  Downloaded: ${app.isDownloaded ? 'Yes' : 'No'}`)
    println(`  Published : ${app.isPublished ? 'Yes' : 'No'}`)
    println(`  Disabled  : ${app.isDisabled ? 'Yes' : 'No'}`)
    println(`  Running   : ${app.isRunning ? 'Yes' : 'No'}`)
  })
}

//
// Command: download
//

function downloadApp(name, mesh, ep) {
  var appName = normalizeAppName(name)
  if (!appName) throw 'missing app name'
  return selectApp(appName, mesh, ep).then(app => {
    if (!app) throw `app not found: ${name}`
    var provider = app.provider
    var tagname = app.tag ? `${app.name}@${app.tag}` : app.name
    return client.post(
      `/api/meshes/${uri(mesh.name)}/endpoints/${ep.id}/apps/${uri(provider)}/${uri(tagname)}`,
      JSON.encode({})
    )
  })
}

function downloadFile(name, output, mesh) {
  var path = os.path.normalize(name)
  return client.get(os.path.join(`/api/meshes/${uri(mesh.name)}/file-data/`, uri(path))).then(
    ret => pipeline($=>$
      .onStart([ret, new StreamEnd])
      .tee(output || '-')
    ).spawn()
  ).catch(
    err => Promise.reject(err.status === 404 ? `file not found: ${path}` : err)
  )
}

//
// Command: erase
//

function eraseApp(name, mesh, ep) {
  var appName = normalizeAppName(name)
  if (!appName) throw 'missing app name'
  return selectApp(appName, mesh, ep).then(app => {
    if (!app) throw `app not found: ${name}`
    var provider = app.provider
    var tagname = app.tag ? `${app.name}@${app.tag}` : app.name
    return client.delete(`/api/meshes/${uri(mesh.name)}/endpoints/${ep.id}/apps/${uri(provider)}/${uri(tagname)}`)
  })
}

function eraseFile(name, mesh) {
  var path = os.path.normalize(name)
  return client.delete(os.path.join(`/api/meshes/${uri(mesh.name)}/files/`, path)).catch(
    err => Promise.reject(err.status === 404 ? `file not found: ${path}` : err)
  )
}

//
// Command: publish
//

function publishApp(name, mesh, ep) {
  var appName = normalizeAppName(name)
  if (!appName) throw 'missing app name'
  return selectApp(appName, mesh, ep).then(app => {
    if (!app) throw `app not found: ${name}`
    var provider = app.provider
    var tagname = app.tag ? `${app.name}@${app.tag}` : app.name
    return client.post(
      `/api/meshes/${uri(mesh.name)}/endpoints/${ep.id}/apps/${uri(provider)}/${uri(tagname)}`,
      JSON.encode({ isPublished: true })
    )
  })
}

function publishFile(name, input, mesh) {
  if (!input) throw 'missing option --input'
  var path = os.path.normalize(name)
  var data = new Data
  return pipy.read(input, $=>$.handleData(d => data.push(d))).then(
    () => client.post(os.path.join(`/api/meshes/${uri(mesh.name)}/file-data/`, uri(path)), data)
  )
}

//
// Command: unpublish
//

function unpublishApp(name, mesh, ep) {
  var appName = normalizeAppName(name)
  if (!appName) throw 'missing app name'
  return selectApp(appName, mesh, ep).then(app => {
    if (!app) throw `app not found: ${name}`
    var provider = app.provider
    var tagname = app.tag ? `${app.name}@${app.tag}` : app.name
    return client.post(
      `/api/meshes/${uri(mesh.name)}/endpoints/${ep.id}/apps/${uri(provider)}/${uri(tagname)}`,
      JSON.encode({ isPublished: false })
    )
  })
}

function unpublishFile(name, mesh) {
  var path = os.path.normalize(name)
  return client.delete(os.path.join(`/api/meshes/${uri(mesh.name)}/file-data/`, uri(path))).catch(
    err => Promise.reject(err.status === 404 ? `file not found: ${path}` : err)
  )
}

//
// Command: log
//

function logApp(name, mesh, ep) {
  var appName = normalizeAppName(name)
  if (!appName) throw 'missing app name'
  return selectApp(appName, mesh, ep).then(app => {
    if (!app) throw `app not found: ${name}`
    var provider = app.provider
    var tagname = app.tag ? `${app.name}@${app.tag}` : app.name
    return client.get(`/api/meshes/${uri(mesh.name)}/endpoints/${ep.id}/apps/${uri(provider)}/${uri(tagname)}/log`)
  }).then(ret => {
    JSON.decode(ret).forEach(l => {
      println(l.time, l.message)
    })
  })
}

function logEndpoint(name, mesh, ep) {
  var epName = normalizeName(name)
  return (epName ? selectEndpoint(epName, mesh) : Promise.resolve(ep)).then(
    ep => client.get(`/api/meshes/${uri(mesh.name)}/endpoints/${ep.id}/log`)
  ).then(ret => {
    JSON.decode(ret).forEach(l => {
      println(l.time, l.message)
    })
  })
}

function logHub(name, mesh) {
  return selectHub(name, mesh).then(
    id => client.get(`/api/meshes/${uri(mesh.name)}/hubs/${id}/log`)
  ).then(ret => {
    JSON.decode(ret).forEach(l => {
      println(l.time, l.message)
    })
  })
}

//
// Command: stats
//

function statsEndpoint(name, mesh, ep) {
  return allEndpoints(mesh).then(endpoints => {
    if (name) {
      var epName = normalizeName(name)
      return selectEndpoint(epName, mesh).then(
        ep => client.get(`/api/meshes/${uri(mesh.name)}/stats/endpoints/${ep.id}`).then(
          ret => {
            var stats = JSON.decode(ret)
            var peers = stats.peers || {}
            var list = Object.entries(peers).map(([k, v]) => {
              var peer = endpoints[k]
              var name = peer?.name || k
              return {
                name,
                send: v.send || 0,
                recv: v.receive || 0,
              }
            })
            list.push({ name: '(All Peers)', send: stats.send || 0, recv: stats.receive || 0 })
            printTable(list, {
              'PEER': p => p.name,
              'SEND': p => (p.send / 1024).toFixed(3) + 'KB/s',
              'RECEIVE': p => (p.recv / 1024).toFixed(3) + 'KB/s',
            })
          }
        )
      )
    } else {
      return client.get(`/api/meshes/${uri(mesh.name)}/stats/endpoints`).then(
        ret => {
          var stats = JSON.decode(ret)
          var list = Object.entries(stats).map(([k, v]) => {
            var ep = endpoints[k]
            var name = ep?.name || k
            return {
              name,
              send: v.send || 0,
              recv: v.receive || 0,
            }
          })
          printTable(list, {
            'ENDPOINT': ep => ep.name,
            'SEND': ep => (ep.send / 1024).toFixed(3) + 'KB/s',
            'RECEIVE': ep => (ep.recv / 1024).toFixed(3) + 'KB/s',
          })
        }
      )
    }
  })
}

//
// Command: ping
//

function pingEndpoint(mesh, ep) {
  return client.get(`/api/meshes/${uri(mesh.name)}/ping/endpoints/${ep.id}`).then(
    ret => {
      printTable(JSON.decode(ret), {
        'ID': r => r.endpoint?.id || r.hub?.id || 'n/a',
        'TYPE': r => {
          if (r.endpoint) return 'Endpoint'
          if (r.hub) return 'Hub'
          return 'n/a'
        },
        'NAME': r => {
          if (r.endpoint) return r.endpoint.name
          if (r.hub) return r.hub.names.join(', ')
          return 'n/a'
        },
        'START': r => r.start ? new Date(r.start).toTimeString() : 'n/a',
        'END': r => r.end ? new Date(r.end).toTimeString() : 'n/a',
        'DURATION': r => {
          var d = r.end - r.start
          if (typeof d === 'number') return (d/1000) + 's'
          return 'n/a'
        },
        'ERROR': r => r.error || '',
      })
    }
  )
}

//
// Invoke app CLI
//

function callApp(argv, mesh, ep) {
  var name = argv.shift()
  var appName = normalizeAppName(name)
  return selectEndpoint('', mesh).then(
    local => selectApp(appName, mesh, local)
  ).then(app => {
    if (!app) throw `unknown command or app: ${name}`
    var tagname = app.name
    if (app.tag) tagname += '@' + app.tag

    var program = `ztm ${name}`
    var url = `/api/meshes/${uri(mesh.name)}/apps/${uri(app.provider)}/${uri(tagname)}/cli`
    url += '?argv=' + uri(JSON.stringify([program, ...argv]))
    url += '&cwd=' + uri(os.path.resolve())
    url += '&ep_id=' + ep.id
    url += '&ep_name=' + uri(ep.name)

    pipy.tty.raw = true

    return pipy.read('-', $=>$
      .onStart(new Data)
      .connectHTTPTunnel(
        new Message({
          method: 'CONNECT',
          path: url,
        })
      ).to($=>$
        .muxHTTP().to($=>$
          .connect(client.host(), { idleTimeout: 0 })
        )
      )
      .tee('-')
      .onEnd(() => { pipy.tty.raw = false })
    )
  })
}

//
// Utilities
//

function uri(s) {
  return URL.encodeComponent(s)
}

function invalidObjectType(type, command) {
  throw `invalid object type '${type}' for command '${command}'`
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
    throw `invalid app name '${name}'`
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
  if (!app) throw `invalid app name '${name}'`
  return { provider, name: app, tag }
}

function validatePermit(pathname) {
  var data = os.read(pathname)
  if (!data) throw `file not found: ${pathname}`
  try {
    var permit = JSON.decode(data)
  } catch {
    throw `invalid format of permit: ${pathname}`
  }
  if (!permit.ca) throw 'permit missing CA certificate'
  if (!permit.agent?.certificate) throw 'permit missing user certificate'
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
  var info = {
    ca: permit.ca,
    agent: {
      certificate: permit.agent.certificate,
      labels: permit.agent.labels || [],
    },
    bootstraps: permit.bootstraps,
  }
  if (permit.agent.privateKey) {
    info.agent.privateKey = permit.agent.privateKey
  }
  return info
}

function allEndpoints(mesh, keyword) {
  var q = keyword ? '?keyword=' + uri(keyword) : ''
  return client.get(`/api/meshes/${uri(mesh.name)}/endpoints${q}`).then(ret => {
    var endpoints = {}
    JSON.decode(ret).forEach(ep => endpoints[ep.id] = ep)
    return endpoints
  })
}

function selectMesh(name) {
  if (name) return client.get(`/api/meshes/${uri(name)}`)
    .then(ret => JSON.decode(ret))
    .catch(err => Promise.reject(err.status === 404 ? `mesh '${name}' not found` : err))
  return client.get('/api/meshes').then(
    ret => {
      var list = JSON.decode(ret)
      if (list.length === 1) return list[0]
      if (list.length === 0) throw `you haven't joined a mesh yet`
      var defaultMesh = client.mesh()
      if (defaultMesh) {
        var mesh = list.find(m => m.name === defaultMesh)
        if (mesh) return mesh
        throw `default mesh '${defaultMesh}' not found`
      }
      throw `no mesh specified`
    }
  )
}

function selectHub(name, mesh) {
  if (!mesh) throw 'no mesh specified'
  return client.get(`/api/meshes/${uri(mesh.name)}/hubs`).then(ret => {
    var list = Object.entries(JSON.decode(ret))
    var dups = list.filter(([k, v]) => k === name || v.ports.includes(name))
    if (dups.length === 1) return dups[0][0]
    if (dups.length === 0) throw `hub '${name}' not found`
    throw `ambiguous hub name '${name}'`
  })
}

function selectEndpoint(name, mesh) {
  if (!mesh) throw 'no mesh specified'
  if (name) {
    var key = uri(name)
    return client.get(`/api/meshes/${uri(mesh.name)}/endpoints?id=${key}&name=${key}`).then(ret => {
      var list = JSON.decode(ret)
      var ep = list.find(ep => ep.id === name)
      if (ep) return ep
      var dups = list.filter(ep => ep.name === name)
      if (dups.length === 1) return list[0]
      if (dups.length === 0) throw `endpoint '${name}' not found`
      throw `ambiguous endpoint name '${name}'`
    })
  } else {
    return client.get(`/api/meshes/${uri(mesh.name)}`).then(ret => {
      var id = JSON.decode(ret).agent.id
      return client.get(`/api/meshes/${uri(mesh.name)}/endpoints/${id}`)
    }).then(ret => JSON.decode(ret))
  }
}

function selectMeshEndpoint(meshName, epName) {
  var mesh = null
  return selectMesh(meshName).then(m => {
    mesh = m
    return selectEndpoint(epName, m)
  }).then(ep => ({ mesh, ep }))
}

function selectApp(appName, mesh, ep) {
  var provider = appName.provider
  var name = appName.name
  var tag = appName.tag || ''
  function select(app) {
    if (provider && app.provider !== provider) return false
    return (app.name === name && (app.tag || '') === tag)
  }
  return client.get(`/api/meshes/${uri(mesh.name)}/endpoints/${ep.id}/apps`).then(ret => {
    var list = JSON.decode(ret).filter(select)
    if (list.length === 1) return { name, tag, provider: list[0].provider }
    if (list.length > 1) throw `ambiguous app name '${name}'`
    return client.get(`/api/meshes/${uri(mesh.name)}/apps`).then(ret => {
      var list = JSON.decode(ret).filter(select)
      if (list.length === 1) return { name, tag, provider: list[0].provider }
      if (list.length > 1) throw `ambiguous app name '${name}'`
    })
  })
}

function printTable(data, columns, indent) {
  var head = ' '.repeat(indent || 0)
  var cols = Object.entries(columns).filter(([_, format]) => typeof format === 'function')
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
