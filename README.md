<p align="center">
  <img width="150px" height="150px" src="https://flomesh.io/img/ztm.png" />
</p>

<div align="center">
  <a href="https://github.com/flomesh-io/pipy"><img src="https://flomesh.io/img/favicon.ico" width="20px" height="20px"  alt=""></a>
  <img src="https://img.shields.io/badge/PipyJS-00adef">
  <img src="https://img.shields.io/badge/C++-green">
  <img src="https://img.shields.io/badge/Tauri-24C8DB?logo=tauri&logoColor=FFC131">
  <img src="https://img.shields.io/badge/Rust-c57c54?logo=rust&logoColor=E34F26">
  <img src="https://img.shields.io/badge/Vite5-35495E?logo=vite&logoColor=41D1FF">
  <a href="https://github.com/flomesh-io/ztm/stargazers"><img src="https://img.shields.io/github/stars/flomesh-io/ztm" alt="star"></a>
</div>

<p align="center">
  <img src="https://img.shields.io/badge/Web-green">
  <img src="https://img.shields.io/badge/macOS-gray">
  <img src="https://img.shields.io/badge/Windows-blue">
  <img src="https://img.shields.io/badge/Linux-orange">
  <img src="https://img.shields.io/badge/iOS-Android-blue">
</p>

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

* **Highly customizable and programmable**, since **Pipy** in itself is a general-purpose network scripting engine.

* **Portable**. Choose your CPU architecture: x86, ARM, MIPS, RISC-V, LoongArch... Choose your operating system: Linux, Windows, macOS, FreeBSD, Android... ZTM runs anywhere.

## Documentation

* [Architecture & Concepts](docs/Architecture-Concepts.md)
* [CLI](docs/CLI.md)
* [ZT-App](docs/ZT-App.md)
* [Agent API](docs/Agent-API.md)
* [Build](docs/Build.md)  

## Quick Start

### Download

