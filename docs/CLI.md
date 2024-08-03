# ZTM CLI

The ZTM CLI tool is a command-line interface for interacting with the ZTM API. Users can manage and operate Agents, Mesh networks, and applications within the ZTM network using the CLI tool. The CLI simplifies the management process, allowing users to perform various operations conveniently from the command line.

If you are familiar with `kubectl`, ZTM CLI will not be too unfamiliar. The CLI calls the Agent's API when executed, obtaining the Agent API address through the `~/.ztm.conf` configuration.

> Use `ztm config --agent HOST:PORT` to switch between different Agents.

Use the `ztm help` command to view the usage of the CLI.

```sh
ztm help

Usage:

  ztm <cmd> ...
  ztm <app> ...

  ztm ep [<mesh name>/]<endpoint name> <cmd> ...
  ztm ep [<mesh name>/]<endpoint name> <app> ...

  ztm mesh <mesh name> <cmd> ...
  ztm mesh <mesh name> <app> ...

Commands:

  ztm version                                  Print ZTM version information
  ztm config                                   View or set the configuration of ZTM command line tool
  ztm identity                                 Print the identity of the current running agent
  ztm start      <object type> [app name]      Start running a hub, agent or app as background service
  ztm stop       <object type> [app name]      Stop running a hub, agent or app as background service
  ztm run        <object type>                 Start running a hub or agent in foreground mode
  ztm invite     <username>                    Issue a permit to a user for joining the mesh
  ztm evict      <username>                    Revoke a permit and block the user from joining the mesh
  ztm join       <mesh name>                   Join a mesh
  ztm leave      <mesh name>                   Leave a mesh
  ztm get        <object type> [object name]   List objects of a certain type
  ztm describe   <object type> <object name>   View detailed information about an object
  ztm download   <object type> <object name>   Download an app or file from the mesh
  ztm erase      <object type> <object name>   Erase a downloaded app or file
  ztm publish    <object type> <object name>   Publish an app or file to the mesh
  ztm unpublish  <object type> <object name>   Unpublish an app or file from the mesh
  ztm log        <object type> [object name]   View logs from an app or endpoint

Type 'ztm help <command>' for detailed info.
```

For example, the command `ztm run agent` starts the ZTM Agent, typically the first command executed when using ZTM.

```sh
ztm run agent
2024-07-30 13:53:14.092 [INF] [listener] Listening on TCP port 7777 at 127.0.0.1
```

Use the `ztm help run` command to view the usage of `run`.

```sh
ztm help run

Start running a hub or agent in foreground mode

Usage: ztm run <object type> [options...]

Options:

  -d, --data    <dir>             Specify the location of ZTM storage (default: ~/.ztm)
  -l, --listen  <[ip:]port>       Specify the service listening port (default: 0.0.0.0:8888 for hubs, 127.0.0.1:7777 for agents)
  -n, --names   <host:port ...>   Specify one or more hub addresses (host:port) that are accessible to agents
                                  Only applicable to hubs
      --ca      <url>             Specify the location of an external CA service if any
                                  Only applicable to hubs
  -p, --permit  <pathname>        An optional output filename for generating the root user's permit when starting a hub
                                  Or an input filename to load the user permit when joining a mesh while starting an agent
      --join    <mesh>            If specified, join a mesh with the given name
                                  Only applicable to agents
      --join-as <endpoint>        When joining a mesh, give the current endpoint a name
                                  Only applicable to agents

Available object types include: hub, agent
```

Use the `ztm start` command to start ZTM components and add them as system services (supported on Linux and macOS platforms). This command can start both the Hub and the Agent. Use `ztm help start` to view usage.

## Starting the Hub

Use `ztm start hub` with parameters to start the Hub:

- `--listen`: The listening address and port of the Hub
- `--names`: Use the Hub's IP address and port as its name
- `--permit`: Root user's permit, which includes the CA certificate, user authentication information, and Hub access address (same as the value specified by `--names`). Use this permit to connect the Agent to the Hub.

> The root user's permit generated during the first hub startup contains the root user's private key. Please keep it safe.

```sh
ztm start hub --listen 0.0.0.0:8888 --names 18.143.175.202:8888 --permit root.json
```

## Starting the Agent

Like starting the Hub, use `ztm start` to start the Agent. It defaults to listening on `127.0.0.1:7777`, which can be modified using the `--listen` parameter:

```sh
ztm start agent
```

> To run multiple Agents on the same device, use `ztm run agent --listen HOST:PORT` to specify different addresses and ports.

After starting, you can view the Mesh the Agent is connected to with the following command:

```sh
ztm get mesh
NAME  JOINED AS  USER  HUBS  STATUS
```

The result shows that the Agent is not connected to any network.

## Joining a Mesh

Use the `root.json` permit generated when starting the Hub to execute the following command to connect the Agent to the Mesh. Use `--as` to specify the Endpoint name as `ep-1`.

> Use `ztm help join` to view more usage.

```sh
ztm join test-mesh --as ep-1 --permit root.json
```

Running the `ztm get mesh` command again shows the connected Mesh network.

```sh
ztm get mesh

NAME      JOINED AS  USER  HUBS                 STATUS     
ztm-demo  ep-1       root  18.143.175.202:8888  Connected  
```

View the Endpoints in the Mesh network.

```sh
ztm get ep

NAME          USER  IP            PORT   STATUS  
ep-1 (local)  root  103.116.72.8  20175  Online  
```

The output shows that there is only one Endpoint in the current Mesh network. You can connect more Agents to the Mesh using the `root.json` permit for demonstration purposes.

## Issuing Permits

From previous operations, it's clear that permits are the "identity" for an Agent to join the Mesh. Only permitted Agents are allowed to join the Mesh. To issue permits to users, use the root user connected to the Mesh to issue more permits and the public key of the invited user (Agent). The invited user's public key can be obtained using the `ztm identity` command.

Start another Agent, execute the `ztm identity` command, and save the result in `pub.key`.

With the invitee's public key, the root user can issue a permit to the `test` user.

```sh
# agent root
ztm invite test --permit test.json --identity pub.key
```

Then use `test.json` to connect the new Agent to the Mesh network.

```sh
# agent test
ztm join ztm-demo --as ep-2 --permit test.json
```

Viewing the Endpoints in the Mesh network now shows the newly joined Endpoint.

```sh
# agent root
ztm get ep

NAME          USER  IP             PORT   STATUS
ep-1 (local)  root  103.116.72.8   20175  Online
ep-2          test  45.62.167.230  47951  Online
```

## ZT-App

ZTM comes with several built-in apps, serving as references for developing applications with the zt-app framework.

Use `ztm get` to view `app` resources.

```sh
ztm get app

NAME          TAG  STATE
ztm/proxy          builtin
ztm/script         builtin
ztm/terminal       builtin
ztm/tunnel         builtin
```

In the [ZT-App Documentation](./ZT-App_zh.md), we will introduce each of these applications.