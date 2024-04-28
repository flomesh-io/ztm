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

## Build

### Install Pipy

If you have the latest version of [***Pipy***](https://github.com/flomesh-io/pipy) installed on your computer already, you can skip this step. If not, or if you're unsure whether your installed ***Pipy*** version is compatible to ***ZTM***, follow these steps to build Pipy from source.

First, make sure you have the following tools installed if you are running a Unix-like system (including Linux and macOS):

* Clang (version 5.0 or above)
* CMake (version 3.1 or above)

Or if you are running Windows, the following are required:

* Microsoft Visual Studio 2022 or above
* CMake (version 3.1 or above)
* NASM (version 2.16 or above)

Second, download the proper version of source code by using the Git submodule that is already included in this project:

```sh
git submodule update --init
```

Finally, enter the downloaded `pipy` folder, build and install it.

For Unix-like systems such as Linux and macOS:

```sh
cd pipy
make no-gui
sudo make install
```

For Windows, open *Developer Command Prompt for Visual Studio* and enter:

```sh
cd pipy
build.cmd no-gui
build.cmd install
```

> The last command `build.cmd install` can only be run as administrator. You might need to open *Developer Command Prompt for Visual Studio* as administrator before you execute it.

### Build ZTM

You need Node.js for building ZTM's GUI frontend. Once you have Node.js installed, building can be as simple as:

```sh
cd gui
npm install
npm run build
```

## Setup

> We'll only cover the setup of CA and hubs on Linux, since that's where they are usually run - a cloud-hosted Linux virtual machine. Although technically, one can also run CA and hubs in a Windows box, it can be relatively less convenient due to lack of a few handy tools such as `curl`.
>
> For setup of endpoints, on the other hand, we mainly operate via the browser interface, so the procedure is consistant among different OSes.

### Setup CA (Certificate Authority)

Start the CA service:

```sh
pipy ca/main.js
```

The default listening port is `127.0.0.1:9999`. The default location of database is `~/ztm-ca.db`. These settings can be changed by command-line options:

```sh
pipy ca/main.js -- --listen=127.0.0.1:1234 --database=~/my-data.db
```

Now a CA certificate is already generated and stored in the database. Retreive the CA certificate and save it to a file for later use:

```sh
curl http://localhost:9999/api/certificates/ca | tee ca.crt
```

We also need at least one *user certificate* in order to allow an endpoint onboard our mesh. Let's generate a certificate and the private key for user `root`:

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

### Setup Hubs

After the CA service is up and running, start a hub pointing to the CA service:

```sh
pipy hub/main.js -- --ca=localhost:9999
```

Like the CA service, you can use `--listen` option for a custom listening port other than the default `0.0.0.0:8888`:

```sh
pipy hub/main.js -- --ca=localhost:9999 --listen=0.0.0.0:1234
```

If your hub is running behind a gateway, you also need to provide at least one hub address that is visible to the endpoints by `--name` option:

```sh
pipy hub/main.js -- --ca=localhost:9999 --name=hub.example.com:8888
```

> You can include more than one `--name` options to assign multiple hub addresses.

### Setup Endpoints

Now that we've set up all the foundation (most likely in the cloud), we can go on and add as many endpoints as we need to the mesh.

First, start an agent on an endpoint computer that is going to join our mesh:

```sh
pipy agent/main.js
```

The default listening port is `127.0.0.1:7777`. The default location of database is `~/ztm.db`. These settings can be changed by command-line options:

```sh
pipy agent/main.js -- --listen=127.0.0.1:1234 --database=~/my-data.db
```

Once the agent is up and running, open your browser and point it to `http://localhost:7777`.

The first thing we do with the web interface is *joining the mesh*. Follow the instructions on screen to do that. The main information you provide while joining a mesh is the address of the hub. You'll also need 3 identify files during the process: the *CA certificate*, the *user certificate* and the user's *private key*, which we've already saved from above in files `ca.crt`, `root.crt` and `root.key` respectively.

Repeat the above procedure for every endpoint in your mesh. Then, you will be able to manage your mesh via browser from any of the endpoints. Some daily things you can do include:

- List endpoints and services in the mesh
- Creating services on any endpoint
- Mapping ports on any endpoint to services on other endpoints
