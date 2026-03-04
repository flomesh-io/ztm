# Agent API

The Agent API is organized into 4 types of resources that can be accessed by standard HTTP semantics. The 4 types of resources are:

- Meshes
- Endpoints
- Apps
- Files

A **Mesh** is the root resource of everything. It contains a configuration providing required information for joining a mesh.

**Endpoints** are automatically registered to the mesh when an agent joins in, and discovered by agents on other endpoints in the same mesh.

**Apps** are bundles of script files written in [PipyJS](https://github.com/flomesh-io/pipy). They can be installed locally or published to the mesh for remote installation on other endpoints. Some builtin apps, including `tunnel`, `proxy` and `terminal`, are available for use without the need of an installation.

**Files** can be stored in the mesh (on multiple endpoints) and accessible from other endpoints, or stored locally (in the local database) for private access only.

In addtion to the above resource types, apps can provide extra resource types via the Agent API. For example, the `tunnel` app provides 2 types of resources:

- Inbound
- Outbound

Both **Inbound** and **Outbound** resources are identified by `protocol/name`, where `protocol` can be either `'tcp'` or `'udp'`. You can create as many Inbound and Outbound resources as you like on any endpoint. Multiple Inbound and Outbound resources with the same `protocol/name` are connected to each other to form a **tunnel**.

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

## App

GET returns:

```json
{
    "name": "xxx",
    "tag": "yyy",
    "provider": "zzz",
    "isBuiltin": false,
    "isDownloaded": true,
    "isPublished": false,
    "isRunning": true
}
```

POST requires:

```json
{
    "isPublished": false,
    "isRunning": true
}
```

Paths and methods:

```
GET /api/meshes/{meshName}/apps
GET /api/meshes/{meshName}/endpoints/{uuid}/apps
GET /api/meshes/{meshName}/endpoints/{uuid}/apps/{provider}/{name[@tag]}
POST /api/meshes/{meshName}/endpoints/{uuid}/apps/{provider}/{name[@tag]}
DELETE /api/meshes/{meshName}/endpoints/{uuid}/apps/{provider}/{name[@tag]}
```

## File

GET returns metainfo:

```json
{
    "size": 1024,
    "time": 1721711888888,
    "hash": "012345678abcdef",
    "sources": [
        "endpoint-id-1",
        "endpoint-id-2"
    ]
}
```

Or returns raw binary content for `/file-data` based paths.

Paths and methods:

```
GET /api/meshes/{meshName}/files[?since={time}]
GET /api/meshes/{meshName}/files/{pathname}
DELETE /api/meshes/{meshName}/files/{pathname}
GET /api/meshes/{meshName}/file-data/{pathname}
POST /api/meshes/{meshName}/file-data/{pathname}
DELETE /api/meshes/{meshName}/file-data/{pathname}
```

## Inbound

GET returns:

```json
{
    "protocol": "tcp|udp",
    "listens": [
        {
            "ip": "x.x.x.x",
            "port": 12345,
            "open": true,
            "error": "xxx"
        }
    ],
    "exits": [
        "endpoint-id-1",
        "endpoint-id-2"
    ]
}
```

POST requires:

```json
{
    "listens": [
        {
            "ip": "x.x.x.x",
            "port": 12345
        }
    ],
    "exits": [
        "endpoint-id-1",
        "endpoint-id-2"
    ]
}
```

Paths and methods:

```
GET /api/meshes/{meshName}/apps/ztm/tunnel/api/endpoints/{uuid}/inbound
GET /api/meshes/{meshName}/apps/ztm/tunnel/api/endpoints/{uuid}/inbound/{protocol}/{name}
POST /api/meshes/{meshName}/apps/ztm/tunnel/api/endpoints/{uuid}/inbound/{protocol}/{name}
DELETE /api/meshes/{meshName}/apps/ztm/tunnel/api/endpoints/{uuid}/inbound/{protocol}/{name}
```

## Outbound

GET returns:

```json
{
    "protocol": "tcp|udp",
    "targets": [
        {
            "host": "xxx",
            "port": 12345
        }
    ],
    "entrances": [
        "endpoint-id-1",
        "endpoint-id-2"
    ]
}
```

POST requires:

```json
{
    "targets": [
        {
            "host": "xxx",
            "port": 12345
        }
    ],
    "entrances": [
        "endpoint-id-1",
        "endpoint-id-2"
    ]
}
```

Paths and methods:

```
GET /api/meshes/{meshName}/apps/ztm/tunnel/api/endpoints/{uuid}/outbound
GET /api/meshes/{meshName}/apps/ztm/tunnel/api/endpoints/{uuid}/outbound/{protocol}/{name}
POST /api/meshes/{meshName}/apps/ztm/tunnel/api/endpoints/{uuid}/outbound/{protocol}/{name}
DELETE /api/meshes/{meshName}/apps/ztm/tunnel/api/endpoints/{uuid}/outbound/{protocol}/{name}
```

## Utility

Paths and methods:

```
GET /ok
GET /version
GET /api/version
```

### `GET /ok`

Health check. Returns the plain text string `OK`.

### `GET /version`

Returns the output of `ztm version` as a plain text string.

### `GET /api/version`

Returns ZTM and Pipy version info.

```json
{
    "ztm": {
        "version": "x.y.z",
        "commit": "abc123",
        "date": "..."
    },
    "pipy": "x.y.z"
}
```

## OpenClaw

Paths and methods:

```
GET  /api/openclaw/status
GET  /api/openclaw/agents
GET  /api/openclaw/session/{agent}
GET  /api/openclaw/session-history/{agent}/{session}
POST /api/openclaw/chat/{agent}
```

### `GET /api/openclaw/status`

Executes `openclaw status --json` and returns the stdout as plain text. Stderr is written to the ZTM log.

### `GET /api/openclaw/agents`

Executes `openclaw agents list --json` and returns the stdout as plain text. Stderr is written to the ZTM log.

### `GET /api/openclaw/session/{agent}`

Returns the session list for the named agent.

- `{agent}`: the agent name (e.g. `main`)

Executes `openclaw session --agent {agent} --json` and returns the stdout as plain text. Stderr is written to the ZTM log.

Example:

```
curl localhost:7777/api/openclaw/session/main
```

### `GET /api/openclaw/session-history/{agent}/{session}`

Returns the full conversation history of a session as raw JSONL content.

- `{agent}`: the agent name (e.g. `main`)
- `{session}`: the session UUID (e.g. `1df79641-ec12-4607-8e44-10d83d89e58d`)

Reads from `~/.openclaw/agents/{agent}/sessions/{session}.jsonl`. Returns 404 if the file does not exist.

Example:

```
curl localhost:7777/api/openclaw/session-history/main/1df79641-ec12-4607-8e44-10d83d89e58d
```

### `POST /api/openclaw/chat/{agent}`

Sends a message to the named OpenClaw agent.

- `{agent}`: the agent name (e.g. `main`)
- Request body: plain text message content

Executes `openclaw agent --agent {agent} --message {body} --json` and returns the stdout as plain text. Stderr is written to the ZTM log.

Example:

```
curl -d 'hello, buddy' localhost:7777/api/openclaw/chat/main
```
