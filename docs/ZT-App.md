# ZT-App Guide

## zt-tunnel

The zero-trust tunnel eliminates physical distance limitations, allowing you to access your devices from anywhere. For example, you can run zt-tunnel on your home computer and access it from your office computer.

Use the command `ztm tunnel help` to view the usage of `tunnel`.

> Note that the first time you operate the app (including `help`), it will start the application.

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

In `zt-tunnel`, there are two resources: `inbound` and `outbound`, corresponding to the tunnel's entrance and exit, respectively. These can connect devices located in different networks.

Assume we have two Agents in different networks: `root` and `test`. In the `test` network, there are two web services on ports `8080` and `8081`.

```sh
curl 198.19.249.3:8080
hi
curl 198.19.249.3:8081
hello
```

Typically, to access services in another network, we need to open ports in the firewall and use a public IP address. However, with ZTM, this becomes much simpler.

First, we open an `outbound` on the `test` Agent, named *tcp/greeting*, and specify the two web services as its *targets*.

```sh
# agent test 
ztm tunnel open outbound tcp/greeting --targets 198.19.249.3:8080 --targets 198.19.249.3:8081
ztm tunnel get outbound

NAME          TARGETS                               ENTRANCES
tcp/greeting  198.19.249.3:8080, 198.19.249.3:8081
```

After opening the tunnel's exit, we open the `inbound` on the `root` Agent side, also naming it *tcp/greeting*.

```sh
# agent root 
ztm tunnel open inbound tcp/greeting --listen 18080
```

We can request `localhost:18080` multiple times to get responses from both *targets*.

```sh
curl localhost:18080
hi
curl localhost:18080
hello
curl localhost:18080
hi
```

## zt-proxy

The zero-trust proxy allows you to access your devices from anywhere. For example, you can run zt-proxy on your home computer and access all your devices from your office computer as if they were on the same local network.

zt-proxy is divided into a listening side and a forwarding side. The listening side receives requests and transmits them through a secure encrypted channel to the forwarding side, which forwards the requests to the target server.

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

Assume we have two Agents in different networks: `root` and `test`. The latter acts as the forwarding side. First, we set forwarding rules on the `test` Agent: only forwarding requests matching the rules.

```sh
ztm get ep
NAME          USER  IP             PORT   STATUS
ep-1 (local)  root  103.116.72.12  13297  Online
ep-2          test  45.62.167.230  18687  Online
```

On the forwarding side, we set forwarding rules for `0.0.0.0/0` and `*`, meaning forwarding requests for all network segments and hosts.

```sh
# agent test
ztm proxy config --add-target 0.0.0.0/0 '*'

Endpoint: ep-2 (af2fc697-ff1e-4e44-9e46-b12e5a5c818e)
Listen: (not listening)
Targets:
  0.0.0.0/0
  *
```

Next, configure the listening side. The listening side receives requests and needs to be configured with a listening address and port.

```sh
# agent root
ztm proxy config --set-listen 0.0.0.0:1080
```

With zt-proxy configured, we can test it. The `test` Agent has a web service listening on `127.0.1.1:8082`, which is only locally accessible. The domain name `ubuntu` resolves to this address.

```sh
# agent test
cat /etc/hosts
127.0.1.1 ubuntu
127.0.0.1 localhost
...
```

Using zt-proxy, we can successfully access it through the proxy on the `root` Agent side.

```sh
# agent root
curl localhost:8082
curl: (7) Failed to connect to localhost port 8082 after 4 ms: Connection refused

curl --proxy http://localhost:1080 localhost:8082
Hi, there!
```

Similarly, using the domain name, we can also access the web service.

```sh
# agent root
curl ubuntu:8082
curl: (6) Could not resolve host: ubuntu
curl --proxy http://localhost:1080 ubuntu:8082
Hi, there!
```

## zt-terminal

The zero-trust terminal is a remote command-line tool based on "device + certificate" identity authentication and access control. Once authorized, one device can execute shell commands on another. Typically, we use `ssh` to access remote devices, requiring network address retrieval and firewall configuration. With zt-terminal, remote command execution becomes simpler and more secure.

Use `ztm terminal help` to view the usage. zt-terminal is straightforward to use.

```sh
ztm terminal help

Commands:

  ztm terminal config                    View or set the terminal settings on an endpoint
  ztm terminal open    <endpoint name>   Connect to the terminal on an endpoint

Type 'ztm terminal help <command>' for detailed info.
```

Assume there are two Agents in different networks: `root` and `test`, both connected to the same Mesh network. The `test` Agent runs on the Ubuntu platform.

```sh
ztm get ep
NAME          USER  IP             PORT   STATUS
ep-1 (local)  root  103.116.72.12  13297  Online
ep-2          test  45.62.167.230  18687  Online
```

We need to add the ZTM user whitelist on the `test` Agent side, allowing only whitelisted users.

```sh
# agent test
ztm terminal config --add-user root
Endpoint: ep-2 (af2fc697-ff1e-4e44-9e46-b12e5a5c818e)
Shell: (default)
Allowed Users:
  root
```

