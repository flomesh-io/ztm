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

The easiest way to get started is download the latest binary release of ZTM from our [release page](https://github.com/flomesh-io/ztm/releases). But if you prefer to have your own build from the source, follow the instructions in [Build](docs/Build.md).

### Setup

A common setup consists of 3 nodes: one node running the *CA* and a *hub*, the other two nodes running two *agents* who are to communicate with each other.

```
                       Data Center
               +------------------------+
               |          CA            |
               | (state in ~/ztm-ca.db) |
               +------------------------+
                      HTTP | Port 9999
                           |
               +------------------------+
               |          Hub           |
               |      (stateless)       |
               +------------------------+
             HTTPS /   Port 8888   \ HTTPS
  ----------------/-----------------\----------------
                 /      Firewall     \
  --------------/---------------------\--------------
               /                       \
              /        Internet         \
             /                           \
  -------------------------|-------------------------
          Firewall         |        Firewall
  -------------------------|-------------------------
            |              |               |
            |              |               |
  +---------------------+  |  +---------------------+
  |    Agent @ Home     |  |  |  Agent @ Workplace  |
  | (state in ~/ztm.db) |  |  | (state in ~/ztm.db) |
  +---------------------+  |  +---------------------+
                           |

```

> We'll only cover the setup of CA and hubs on Linux, since that's where they are usually run - a cloud-hosted Linux virtual machine. Although technically, one can also run CA and hubs in a Windows box, it can be relatively less convenient due to lack of a few handy tools such as `curl`.
>
> For setup of endpoints, on the other hand, we mainly operate via the browser interface, so the procedure is consistant among different OSes.

#### Setup CA (Certificate Authority)

Start the CA service:

```sh
pipy repo://ztm/ca
```

> The default listening port is `127.0.0.1:9999`. The default location of database is `~/ztm-ca.db`. These settings can be changed by command-line options:
>
> ```sh
> pipy repo://ztm/ca --args --listen=127.0.0.1:1234 --database=~/my-data.db
> ```

Now a CA certificate is already generated and stored in the database. Retreive the CA certificate and save it to a file for later use:

```sh
curl http://localhost:9999/api/certificates/ca | tee ca.crt
```

We also need at least one *user certificate* in order to allow an endpoint onboard our mesh. Let's generate a certificate and the private key for user `root` and save them in files:

```sh
curl http://localhost:9999/api/certificates/root -X POST | tee root.key
curl http://localhost:9999/api/certificates/root | tee root.crt
```

> The private key for a user certificate is only returned once as the certificate is generated. If you lose the key by accident, there's no way to find it back with the CA service. You'll have to delete that user certificate and generate a new one in the same way as above.
>
> If you want to delete the certificate for user `root`, you can do:
>
> ```sh
> curl http://localhost:9999/api/certificates/root -X DELETE
> ```

#### Setup Hubs

After the CA service is up and running, start a hub pointing to the CA service:

```sh
pipy repo://ztm/hub --args --ca=localhost:9999
```

> Like the CA service, you can use `--listen` option for a custom listening port other than the default `0.0.0.0:8888`:
>
> ```sh
> pipy repo://ztm/hub --args --ca=localhost:9999 --listen=0.0.0.0:1234
> ```

#### Setup Endpoints

Now that we've set up all the foundation (most likely in the cloud), we can go on and add as many endpoints as we like to the mesh.

First, start an agent on an endpoint computer that is going to join our mesh:

```sh
pipy repo://ztm/agent
```

> The default listening port is `127.0.0.1:7777`. The default location of database is `~/ztm.db`. These settings can be changed by command-line options:
>
> ```sh
> pipy repo://ztm/agent --args --listen=127.0.0.1:1234 --database=~/my-data.db
> ```

Once the agent is up and running, open your browser and point it to `http://localhost:7777`.

The first thing we do with the web interface is *joining the mesh*. Follow the instructions on screen to do that. The main information you provide while joining a mesh is the *address of the hub*. You'll also need 3 identify files during the process: the *CA certificate*, the *user certificate* and the user's *private key*, which we've already saved from above in files `ca.crt`, `root.crt` and `root.key` respectively.

Repeat the above procedure for every endpoint in your mesh. Then, you will be able to manage your mesh via browser from any of the endpoints. Some day-to-day things include:

- List endpoints and services in the mesh
- Create services on any endpoint
- Map ports on any endpoint to services on other endpoints
