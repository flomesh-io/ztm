# Architecture and Concepts

![ZTM Architecture](https://github.com/user-attachments/assets/62dc4677-fb7d-455e-b773-aababf627fcc)

## Components

Two crucial components of ZTM are the Hub and Agent, forming a decentralized network infrastructure through HTTP/2-based tunnels. This high-speed network enables secure data transmission.

- **ZTM Agent**: Deployed on devices that need to connect to the zero-trust network, including personal computers, servers, or edge devices. It initiates encrypted tunnels and securely forwards device traffic to the ZTM Hub.
- **ZTM Hub**: A distributed access point that establishes encrypted tunnels with each Agent, forwarding requests from the Agents, and achieving multipoint access and high availability.

## Concepts

If the Agent and Hub are physical components, then the network formed by the Agent and Hub is a logical Mesh network, where Agents join the Mesh network as Endpoints.

### Mesh

The ZTM Mesh network, through the distributed deployment of ZTM Hubs and ZTM Agents, forms a secure, encrypted logical network structure. Through strict identity authentication and authorization mechanisms, mTLS encrypted communication, and intelligent routing technology, the Mesh network ensures high security, high availability, and flexibility, forming the foundation of a Zero Trust network.

Each ZTM Hub establishes encrypted tunnels with multiple ZTM Agents, ensuring secure data transmission within the network.

The Mesh network adopts a zero-trust architecture, assuming that each node in the network is untrusted. All nodes must undergo strict identity authentication and authorization to communicate.

### Endpoint

Endpoints are key components in the ZTM network, connecting to the Mesh network as logical nodes through ZTM Agents.

In ZTM, an Endpoint is a logical node that needs to connect to the ZTM network. These nodes connect to the Mesh network through ZTM Agents, achieving secure communication and data transmission.

**Registration**: Endpoints need to register in the ZTM network via API interfaces. During registration, Endpoints provide unique identifiers and necessary information such as Hub addresses, certificates, and keys.

**Authentication**: Registered Endpoints establish secure connections with ZTM Hubs through mTLS encryption and certificate verification mechanisms, ensuring communication confidentiality and integrity.

**Connection Establishment**: Endpoints use ZTM Agents to establish encrypted tunnels with ZTM Hubs, achieving secure connections to the Mesh network.

### App

The ZT-App framework is an application development framework based on ZTM, providing a standardized development interface to make it easier for developers to build decentralized applications. The design goals of the ZT-App framework are "simple, easy to use, and secure," offering convenient development tools for developers.

Apps are applications built on the ZT-App framework. There are three built-in Apps in ZTM:

- **zt-tunnel**: A zero-trust tunnel that eliminates physical distance limitations, allowing you to access your devices from anywhere. For example, you can run zt-tunnel on your home computer and access it from your office computer. zt-tunnel integrates the intranet penetration function from version 0.0.4 into a service + port model, transforming it into outbound and inbound tunnel modes, making device access easier.
- **zt-proxy**: A zero-trust proxy that allows you to access your devices from anywhere. For example, you can run zt-proxy on your home computer and access all your devices from your office computer, as if they were in the same local area network.
- **zt-terminal**: A zero-trust terminal, a remote command-line tool based on "device + certificate" identity authentication and access control. Once authorized, one device can execute shell commands on another device.

### ZTM API

[ZTM API](./Agent-API.md) is provided by ZTM Agent, offering comprehensive control and management over the four resources: Meshes, Endpoints, Apps, and files.