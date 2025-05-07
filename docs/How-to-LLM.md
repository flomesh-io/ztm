# How to do LLM on ZTM

LLM applications are distributed in nature. Not only are the LLM services often provided remotely, but also the various tools and services invoked by the LLM to interact with the outside world. ZTM can be handy for connecting your application to all these services via a secure private mesh, allowing you to route requests, secure access tokens, protect private data transfer and tunnel into LANs behind gateways and firewalls.

## Terminology

### Service

A software that accepts a request, does a certain job, and then responds with a result. Such as an LLM chat service exposed as REST API, or a weather query tool that speaks MCP. A service can run locally or on a remote device, as long as it provides a means for communication with your application. It can be a TCP listening port, or the standard I/O to the process in the case of MCP.

### Route

A route maps an HTTP request to a certain *service* according to its path. By using routes, we can expose multiple services to our application via a single local listening port.

### Endpoint (EP)

A device running the ZTM agent software. It can be your laplop, your cell phone, Rasberry Pi or a cloud-deployed VM.

> A *service* doesn't have to run on an EP (although in many cases they do). As long as the service can be reached via some EP, your application will have access to it. In other word, EPs, or specifically the ZTM agents, act as a proxy that forwards your requests to the actual service.

### User

An EP always joins a ZTM mesh under the name of some *user*. That means every EP has a definite owner. The owner always has full control over its own EPs. They can, for example, set up *service* access info, or edit *route* table on their EPs. No other users, including the *root* user, has the right to do so. EP owners can make changes on their EPs locally or remotely.

## CLI

One can set up a mesh for LLM applications by using the ZTM CLI. All commands related to LLM setup begin with `ztm llm`. Specifically, you can type `ztm llm help` to see the CLI usage info.

### Set up services

To set up a service, required information includes:

* A name - whatever you wish
* Kind - `llm` or `tool`
* Protocol - such as `openai` or `mcp`
* Target - as to how the service can be accessed
  - Address - an URL exposing the service, or a pathname where the service executable can be found
  - Headers - (optional) HTTP headers to be added in the requests, useful for embedding API tokens and whatnot
  - Body - (optional) A JSON object to be mixed into the request body
  - Arguments - (optional) Command line arguments when using a service executable
  - Environment - (optional) Environment variables when using a service executable

Use `ztm llm create svc` to create a service on the current EP. For example,

```
ztm llm create svc my-llm-123 --kind llm --protocol openai --target address=http://api.awesomellm.com/v100 'headers.authorization=Bearer xxxxxxxx'
```

After that, you can verify your settings by listing all services created so far:

```
ztm llm get svc
```

Or view the details of it:

```
ztm llm describe svc my-llm-123
```

> Services created on an EP are visible to all other EPs in the same mesh. However, users won't see the *target* information that reveals how the service can be accessed, except the EP owner him/herself.

> To create a service on a remote EP, insert `ep <ep name>` right after `ztm` in your command. For example,
> ```
> ztm ep my-ep-1 llm create svc ...
> ```

### Set up routes

To allow your application to contact with a service, you need to set up a *route* that maps the service to a locally accessible HTTP path. Required information for setting up a route includes:

* Path - HTTP request path. For example, `/my-llm/abc/latest`
* Service - Which service to map to
  - Name - Name of the service
  - Kind - (optional) Only needed when there are duplicated service names
  - Endpoint - (optional) Only needed when there are duplicated service names

Use `ztm llm create rt` to create a route on the current EP. For example,

```
ztm llm create rt /my-llm/abc/latest --service my-llm-123
```

After that, you can verify your settings by listing all routes created on the current EP:

```
ztm llm get rt
```

Or view the details of it:

```
ztm llm describe rt /my-llm/abc/latest
```

All routed services can be accessed via *local TCP port 7777* (the ZTM agent service port) with HTTP path in the following form:

```
http://localhost:7777/api/meshes/<mesh name>/apps/ztm/llm/svc/<route path>
```

