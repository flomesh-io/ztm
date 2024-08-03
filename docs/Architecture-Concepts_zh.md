# 架构和概念

![ZTM Architecture](https://github.com/user-attachments/assets/62dc4677-fb7d-455e-b773-aababf627fcc)

## 组件

ZTM 的两个重要组件 Hub 和 Agent，组建基于 HTTP/2 的隧道，通过隧道组成去中心化的网络基础设施。在这个高速的网络上，我们可以进行数据的安全传输。

- ZTM Agent：部署在需要接入零信任网络的设备上，包括个人计算机、服务器或边缘设备上，负责启动加密隧道并将设备的流量安全地转发到 ZTM Hub。
- ZTM Hub：分布式部署的接入点，分布式部署的接入点，与每个 Agent 建立加密隧道，转发来自 Agent 的请求，实现多点接入和高可用性。

## 概念

如果 Agent 和 Hub 是物理组件，那么 Agent 与 Hub 组成的就是一张逻辑的 Mesh 网络，Agent 以 Endpoint 的角色加入 Mesh 网络。

### Mesh

ZTM 的 Mesh 网络通过 ZTM Hub 和 ZTM Agent 的分布式部署，形成一个安全、加密的逻辑网络结构。通过严格的身份验证和授权机制、mTLS 加密通信以及智能路由技术，Mesh 网络确保了高安全性、高可用性和灵活性，是实现 Zero Trust 网络的重要基础。

每个 ZTM Hub 与多个 ZTM Agent 建立加密隧道，确保网络中的数据传输安全。

Mesh 网络采用零信任架构，假设网络中的每个节点都是不可信的，所有节点都需要经过严格的身份验证和授权才能进行通信。

### Endpoint

Endpoint 是 ZTM 网络中的关键组件，通过 ZTM Agent 以逻辑节点的形式接入到 Mesh 网络中。

在 ZTM 中，Endpoint 是需要接入 ZTM 网络的逻辑节点。这些节点通过 ZTM Agent 以 Endpoint 的角色接入到 Mesh 网络中，实现安全的通信和数据传输。

**注册**：Endpoint 需要通过 API 接口在 ZTM 网络中注册。注册时，Endpoint 提供唯一标识符和必要的信息，如 Hub 地址、证书和密钥。

**认证**：注册后的 Endpoint 通过 mTLS 加密和证书验证机制与 ZTM Hub 建立安全连接，确保通信的机密性和完整性。

**建立连接**：Endpoint 使用 ZTM Agent 与 ZTM Hub 建立加密隧道，实现与 Mesh 网络的安全连接。

### App

ZT-App 框架是基于 ZTM 的应用开发框架，提供了一套标准化的开发接口，使开发者能够更加轻松地构建去中心化的应用。ZT-App 框架的设计目标是“简单、易用、安全”，为开发者提供便捷的开发工具。

App 是基于 ZT-App 框架构建的应用。在 ZTM 中有三个内置的 App：

- **zt-tunnel**：零信任隧道，消除了物理距离的限制，让你可以在任何地方访问你的设备。例如，你可以在家里的电脑上运行 zt-tunnel，然后在办公室的电脑上访问家里的电脑。zt-tunnel 将 0.0.4 版本中的内网穿透功能整合为 service + port 模型，并转换为隧道的 outbound 和 inbound 模式，使访问设备变得更加简便。
- **zt-proxy**：零信任代理，让你可以从任何地方访问你的设备。例如，你可以在家里的电脑上运行 zt-proxy，然后在办公室的电脑上访问家里的所有设备，就像它们在同一个局域网中一样。
- **zt-terminal**：零信任终端，基于“设备 + 证书”身份认证和访问控制的远程命令行工具。获得授权后，一个设备可以在另一个设备上执行 shell 命令。

### ZTM API

[ZTM API](./Agent-API.md) 由 ZTM Agent 提供，通过这些 API 可以对 Meshes、Endpoints、Apps 和文件这四个资源进行全面的控制和管理。
