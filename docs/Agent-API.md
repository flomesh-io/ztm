# Agent REST API

This REST API is organized into 4 types of resources that can be accessed by the standard HTTP semantics. The 4 types of resources are:

- Meshes
- Endpoints
- Services
- Ports

A **Mesh** is the root resource of everything. It contains a configuration providing the required information for joining a mesh.

**Endpoints** are automatically registered to the mesh when an agent joins in, and discovered by agents on other endpoints in the same mesh.

**Services** are identified by `protocol/name`, where `protocol` can be either `'tcp'` or `'udp'`. You must specify the endpoint when creating a service. Multiple endpoints can provide services by the same name.

**Ports** are identified by `ip/protocol/port`, where `protocol` can be either `'tcp'` or `'udp'`. You need to specify the endpoint and the targeted service when creating a port. 

## Mesh

GET returns:

```json
{
    "name": "xxx",
    "ca": "<PEM>",
    "agent": {
        "id": "<UUID>",
        "name": "<endpoint name>",
        "username": "xxx",
        "certificate": "<PEM>",
        "privateKey": "<PEM>"
    },
    "bootstraps": [
        "<host>:<port>"
    ],
    "connected": true,
    "errors": [
        {
            "time": "ttt",
            "message": "xxx"
        }
    ]
}
```

POST requires:

```json
{
    "ca": "<PEM>",
    "agent": {
        "name": "<endpoint name>",
        "certificate": "<PEM>",
        "privateKey": "<PEM>"
    },
    "bootstraps": [
        "<host>:<port>"
    ]
}
```

Paths and methods:

```
GET /api/meshes
GET /api/meshes/{name}
GET /api/meshes/{name}/log
GET /api/meshes/{name}/ca
GET /api/meshes/{name}/agent/certificate
GET /api/meshes/{name}/agent/key
POST /api/meshes/{name}
POST /api/meshes/{name}/ca
POST /api/meshes/{name}/agent/certificate
POST /api/meshes/{name}/agent/key
DELETE /api/meshes/{name}
```

> For `/api/meshes/.../ca`, `/api/meshes/.../agent/certificate`, `/api/meshes/.../agent/key` paths, the request/response body is a PEM file in plain text.

## Endpoint

```json
{
    "id": "<UUID>",
    "name": "xxx",
    "certificate": "<PEM>",
    "isLocal": false,
    "ip": "x.x.x.x",
    "port": 12345,
    "heartbeat": 67890,
    "online": true
}
```

Paths and methods:

```
GET /api/meshes/{meshName}/endpoints
GET /api/meshes/{meshName}/endpoints/{uuid}
GET /api/meshes/{meshName}/endpoints/{uuid}/log
```

## Service

GET returns:

```json
{
    "name": "xxx",
    "protocol": "tcp|udp",
    "endpoints": [
        {
            "id": "<UUID>",
            "name": "xxx"
        }
    ],
    "isDiscovered": true,
    "isLocal": true,
    "host": "<address>",
    "port": 12345
}
```

POST requires:

```json
{
    "host": "<address>",
    "port": 12345
}
```

Paths and methods:

```
GET /api/meshes/{meshName}/services
GET /api/meshes/{meshName}/services/{protocol}/{name}
GET /api/meshes/{meshName}/endpoints/{uuid}/services
GET /api/meshes/{meshName}/endpoints/{uuid}/services/{protocol}/{name}
POST /api/meshes/{meshName}/endpoints/{uuid}/services/{protocol}/{name}
DELETE /api/meshes/{meshName}/endpoints/{uuid}/services/{protocol}/{name}
```

## Port

GET returns:

```json
{
    "protocol": "tcp|udp",
    "listen": {
        "ip": "x.x.x.x",
        "port": 12345
    },
    "target": {
        "service": "xxx"
    },
    "open": true,
    "error": "xxx"
}
```

POST requires:

```json
{
    "target": {
        "service": "xxx"
    }
}
```

Paths and methods:

```
GET /api/meshes/{meshName}/endpoints/{uuid}/ports
GET /api/meshes/{meshName}/endpoints/{uuid}/ports/{ip}/{protocol}/{port}
POST /api/meshes/{meshName}/endpoints/{uuid}/ports/{ip}/{protocol}/{port}
DELETE /api/meshes/{meshName}/endpoints/{uuid}/ports/{ip}/{protocol}/{port}
```
