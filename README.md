# ZTM (Zero Trust Mesh)

ZTM is an open source network infrastructure software for running a ***decentralized*** network. It is built upon ***HTTP/2 tunnels*** and can run on ***any sort of IP networks*** such as LANs, containerized networks and the Internet, etc.

## Why ZTM?

ZTM lays the foundation for building ***decentralized applications*** by providing a set of core capabilities including:

* Network connectivity across Internet gateways and firewalls
* TLS-encrypted communication channels
* Certificate-based authentication and access control
* Decentralized application publishing and deployment
* Decentralized file discovery and data sharing

ZTM can be used in various settings ranging from a ***2-node personal network connecting one's home and workplace*** to a ***10,000-node enterprise network connecting offices and branches across the globe***. Examples of applications that can leverage ZTM are:

* Remote access your home computer from anywhere in the world
* Share documents, pictures and videos within a group of people without the need of a big-tech social networking platform
* Private and secure P2P data transfer without the fear of eavesdropping

## Features

ZTM is written in **PipyJS**, a JavaScript dialect designed for [**Pipy**](https://github.com/flomesh-io/pipy) (https://github.com/flomesh-io/pipy). **Pipy** is an open source programmable proxy software. Thanks to **Pipy**, ZTM has many unique features on top of the capabilities it offers:

* **Fast**. HTTP/2 multiplexing is fast. And **Pipy** is fast. Like, C++ fast.

* **Secure**. All traffic is encrypted by TLS and has identities via certificates. By using **PipyJS**, security policy can be easily customized to meet the requirements in your organization.

* **Highly customizable and programmable**, since **Pipy** in itself is a general-purpose networking scripting engine.

* **Portable**. Choose your CPU architecture: x86, ARM, MIPS, RISC-V, LoongArch... Choose your operating system: Linux, Windows, macOS, FreeBSD, Android... ZTM runs anywhere.

## Quick Start

### Download

The easiest way to get started is download the latest binary release of ZTM from our [release page](https://github.com/flomesh-io/ztm/releases). If you prefer to have your own build from the source, you can follow the instructions in [Build](docs/Build.md).

> The official build releases of ZTM come in two forms of packaging: the CLI tool as a SEA (Single Executable Application), and the desktop application that wraps up the CLI tool and provides a GUI for desktop environments.
>
> In this guide, we'll be only utilizing the CLI for setting up a simple mesh. For more guides, including the usage of the desktop app, please check out our [Wiki](https://github.com/flomesh-io/ztm/wiki).

### Setup

A common setup consists of 3 nodes: 1 node running the *Hub*, the other 2 nodes running two *Agents* who wish to communicate with each other.

```
                            Data Center
          +-------------------------------------------+
          |                     Hub                   |
          |        (state in ~/.ztm/ztm-hub.db)       |
          +-------------------------------------------+
        HTTPS | Port 8888                 HTTPS | Port 8888
              |                                 |
  ------------|---------------------------------|--------------
              |             Firewall            |
  ------------|---------------------------------|--------------
              |                                 |
              |             Internet            |
              |                                 |
  ----------------------------  |  ----------------------------
          Firewall              |            Firewall
  ----------------------------  |  ----------------------------
              |                 |               |
              |                 |               |
  +--------------------------+  |  +--------------------------+
  |      Agent @ Home        |  |  |    Agent @ Workplace     |
  | (state in ~/.ztm/ztm.db) |  |  | (state in ~/.ztm/ztm.db) |
  +--------------------------+  |  +--------------------------+
                                |

```

> We'll only cover the setup of a Hub on Linux, since that's where they are usually run - a cloud-hosted Linux virtual machine.

#### Setup a Hub

Suppose you have a Linux box in the cloud, with a public IP address `1.2.3.4` and a public TCP port `8888`. Start a Hub service by typing:

```sh
ztm start hub --listen 0.0.0.0:8888 --names 1.2.3.4:8888 --permit root.json
```

> You might need `sudo` when executing the above command because it needs to install a service to `systemd`.

Now the Hub should be up an running. Plus, a file named `root.json` should have been generated for us to allow *endpoints* to join our mesh.

#### Setup Endpoints

Once the Hub gets up and running in the cloud, we can go on and add as many *endpoints* as we like to the mesh by using the generated permit file `root.json`.

> An *endpoint* is just a computer running in various network environments with access to the Internet.

First, start an Agent on an endpoint computer that is going to join our mesh:

```sh
ztm start agent
```

> On Windows, starting as a system service isn't supported yet. You'll have to do `ztm run agent` instead.

And then, join the mesh by saying:

```sh
ztm join MESH_NAME --as EP_NAME --permit root.json
```

Where `MESH_NAME` can be any name of your choice for identifying a mesh locally if you have many. `EP_NAME` is the name of your current endpoint seen by other endpoints in the same mesh. `root.json` is the permit file generated in our first step where a Hub is set up.

If everything works out, you can now check out the status of the mesh by typing:

```sh
ztm get mesh
```

Or look up for endpoints that already joined the mesh:

```sh
ztm get ep
```

For detailed usage of the command-line tool, type:

```sh
ztm help
```

If you prefer GUI, you can open your browser and point it to `http://localhost:7777` right after command `ztm start agent`. You can join a mesh, find other endpoints, using apps and everything. Almost all functionalities ZTM provides are available from both the CLI and the GUI.

Repeat the above procedure for every endpoint in your mesh. Then, you will be able to manage your mesh via terminal or browser from any endpoint in the mesh.

#### Using Your Mesh

Only connecting a bunch of endpoints as a mesh isn't very useful. What makes your mesh useful is the *apps* running in it. The official ZTM releases come with a number of builtin apps including:

- Tunnel - Establish secure TCP/UDP tunnels between endpoints
- Proxy - A SOCKS/HTTP forward proxy that takes in traffic from one endpoint and forward out via another endpoint 
- Script - Execute *PipyJS* scripts remotely on an endpoint
- Terminal - Remote access to the shell on an endpoint

Third-party apps can also be installed. Also, new apps can be developed rather easily thanks to the *PipyJS* scripting capability of [**Pipy**](https://github.com/flomesh-io/pipy).

To get a list of all installed apps, type:

```sh
ztm get app
```

You can use an app from either the browser GUI or the command-line tool. On a terminal, one can access an app's CLI in a way like:

```sh
ztm APP_NAME ...
```

To find out detailed information about using an app via CLI, type:

```sh
ztm APP_NAME help
```

#### CLI Commands Summary

Here's a recap of what CLI commands you need to do on each computer node.

```
                       Cloud-hosted VM
  +---------------------------------------------------------+
  | ztm start hub --names x.x.x.x:8888 --permit root.json   | ---+
  +---------------------------------------------------------+    |
              |          x.x.x.x:8888          |                 |
  ------------|--------------------------------|-------------    |
              |            Firewall            |                 |
  ------------|--------------------------------|-------------    |
              |                                |                 |
              |            Internet            |                 | root.json
              |                                |                 |
  --------------------------   |   --------------------------    |
           Firewall            |            Firewall             |
  --------------------------   |   --------------------------    |
              |                |               |                 |
              |                |               |                 |
  +------------------------+   |   +------------------------+    |
  | ztm start agent        |   |   | ztm start agent        |    |
  | ztm join my-mesh \     |   |   | ztm join my-mesh \     | <--+
  |   --as home \          |   |   |   --as workplace \     |
  |   --permit root.json   |   |   |   --permit root.json   |
  +------------------------+   |   +------------------------+
           PC @ Home           |         PC @ Workplace

```

For more information on the CLI, please refer to:

```sh
ztm help
```

## Quick Links:
 * HowTo: Using ZTM for Secure Remote Desktop Protocol (RDP) Access (https://github.com/flomesh-io/ztm/wiki/2.-HOWTO-:-using-ztm-for-secure-RDP-access)