For example, the route we just created above will open an HTTP endpoint at:

```
http://localhost:7777/api/meshes/my-llm-mesh/apps/ztm/llm/svc/my-llm/abc/latest
```

### Delete services and routes

Use command `ztm llm delete` to delete services or routes that you've created. For example,

```
ztm llm delete svc my-llm-123
ztm llm delete rt /my-llm/abc/latest
```

## REST API

All operations supported by the CLI are also ready to use through the ZTM agent service port. It allows LLM applications to discover or configure services and routes they need.

### Discover services in the mesh

Request:

```
GET http://localhost:7777/api/meshes/<mesh name>/apps/ztm/llm/api/services
```

Response:

```json
{
    "endpoints": {
        // Details about each EP referenced from the service info
        "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx": {
            "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
            "name": "my-ep-001",
            "username": "root",
            "ping": 2,
            // ...
            "online": true
        }
    },
    "services": [
        // List of services with details
        {
            "name": "world-weather",
            "kind": "tool",
            "protocol": "mcp",
            "metainfo": {
                "version": "1.2.3",
                "provider": "My Awesome Team",
                "description": "World #1 Weather Service"
            },
            "endpoint": {
                "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            },
            "localRoutes": [
                {
                    "path": "/info/weather/v1/"
                }
            ]
        }
    ]
}
```

### Discover local routes

Request:

```
GET http://localhost:7777/api/meshes/<mesh name>/apps/ztm/llm/api/routes
```

Response:

```json
{
    "endpoints": {
        // Details about each EP referenced from the route info
        "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx": {
            "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
            "name": "my-ep-001",
            "username": "root",
            "ping": 2,
            // ...
            "online": true
        }
    },
    "routes": [
        // List of routes with details
        {
            "path": "/info/weather/v1/",
            "service": {
                "name": "world-weather",
                "kind": "tool",
                "endpoint": {
                    "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                }
            }
        }
    ]
}
```

### Configure local routes

To create a route, *POST* to the following address:

```
http://localhost:7777/api/meshes/<mesh name>/apps/ztm/llm/api/routes/<your desired path>
```

with the following JSON content:

```json
{
    "service": {
        "name": "xxx", // Name of the service you wish to route to
        "kind": "mcp", // Kind of the service - "llm" or "tool"
        "endpoint": {
            // ID of the endpoint where the service is set up
            // You can find the endpoint ID in the discovery info shown earlier
            "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        }
    }
}
```

To delete a route, send the following request:

```
DELETE http://localhost:7777/api/meshes/<mesh name>/apps/ztm/llm/api/routes/<path to delete>
```

### Configure services

Services are usually configured by hand, either via the CLI or via the GUI in a browser. That said, the APIs for doing that are listed here just for completeness.

Send *GET* to view details, send *POST* to create or change, send *DELETE* to delete:

```
GET    http://localhost:7777/api/meshes/<mesh name>/apps/ztm/llm/api/endpoints/<ep id>/services/<kind>/<name>
POST   http://localhost:7777/api/meshes/<mesh name>/apps/ztm/llm/api/endpoints/<ep id>/services/<kind>/<name>
DELETE http://localhost:7777/api/meshes/<mesh name>/apps/ztm/llm/api/endpoints/<ep id>/services/<kind>/<name>
```

When posting, the request body should contain the following information:

```json
{
    "protocol": "mcp", // Can be "openai" or "mcp"
    "metainfo": { // Metainfo is entirely optional and flexible
        "version": "vvv",
        "provider": "myself",
        "description": "World Weather Service"
    },
    "target": {
        "address": "http://api.llm-example.com/chat", // Mandatory
        "headers": { // Optional
            "authorization": "Bearer 123456abcdef"
        },
        "body": { // Optional
            "model": "chatgpt-super2077"
        },
        "argv": [ // Optional
            "-use-stdio"
        ],
        "env": { // Optional
            "ACCESS_TOKEN": "123456abcdef"
        }
    }
}
```
