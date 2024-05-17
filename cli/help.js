export default function (argv) {
  switch (argv[0]) {
    case 'config': return helpConfig()
    case 'run':
      switch (argv[1]) {
        case 'ca': return helpRunCA()
        case 'hub': return helpRunHub()
        case 'agent': return helpRunAgent()
        default: return helpRun()
      }
    case 'invite': return helpInvite()
    case 'evict': return helpEvict()
    case 'join': return helpJoin()
    case 'leave': return helpLeave()
    case 'get': return helpGet()
    case 'describe': return helpDescribe()
    case 'create':
      switch (argv[1]) {
        case 'service': return helpCreateService()
        case 'port': return helpCreatePort()
        default: return helpCreate()
      }
    case 'delete': return helpDelete()
    default: return helpAll()
  }
}

function helpAll() {
  println()
  println(`Usage: ztm <command> [<object type>] [<object name>] [<options>]`)
  println()
  println(`Commands:`)
  println()
  println(`  config`)
  println(`  start     ca | hub | agent`)
  println(`  stop      ca | hub | agent`)
  println(`  run       ca | hub | agent`)
  println(`  invite`)
  println(`  evict`)
  println(`  join`)
  println(`  leave`)
  println(`  get       service | port | endpoint | mesh`)
  println(`  describe  service | port | endpoint | mesh`)
  println(`  create    service | port`)
  println(`  delete    service | port`)
  println()
  println(`Object types:`)
  println()
  println(`  ca`)
  println(`  hub`)
  println(`  agent`)
  println(`  mesh      meshes`)
  println(`  endpoint  endpoints  ep`)
  println(`  service   services   svc`)
  println(`  port      ports`)
  println()
  helpServiceName()
  println()
  helpPortName()
  println()
  println(`Type 'ztm help <command> [<object name>]' for more details.`)
  println()
}

function helpServiceName() {
  println(`Service name:`)
  println()
  println(`  tcp/name`)
  println(`  udp/name`)
  println()
  println(`  e.g. 'tcp/my-fancy-service', 'udp/voice-chat-svc'`)
}

function helpPortName() {
  println(`Port name:`)
  println()
  println(`  ip/tcp/port`)
  println(`  ip/udp/port`)
  println(`  localhost/tcp/port`)
  println(`  localhost/udp/port`)
  println(`  tcp/port`)
  println(`  udp/port`)
  println()
  println(`  e.g. '10.0.0.2/tcp/8080', 'localhost/udp/445', 'tcp/80'`)
}

function helpConfig() {
  println()
  println(`Usage: ztm config [--ca=<host>:<port>] [--agent=<host>:<port>]`)
  println()
  println(`Options:`)
  println(`  --ca=<host>:<port>      Where the CA service can be accessed`)
  prinlnt(`                          Defaults to 'localhost:9999'`)
  println(`  --agent=<host>:<port>   Where the agent service can be accessed`)
  println(`                          Defaults to 'localhost:7777'`)
  println()
}

function helpRun() {
  println()
  println(`Usage: ztm run ca|hub|agent <options>`)
  println()
  println(`Type 'ztm help run ca|hub|agent' for more details.`)
  println()
}

function helpRunCA() {
  println()
  println(`Usage: ztm run ca [--listen=[<ip>:]<port>] [--database=<filename>]`)
  println()
  println(`Options:`)
  println(`  -l, --listen=[<ip>:]<port>   Service listening address`)
  println(`                               Defaults to '127.0.0.1:9999'`)
  println(`  -d, --database=<filename>    Location of the database file`)
  println(`                               Defaults to '~/ztm-ca.db'`)
  println()
}

function helpRunHub() {
  println()
  println(`Usage: ztm run hub [--listen=[<ip>:]<port>] [--ca=<host>:<port>] [--name=<address>]`)
  println()
  println(`Options:`)
  println(`  -l, --listen=[<ip>:]<port>   Service listening address`)
  println(`                               Defaults to '127.0.0.1:8888'`)
  println(`      --ca=<host>:<port>       Address of the CA service to connect to`)
  println(`                               Defaults to 'localhost:9999'`)
  println(`  -n, --name=<address>         Address of the hub that is visible to agents`)
  println(`                               More than one addresses can be provided if any`)
  println()
}

function helpRunAgent() {
  println()
  println(`Usage: ztm run agent [--listen=[<ip>:]<port>] [--database=<filename>]`)
  println()
  println(`Options:`)
  println(`  -l, --listen=[<ip>:]<port>   Service listening address`)
  println(`                               Defaults to '127.0.0.1:7777'`)
  println(`  -d, --database=<filename>    Location of the database file`)
  println(`                               Defaults to '~/ztm.db'`)
  println()
}

function helpInvite() {
  println()
  println(`Usage: ztm invite <username> --bootstrap=<host>:<port> [--output=<filename>]`)
  println()
  println(`Options:`)
  println(`  -b, --bootstrap=<host>:<port>   Target address of a hub for endpoint agents to connect to`)
  println(`  -o, --output=<filename>         Filename of the generated permit for an endpoint to join the mesh`)
  println(`                                  Output to stdout if not present`)
  println()
}

function helpEvict() {
  println()
  println(`Usage: ztm evict <username>`)
  println()
}

function helpJoin() {
  println()
  println(`Usage: ztm join <mesh name> --as=<name> --permit=<filename>`)
  println()
  println(`Options:`)
  println(`  -a, --as=<name>          Specify a name of the endpoint seen by other endpoints in the mesh`)
  println(`  -p, --permit=<filename>  Point to a file containing the permit for joining the mesh`)
  println(`                           A permit is generated with command 'ztm invite'`)
  println()
}

function helpLeave() {
  println()
  println(`Usage: ztm leave <mesh name>`)
  println()
}

function helpGet() {
  println()
  println(`Usage: ztm get service|port|endpoint|mesh [<name>] [--mesh=<name>]`)
  println()
  println(`Options:`)
  println(`  -m, --mesh=<name>  Specify a mesh by name`)
  println(`                     Can be omitted when only 1 mesh is joined'`)
  println(`                     Not applicable when doing 'ztm get mesh'`)
  println()
  helpServiceName()
  println()
  helpPortName()
  println()
}

function helpDescribe() {
  println()
  println(`Usage: ztm describe service|port|endpoint|mesh <name>`)
  println()
  helpServiceName()
  println()
  helpPortName()
  println()
}

function helpCreate() {
  println()
  println(`Usage: ztm create service|port <name> <options>`)
  println()
  helpServiceName()
  println()
  helpPortName()
  println()
  println(`Type 'ztm help create service|port' for more details.`)
  println()
}

function helpCreateService() {
  println()
  println(`Usage: ztm create service <name> --host=<host> --port=<port>`)
  println()
  println(`Options:`)
  println(`  -h, --host  Host name or IP address of the service`)
  println(`  -p, --port  Port number of the service`)
  println()
  helpServiceName()
  println()
}

function helpCreatePort() {
  println()
  println(`Usage: ztm create service <name> --service=<name> [--endpoint=<name>]`)
  println()
  println(`Options:`)
  println(`  -s, --service         Name of the service that the port connects to`)
  println(`  -e, --ep, --endpoint  Optional name of the endpoint that provides the service`)
  println()
  helpPortName()
  println()
}

function helpDelete() {
  println()
  println(`Usage: ztm delete service|port [<name>]`)
  println()
  helpServiceName()
  println()
  helpPortName()
  println()
}
