# ZT-App Guide

## zt-tunnel

零信任隧道，消除了物理距离的限制，让你可以在任何地方访问你的设备。例如，你可以在家里的电脑上运行 zt-tunnel，然后在办公室的电脑上访问家里的电脑。

使用命令 `ztm tunnel help` 可以查看 `tunnel` 的使用方法。

> 需要注意的是，第一次操作 app 时（包含 `help` ）会启动该应用。

```sh
ztm tunnel help
Commands:

  ztm tunnel get       <object type>                 List objects of the specified type
  ztm tunnel describe  <object type> <object name>   Show detailed info of the specified object
  ztm tunnel open      <object type> <object name>   Create an object of the specified type
  ztm tunnel close     <object type> <object name>   Delete the specified object

Object Types:

  inbound  in    Inbound end of a tunnel
  outbound out   Outbound end of a tunnel

Object Names:

  tcp/<name>     Name for a TCP tunnel
  udp/<name>     Name for a UDP tunnel

Type 'ztm tunnel help <command>' for detailed info.
```

在 `zt-tunnel` 中，有两个资源：`inbound` 和 `outbound`，分别对应隧道的入口和出口。通过 `inbound` 和 `outbound` 可以连接位于不同网络的设备。

假设我们有两个位于不同网络的 Agent：`root` 和 `test`。在 `test` 的网络中，有两个 web 服务：`:8080` 和 `:8081`。

```sh
curl 198.19.249.3:8080
hi
curl 198.19.249.3:8081
hello
```

通常要访问另一个网络中的服务，我们需要在防火墙中打开端口并使用公网的 IP 地址来访问。但是有了 ZTM 之后就简单多了。

首先，我们在 Agent `test` 一侧打开 `outbound`，命名为 *tcp/greeting*，将两个 web 服务指定为其 *targets*。

```sh
# agent test 
ztm tunnel open outbound tcp/greeting --targets 198.19.249.3:8080 --targets 198.19.249.3:8081
ztm tunnel get outbound

NAME          TARGETS                               ENTRANCES
tcp/greeting  198.19.249.3:8080, 198.19.249.3:8081
```

打开隧道的出口后，我们回到 Agent `root` 一侧打开隧道的 `inbound`，同样将其命名为 *tcp/greeting*。

```sh
# agent root 
ztm tunnel open inbound tcp/greeting --listen 18080
```

我们可以多次请求 `localhost:18080`，可以返回两个 *targets* 的响应。

```sh
curl localhost:18080
hi
 curl localhost:18080
hello
 curl localhost:18080
hi
```

## zt-proxy

零信任代理，让你可以从任何地方访问你的设备。例如，你可以在家里的电脑上运行 zt-proxy，然后在办公室的电脑上访问家里的所有设备，就像它们在同一个局域网中一样。

zt-proxy 代理分为监听端和转发端。监听端负责接收请求，然后将请求通过安全的加密通道传送到转发端；转发端将请求转发到目标服务器。

```sh
ztm proxy help config

Configure an endpoint as a listening side and/or a forwarding side

Usage: ztm proxy config [options...]

Options:

  --set-listen    [[ip:]port]       Open/close the proxy port
  --add-target    <domain|ip ...>   Add targets where traffic leaving from the endpoint can go
                                    e.g. '*.example.com' and '8.88.0.0/16'
  --remove-target <domain|ip ...>   Remove previously added targets
```

假设我们有两个位于不同网络的 Agent：`root` 和 `test`。后者作为代理的转发端，首先我们在 Agent `test` 端设置转发规则：只会转发匹配规则的请求。

```sh
ztm get ep
NAME          USER  IP             PORT   STATUS
ep-1 (local)  root  103.116.72.12  13297  Online
ep-2          test  45.62.167.230  18687  Online
```

在转发端，我们设置转发 `0.0.0.0/0` 和 `*` 的请求，表示转发所有网段和主机的请求。

```sh
# agent test
ztm proxy config --add-target 0.0.0.0/0 '*'

Endpoint: ep-2 (af2fc697-ff1e-4e44-9e46-b12e5a5c818e)
Listen: (not listening)
Targets:
  0.0.0.0/0
  *
```