Then, on the `root` Agent side, use the command `ztm terminal open <endpoint name>` to create a session connecting to the remote Endpoint, allowing command execution.

```sh
# agent  root
ztm terminal open ep-2
uname -a
Linux ubuntu 6.9.8-orbstack-00170-g7b4100b7ced4 #1 SMP Thu Jul 11 03:32:20 UTC 2024 x86_64 x86_64 x86_64 GNU/Linux
```

To end the session, execute `exit`.

## zt-script

The zero-trust script tool, based on "user + certificate" identity authentication and access control, allows remote execution of [PipyJS scripts](https://flomesh.io/pipy/docs/en/reference/pjs). It supports running PipyJS scripts on remote devices, especially useful for environments that do not support shell commands.

Use `ztm script help` to view the zt-script CLI usage.

```sh
ztm script help

Execute a script on a remote endpoint

Usage: ztm script <filename> [options...]

Options:

  --, --args  ...   Pass all options afterwards to the script
```

Prepare a simple PipyJS script `hello.js`.

```js
println('Hello, world')

pipy.exit(0)
```

Both Agents use the same user `test` to join the Mesh network.

```sh
ztm get ep
NAME          USER  IP             PORT   STATUS
ep-2          test  103.116.72.12  35927  Online
ep-1 (local)  test  45.62.167.234  17943  Online
```

Executing the command on `ep-1` runs the `hello.js` script on `ep-2`.

```sh
# ep-1
ztm ep ep-2 script hello.js

Hello, world
```

## zt-cloud

The builtin zero-trust cloud app makes it easy to share files between devices and users. Unlike centralized cloud services such as *Apple iCloud*, your files are stored distributively on multiple endpoint devices that can be located in various private local networks while still allowing you to access them remotely and securely over the Internet.

To start using the Cloud app, you need a *local directory* acting as a *mirror* of the entire mesh filesystem. Each endpoint can have its own location for the local directory, but the content in it will be consistent on every endpoint by *manual downloading* or *auto-mirroring*.

The default local directory is `~/ztmCloud`. You can change to a different location for the current local endpoint by:

```sh
ztm cloud config --local-dir /path/to/my/local/mirror
```

> If you are configuring a remote endpoint, put `ep my-remote-ep` before `cloud config` to specify that.

To see what files are already stored in the cloud, type `ztm cloud ls <path>`. For example:

```sh
ztm cloud ls /users/root
NAME       STATE   SIZE        DATE  SOURCES  SHARED
video.mp4  new     2055491257  -     0        -
dummy.txt  synced  12          -     2        -
shared/    -       -           -     -        All Users
```

The *STATE* column shows the current status of a file in the *local directory* compared to what has been stored on the mesh. It can be one of:

- *Synced*: The local file is identical to what's on the mesh
- *New*: The local file is new to the mesh, in other words, the mesh doesn't have the file yet
- *Changed*: The mesh does have the file but is older than the local file
- *Missing*: The mesh has the file but the local directory hasn't
- *Outdated*: The mesh has a newer version of the file than in the local directory

The *SOURCES* column tells us how many endpoints have that file in their local directories. In other words, how many copies we have across the entire mesh.

To put a local file up to the mesh, which means to make a file *visible* to other endpoints, use `upload` command:

```sh
ztm cloud upload /users/root/video.mp4
```

If the file is *new* to the mesh, after uploading it, the *SOURCES* column of the file becomes 1, since now we have only one endpoint hosting the file right now, which is just the current local endpoint.

```sh
ztm cloud ls /users/root/video.mp4
NAME       STATE   SIZE        DATE  SOURCES  SHARED
video.mp4  synced  2055491257  -     1        -
```

To download the file on a different endpoint, use `download` command on that endpoint:

```sh
# On a second endpoint
ztm cloud download /users/root/video.mp4
```

The file will be downloaded from the first endpoint to the local directory of the second endpoint, and the *SOURCES* column will increase to 2, since now we have 2 endpoints that have the same file in their local directories.

If you'd like the second endpoint to automatically download any new uploads to the mesh, you can set up an *auto-mirror* for directory `/users/root`:

```sh
# On the second endpoint
ztm cloud config --add-mirror /users/root
```

After that, the second endpoint will be working as a backup for all files under `/users/root`.

Although files can be easily shared across endpoints just like that, by default, they are only accessible by the owner. In the previous examples, all files are under `/users/root` and owned by `root` user, and thus, inaccessible to other users.

To share a file or directory to all other users, use `share` command:

```sh
ztm cloud share /users/root/shared --set-all readonly
```

To share a file or directory to a specific user, use `--set-readonly` option with the `share` command:

```sh
ztm cloud share /users/root/video.mp4 --set-readonly guest
```

For more options of the `share` command, type:

```sh
ztm cloud help share
```

You can also see detailed info about all other commands by typing `ztm cloud help [command]`.
