# ZTM CLI

ZTM CLI 工具是一款命令行界面工具，用于与 ZTM API 进行交互。用户可以通过 CLI 工具对 ZTM 网络中的 Agent、Mesh 和应用程序进行管理和操作。CLI 工具简化了管理流程，使得用户可以通过命令行方便地执行各种操作。

如果你熟悉 `kubectl`，将对 ZTM CLI 不会太过陌生。CLI 在执行时会调用 Agent 的 API，通过 `~/.ztm.conf` 配置获取 Agent API 的地址。

> 通过 `ztm config --agent HOST:PORT` 可以在不同的 Agent 间切换。

使用 `ztm help` 命令可以查看 CLI 的使用方法。

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

比如，使用命令 `ztm run agent` 可以启动 ZTM Agent，也是使用 ZTM 通常最先执行的命令。

```sh
ztm run agent
2024-07-30 13:53:14.092 [INF] [listener] Listening on TCP port 7777 at 127.0.0.1
```

通过命令 `ztm help run` 可以查看 `run` 的使用方法。

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

使用 `ztm start` 命令可以启动 ZTM 组件，并将其作为系统服务添加到系统中（支持 Linux 和 macOS 平台）。我们可以使用这个命令启动 Hub 和 Agent，通过 `ztm help start` 可以查看使用方法。

## 启动 Hub

我们使用 `ztm start hub` 并配合参数来启动 Hub：

- `--listen`：Hub 的监听地址和端口
- `--names`：使用 Hub 的 IP 地址和端口作为其名字
- `--permit`：root 用户的许可，启动包含了 CA 证书、用户认证信息以及 Hub 的访问地址（与 `--names` 的指定值相同）。使用该许可，可以将 Agent 连接到 Hub。

> 首次启动 hub 时生成的 root 用户许可内包含有 root 用户的私钥，请妥善保存。

```sh
ztm start hub --listen 0.0.0.0:8888 --names 18.143.175.202:8888 --permit root.json
```

## 启动 Agent

同 Hub 的启动一样，使用 `ztm start` 来启动 Agent。其默认监听在 `127.0.0.1:7777`，可以通过 `--listen` 参数修改：

```sh
ztm start agent
```

> 如果要在同一台设备上运行多个 Agent，需要使用 `ztm run agent --listen HOST:PORT` 指定不同的地址和端口。

启动后我们可以通过命令查看当前 Agent 接入的 Mesh。

```sh
ztm get mesh
NAME  JOINED AS  USER  HUBS  STATUS
```

从结果来看，Agent 没有接入任何网络。

## 接入 Mesh

使用启动 Hub 时生成的 `root.json` 许可执行下面的命令，将 Agent 接入到 Mesh 中，通过 `--as` 指定 Endpoint 的名字为 `ep-1`。

> 通过 `ztm help join` 查看更多使用方法。

```sh
ztm join test-mesh --as ep-1 --permit root.json
```

此时再运行 `ztm get mesh` 命令可以看到已经接入的 Mesh 网络。

```sh
ztm get mesh

NAME      JOINED AS  USER  HUBS                 STATUS     
ztm-demo  ep-1       root  18.143.175.202:8888  Connected  
```

查看 Mesh 网络中的 Endpoint。

```sh
ztm get ep

NAME          USER  IP            PORT   STATUS  
ep-1 (local)  root  103.116.72.8  20175  Online  
```

从输出来看，当前的 Mesh 网络中只有一个 Endpoint。我们可以通过为其他用户颁发许可，将其他的 Agent 接入到 Mesh 中。当然，用作演示你可以使用 `root.json` 接入更多的 Agent。

## 颁发许可

从前面操作可以看出，许可是 Agent 接入 Mesh 的“身份”，只有获得许可的 Agent 才被允许接入到 Mesh 中。要为用户颁发许可，需要使用接入到 Mesh 的 root 用户来颁发更多的许可，以及被邀请用户（Agent）的公钥。邀请用户（Agent）的公钥可以通过命令 `ztm identify` 命令获取。

我们启动另一个 Agent，执行命令 `ztm identity` 并将结果保存在 `pub.key` 中。

有了被邀请者的公钥后，通过 root 用户来为 `test` 用户颁发许可。

```sh
# agent root
ztm invite test --permit test.json --identity pub.key
```

然后使用 `test.json` 把新的 Agent 接入到 Mesh 网络中。

```sh
# agent test
ztm join ztm-demo --as ep-2 --permit test.json
```

此时查看 Mesh 网络中的 Endpoint，就可以看到新加入的。

```sh
# agent root
ztm get ep

NAME          USER  IP             PORT   STATUS
ep-1 (local)  root  103.116.72.8   20175  Online
ep-2          test  45.62.167.230  47951  Online
```

## ZT-App

ZTM 内置了多个开箱即用的 App，也作为 zt-app 框架应用开发的参考。

使用 `ztm get` 可以查看 `app` 资源。

```sh
ztm get app

NAME          TAG  STATE
ztm/proxy          builtin
ztm/script         builtin
ztm/terminal       builtin
ztm/tunnel         builtin
```

在 [ZT-App 文档](./ZT-App_zh.md) 中，我们将逐个对几个应用进行介绍。