接下来就是配置监听端了。监听端负责接收请求，需要为其配置监听的地址和端口。

```sh
# agent root
ztm proxy config --set-listen 0.0.0.0:1080
```

这样 zt-proxy 就配置完成，接下来测试一下。在 Agent `test` 侧有个监听在 `127.0.1.1:8082` 的 web 服务，这个服务监听在回环地址上，只能提供本地访问。同时，域名 `ubuntu` 解析到该地址。

```sh
# agent test
cat /etc/hosts
127.0.1.1 ubuntu
127.0.0.1 localhost
...
```

有了 zt-proxy 后，我们在 Agent `root` 侧通过代理也可以成功访问。

```sh
# agent root
curl localhost:8082
curl: (7) Failed to connect to localhost port 8082 after 4 ms: Connection refused

curl --proxy http://localhost:1080 localhost:8082
Hi, there!
```

配合代理，使用域名同样也可以访问该 web 服务。

```sh
# agent root
curl ubuntu:8082
curl: (6) Could not resolve host: ubuntu
curl --proxy http://localhost:1080 ubuntu:8082
Hi, there!
```

## zt-terminal

零信任终端，基于“设备 + 证书”身份认证和访问控制的远程命令行工具。获得授权后，一个设备可以在另一个设备上执行 shell 命令。通常，我们使用 `ssh` 访问远程设备，这需要获取设备的网络地址并配置其防火墙。有了 zt-terminal 后，远程执行命令变得更简单且更安全。

通过 `ztm terminal help` 查看使用方法，zt-terminal 的使用非常简单。

```sh
ztm terminal help

Commands:

  ztm terminal config                    View or set the terminal settings on an endpoint
  ztm terminal open    <endpoint name>   Connect to the terminal on an endpoint

Type 'ztm terminal help <command>' for detailed info.
```

假设有两个位于不同网络的 Agent：`root` 和 `test`，两个 Agent 都接入到同一个 Mesh 网络。其中，`test` 运行在 Ubuntu 平台上。

```sh
ztm get ep
NAME          USER  IP             PORT   STATUS
ep-1 (local)  root  103.116.72.12  13297  Online
ep-2          test  45.62.167.230  18687  Online
```

我们需要现在 Agent `test` 侧添加 ZTM 用户白名单，只有白名单中的用户才被允许。

```sh
# agent test
ztm terminal config --add-user root
Endpoint: ep-2 (af2fc697-ff1e-4e44-9e46-b12e5a5c818e)
Shell: (default)
Allowed Users:
  root
```

接着在 Agent `root` 侧使用命令 `ztm terminal open <endpoint name>` 可以创建连接到远程 Endpoint 的会话，然后就可以执行命令。

```sh
# agent  root
ztm terminal open ep-2
uname -a
Linux ubuntu 6.9.8-orbstack-00170-g7b4100b7ced4 #1 SMP Thu Jul 11 03:32:20 UTC 2024 x86_64 x86_64 x86_64 GNU/Linux
```

如果要结束回话，执行 `exit` 即可。

## zt-script

零信任脚本，基于“用户 + 证书”身份认证和访问控制的远程 [PipyJS 脚本](https://flomesh.io/pipy/docs/en/reference/pjs) 执行工具。允许同名的用户在远程设备上执行 PipyJS 脚本，对于远程设备上不支持 shell 的场景可以提供 Pipy 环境支持。

通过 `ztm script help` 查看 zt-script CLI 的使用方法。

```sh
ztm script help

Execute a script on a remote endpoint

Usage: ztm script <filename> [options...]

Options:

  --, --args  ...   Pass all options afterwards to the script
```

准备一个最简单的 PipyJS 脚本 `hello.js`。

```js
println('Hello, world')

pipy.exit(0)
```

我们的两个 Agent 都使用同一个用户 `test` 接入 Mesh 网络。

```sh
ztm get ep
NAME          USER  IP             PORT   STATUS
ep-2          test  103.116.72.12  35927  Online
ep-1 (local)  test  45.62.167.234  17943  Online
```

通过在 ep-1 侧执行下面的命令，可以在 ep-2 上执行 `hello.js` 脚本。

```sh
# ep-1
ztm ep ep-2 script hello.js

Hello, world
```
