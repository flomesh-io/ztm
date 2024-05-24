# ZTM (Zero Trust Mesh)

ZTM is an open source network infrastructure software for running a ***decentralized*** network. It is built upon ***HTTP/2 tunnels*** and can run on ***any sort of IP networks*** such as LANs, containerized networks and the Internet, etc.

## Why ZTM?

ZTM lays the foundation for building ***decentralized applications*** by providing a set of core capabilities including:

* Network connectivity across Internet gateways and firewalls
* TLS-encrypted communication channels
* Certificate-based authentication and access control
* Service discovery and load balancing

ZTM can be used in various settings ranging from a ***2-node personal network connecting one's home and workplace*** to a ***10,000-node enterprise network connecting offices and branches across the globe***. Examples of applications that can leverage ZTM are:

* Remote access your home computer from anywhere in the world
* Share documents, pictures and videos within a group of people without the need of a big-tech social networking platform
* Private and secure P2P chat or voice/video conferencing without the fear of eavesdropping

## Features

ZTM is written in ***PipyJS***, a JavaScript dialect designed for [***Pipy***](https://github.com/flomesh-io/pipy) (https://github.com/flomesh-io/pipy). ***Pipy*** is an open source programmable proxy software. Thanks to ***Pipy***, ZTM has many unique features on top of the capabilities it offers:

* **Fast**. HTTP/2 multiplexing is fast. And ***Pipy*** is fast. Like, C++ fast.

* **Secure**. All traffic is encrypted by TLS and has identities via certificates. By using ***PipyJS***, security policy can be easily customized to meet the requirements in your organization.

* **Highly customizable and programmable**, since ***Pipy*** in itself is a general-purpose networking scripting engine.

* **Portable**. Choose your CPU architecture: x86, ARM, MIPS, RISC-V, LoongArch... Choose your operating system: Linux, Windows, macOS, FreeBSD, Android... ZTM runs anywhere.

## Quick Start

### Download

The easiest way to get started is download the latest binary release of ZTM from our [release page](https://github.com/flomesh-io/ztm/releases). If you prefer to have your own build from the source, you can follow the instructions in [Build](docs/Build.md).

> The official build releases of ZTM come in two forms of packaging: the CLI tool as a SEA (Single Executable Application), and the desktop application that wraps up the CLI tool and provides a GUI for desktop environments.
>
> In this guide, we'll be only utilizing the CLI for setting up a simple mesh. For more guides, including the usage of the desktop app, please check out our [Wiki](https://github.com/flomesh-io/ztm/wiki).

### Setup

A common setup consists of 3 nodes: 1 node running the *CA* and a *hub*, the other 2 nodes running two *agents* who wish to communicate with each other.

```
                      Data Center
        +------------------------------------+
        |                 CA                 |
        |         (state in ~/ztm-ca.db)     |
        +------------------------------------+
                      HTTP | Port 9999
                           |
        +------------------------------------+
        |                 Hub                |
        |             (stateless)            |
        +------------------------------------+
      HTTPS | Port 8888            HTTPS | Port 8888
            |                            |
  ----------|----------------------------|-----------
            |           Firewall         |
  ----------|----------------------------|-----------
            |                            |
            |           Internet         |
            |                            |
  -----------------------  |  -----------------------
        Firewall           |          Firewall
  -----------------------  |  -----------------------
            |              |             |
            |              |             |
  +---------------------+  |  +---------------------+
  |    Agent @ Home     |  |  |  Agent @ Workplace  |
  | (state in ~/ztm.db) |  |  | (state in ~/ztm.db) |
  +---------------------+  |  +---------------------+
                           |

```

> We'll only cover the setup of CA and hubs on Linux, since that's where they are usually run - a cloud-hosted Linux virtual machine.

#### Setup CA (Certificate Authority)

Start the CA service:

```sh
ztm start ca
```

> The default listening port is `127.0.0.1:9999`. The default location of database is `~/ztm-ca.db`. These settings can be changed by command-line options:
>
> ```sh
> ztm start ca --listen 127.0.0.1:1234 --database ~/my-data.db
> ```

#### Setup Hubs

After the CA service is up and running, start a hub service by typing:

```sh
ztm start hub
```

> Like the CA service, you can use `--listen` option for a custom listening port other than the default `0.0.0.0:8888`:
>
> ```sh
> ztm start hub --listen 0.0.0.0:1234
> ```

#### Create Users

We need at least one *user* in order to allow any endpoints onboard our mesh. Let's create a `root` user, who is defined by name as the administrator to our mesh:

```sh
ztm invite root --bootstrap x.x.x.x:8888 > permit.json # Where x.x.x.x is the public IP address of your hub
```

> The generated `permit.json` includes the private key for the user. The private key is NOT stored by ZTM for security concerns. It is your responsibility to keep it safe. If you lose the key by accident, there's no way to find it back with ZTM. You'll have to delete that user and create it again.
>
> To delete the user `root`, you can do:
>
> ```sh
> ztm evict root
> ```

#### Setup Endpoints

Now that we've set up all the foundation (most likely in the cloud), we can go on and add as many endpoints as we like to the mesh by using the generated file `permit.json`.

First, start an agent on an endpoint computer that is going to join our mesh:

```sh
ztm start agent
```

> On Windows, starting as a system service isn't supported yet. You'll have to do `ztm run agent` instead.

> The default listening port is `127.0.0.1:7777`. The default location of database is `~/ztm.db`. These settings can be changed by command-line options:
>
> ```sh
> ztm start agent --listen 127.0.0.1:1234 --database ~/my-data.db
> ```

Once the agent is up and running, open your browser and point it to `http://localhost:7777`.

The first thing we do with the web interface is *joining the mesh*. As long as you have the generated `permit.json` file in hand, it's pretty straightfoward to do that just by following the instructions on screen. The main information you provide while joining a mesh is a *mesh name* of your choice and an *endpoint name* that would be seen by other endpoints in the same mesh, along with the file `permit.json`.

Repeat the above procedure for every endpoint in your mesh. Then, you will be able to manage your mesh via browser from any of the endpoints. Some day-to-day things include:

- List endpoints and services in the mesh
- Create services on any endpoint
- Map ports on any endpoint to services on other endpoints

You can also join a mesh on any endpoint running the ZTM agent by using the CLI tool:

``` sh
ztm join my-awesome-mesh --as my-awesome-endpoint --permit permit.json
```

#### CLI Commands Summary

Here's a recap of what CLI commands you need to do on each computer node.

```
                       Cloud-hosted VM
  +---------------------------------------------------------+
  | ztm start ca                                            |
  | ztm start hub                                           | ---+
  | ztm invite root --bootstrap x.x.x.x:8888 > permit.json  |    |
  +---------------------------------------------------------+    |
              |          x.x.x.x:8888          |                 |
  ------------|--------------------------------|-------------    |
              |            Firewall            |                 |
  ------------|--------------------------------|-------------    |
              |                                |                 |
              |            Internet            |                 | permit.json
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
  |   --permit permit.json |   |   |   --permit permit.json |
  +------------------------+   |   +------------------------+
           PC @ Home           |         PC @ Workplace

```

For more information on the CLI, please refer to:

```sh
ztm help
```