The easiest way to get started is download the latest binary release of ZTM from our [release page](https://github.com/flomesh-io/ztm/releases). If you prefer to have your own build from the source, you can follow the instructions in [Build](docs/Build.md).

> The official build releases of ZTM come in two forms of packaging: the CLI tool as a SEA (Single Executable Application), and the desktop application that wraps up the CLI tool and provides a GUI for desktop environments.
>
> In this guide, we'll be only utilizing the CLI for setting up a simple mesh. For more guides, including the usage of the desktop app, please check out our [Wiki](https://github.com/flomesh-io/ztm/wiki).

### CLI Completion

To enable shell completion, run:

```sh
mkdir -p ~/.local/share/ztm/completions
ztm completion bash > ~/.local/share/ztm/completions/ztm.bash
source ~/.local/share/ztm/completions/ztm.bash
```

For zsh users:

```sh
mkdir -p ~/.local/share/ztm/completions
ztm completion zsh > ~/.local/share/ztm/completions/_ztm
fpath=(~/.local/share/ztm/completions $fpath)
autoload -U compinit && compinit
```

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

### Plugins

ZTM supports plugins through **OpenClaw**, an AI-native gateway that integrates ZTM with external systems. Plugins enable messaging, automation, and third-party integrations.

#### Overview

| Component | Purpose |
|-----------|---------|
| OpenClaw | AI-native gateway that routes messages to/from external systems |
| Plugins | Channel adapters that connect OpenClaw to specific platforms |
| ZTM Chat | Built-in chat app for decentralized P2P messaging |

#### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  ZTM User       │────▶│   ZTM Network   │────▶│  OpenClaw       │
│  (Chat App)     │     │   (P2P Mesh)    │     │  (AI Gateway)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │  External       │
                                               │  Systems        │
                                               │  (ztm-chat,     │
                                               │   slack, etc.)  │
                                               └─────────────────┘
```

#### ZTM Chat Plugin

The ZTM Chat plugin connects OpenClaw to ZTM Chat, enabling your AI agent to send and receive decentralized P2P messages with other ZTM users.

---

#### Installation Guide

Follow these steps in order:

#### Step 1: Start ZTM Agent

```sh
# Start the ZTM Agent service
ztm start agent
```

#### Step 2: Install ZTM Chat App

```sh
# Install the Chat app
ztm app install chat

# Verify installation
ztm get app
```

#### Step 3: Create Bot User Account

```sh
# Create a dedicated user account for the bot
ztm user add openclaw-bot
```

#### Step 4: Install OpenClaw

If OpenClaw is not yet installed, download and install it from [OpenClaw Releases](https://github.com/flomesh-io/openclaw/releases):

```sh
# Download the latest OpenClaw for your platform
# Then start the OpenClaw service
openclaw start
```

#### Step 5: Install ZTM Chat Plugin

```sh
# Install from local path (when using ZTM source repository)
openclaw plugins install -l ./extensions/ztm-chat

# Or install from URL (when using published package)
openclaw plugins install -u https://github.com/flomesh-io/ztm/plugins/ztm-chat
```

#### Step 6: Configure the Plugin

Choose one of these methods:

**Option A: Interactive Wizard (Recommended)**

```sh
# Run the setup wizard
npx ztm-chat-wizard

# The wizard will guide you through:
# 1. ZTM Agent URL (default: https://localhost:7777)
# 2. Mesh name
# 3. Bot username (default: openclaw-bot)
# 4. mTLS authentication (optional)
# 5. Security settings
```

**Option B: Manual Configuration**

```sh
# Create config file
mkdir -p ~/.openclaw/channels

cat > ~/.openclaw/channels/ztm-chat.json << 'EOF'
{
  "agentUrl": "https://your-ztm-agent.example.com:7777",
  "meshName": "your-mesh-name",
  "username": "openclaw-bot"
}
EOF
```

For all configuration options, see [ZTM Chat Plugin README](extensions/ztm-chat/README.md).

#### Step 7: Restart OpenClaw

```sh
# Apply the new configuration
openclaw restart
```

#### Step 8: Verify Connection

```sh
# Check channel status
openclaw channels status ztm-chat

# Test connection
openclaw channels status ztm-chat --probe
```

---

#### Plugin Commands

```sh
# Setup wizard
npx ztm-chat-wizard

# Auto-discover existing ZTM configuration
npx ztm-chat-discover

# Check channel status
openclaw channels status ztm-chat

# Probe connection
openclaw channels status ztm-chat --probe

# List connected peers
openclaw channels directory ztm-chat peers

# Enable/disable channel
openclaw channels disable ztm-chat
openclaw channels enable ztm-chat
```

---

#### Troubleshooting

**Connection Failed**

```sh
# Verify ZTM Agent is running
curl https://your-ztm-agent.example.com:7777/api/meshes

# Check mesh name
ztm get mesh

# Check plugin logs
openclaw logs --level debug --channel ztm-chat
```

**No Messages Received**

```sh
# Verify Chat app is installed
ztm get app

# Check bot username
ztm user list
```

For detailed troubleshooting, see [ZTM Chat Plugin README](extensions/ztm-chat/README.md).

## Quick Links:

* [How-to: Using ZTM for Secure Remote Desktop Protocol (RDP) Access](https://github.com/flomesh-io/ztm/wiki/2.-HOWTO-:-using-ztm-for-secure-RDP-access)
* [QuickStart : ZTM Tunnel](docs/ZT-App.md#zt-tunnel) | [Tunnel Demo](https://github.com/flomesh-io/ztm/wiki/2.-HOWTO-:-using-ztm-for-secure-RDP-access#4-configuring-ztm-tunnel-for-rdp-connection)
* [QuickStart : ZTM Proxy](docs/ZT-App.md#zt-proxy)
* [QuickStart : ZTM Terminal](docs/ZT-App.md#zt-terminal)
* [QuickStart : ZTM Script](docs/ZT-App.md#zt-script)
* [QuickStart : ZTM Cloud](docs/ZT-App.md#zt-cloud) | [Cloud Demo](https://github.com/flomesh-io/ztm/wiki/4.-HOWTO-:-File-Sharing-between-ZTM-End-Points#sharing-files-on-macos)

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

* [How-to: Using ZTM for Secure Remote Desktop Protocol (RDP) Access](https://github.com/flomesh-io/ztm/wiki/2.-HOWTO-:-using-ztm-for-secure-RDP-access)
* [QuickStart : ZTM Tunnel](https://github.com/flomesh-io/ztm/blob/main/docs/ZT-App.md#zt-tunnel) | [Tunnel Demo](https://github.com/flomesh-io/ztm/wiki/2.-HOWTO-:-using-ztm-for-secure-RDP-access#4-configuring-ztm-tunnel-for-rdp-connection)
* [QuickStart : ZTM Proxy](https://github.com/flomesh-io/ztm/blob/main/docs/ZT-App.md#zt-proxy)
* [QuickStart : ZTM Terminal](https://github.com/flomesh-io/ztm/blob/main/docs/ZT-App.md#zt-terminal)
* [QuickStart : ZTM Script](https://github.com/flomesh-io/ztm/blob/main/docs/ZT-App.md#zt-script)
* [QuickStart : ZTM Cloud](https://github.com/flomesh-io/ztm/blob/main/docs/ZT-App.md#zt-cloud) | [Cloud Demo](https://github.com/flomesh-io/ztm/wiki/4.-HOWTO-:-File-Sharing-between-ZTM-End-Points#sharing-files-on-macos)

