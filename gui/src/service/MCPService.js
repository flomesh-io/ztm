import { Client } from '@modelcontextprotocol/sdk/client/index.js'
// import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CompatibilityCallToolResultSchema } from '@modelcontextprotocol/sdk/types'
import store from "@/store";
// import { fetch } from '@tauri-apps/plugin-http';

/*
server: {
	url,
	name,
	command,
	env,
	cwd,
	type: stdio|sse|http
}
*/
export default class MCPService {

  // constructor () { }
	getClients() {
		return store.getters['mcp/clients'];
	}
	getClients() {
		return store.getters['mcp/clients'];
	}
	getLogs() {
		return store.getters['mcp/logs'];
	}
	getListTools() {
		return store.getters['mcp/listTools'];
	}
	pushClient(client) {
		store.commit('mcp/pushClient', client);
	}
	pushListTools(listTools) {
		store.commit('mcp/pushListTools', listTools);
	}
	pushLog(key, log) {
		store.commit('mcp/pushLog', key, log);
	}
	disconnectClient(name) {
		store.commit('mcp/disconnectClient', name);
	}
	clearLog(key) {
		store.commit('mcp/clearLog', key);
	}
	uniqueName(toolName,serverName) {
		return `${toolName}___${serverName}`;
	}
  async connectToServer(server) {
		this.disconnectClient(server.name);
		this.clearLog(server.name);
    // now connect
    let client = null
		const headers = {};
		const token = null;
		if (token) {
			const authHeaderName = headerName || "Authorization";
			headers[authHeaderName] = `Bearer ${token}`;
		}
		let transportOptions = {
			// authProvider: serverAuthProvider,
			// eventSourceInit: {
			// 	fetch: (url, init ) => {
			// 		fetch(url, { ...init, headers })
			// 	},
			// },
			requestInit: {
				headers,
			},
		};
    if (server.type === 'stdio') {
      client = await this.connectToStdioServer(server, transportOptions)
    } else if (server.type === 'sse') {
      client = await this.connectToSseServer(server, transportOptions)
    } else if (server.type === 'http') {
      client = await this.connectToStreamableHttpServer(server, transportOptions)
    }

    if (!client) {
      console.error(`Failed to connect to MCP server ${server.url}`)
      return false
    }

    // // reload on change
    // client.setNotificationHandler({ method: 'notifications/tools/list_changed' }, async () => {
    //   await this.reload()
    // })

    // get tools
    const tools = await client.listTools()
    const toolNames = tools.tools.map(tool => this.uniqueName(tool.name,server.name));
    // store
		this.pushClient({
      client,
      server,
			listTools: tools,
      tools: toolNames
    })

    // done
    return true

  }

	// stdio in ztm agent
  async connectToStdioServer(server) {

   //  try {
			
	 // const plm = platform();
   //    // build command and args
   //    const command = plm === 'win32' ? 'cmd' : server.command
   //    const args = plm === 'win32' ? ['/C', `"${server.command}" ${server.url}`] : server.url.split(' ')
   //    let env = {
   //      ...getDefaultEnvironment(),
   //      ...server.env,
   //    }

   //    // clean up double cmd /c with smithery on windows
   //    if (command === 'cmd' && args.length > 0 && args[1].toLowerCase().startsWith('"cmd" /c')) {
   //      args[1] = args[1].slice(9)
   //    }

   //    // if env is empty, remove it
   //    if (Object.keys(env).length === 0) {
   //      env = undefined
   //    }

   //    // working directory
   //    const cwd = server.cwd || undefined

   //    // console.log('MCP Stdio command', plm, command, args, env)

   //    const transport = new StdioClientTransport({
   //      command, args, env, stderr: 'pipe', cwd
   //    })

   //    // start transport to get errors
   //    await transport.start()
   //    transport.stderr?.on('data', async (data) => {
   //      const error = data.toString()
			// 	this.pushLog(server.name, error);
   //    })

   //    // build the client
   //    const client = new Client({
   //      name: `${server?.name}`,
   //      version: '1.0.0'
   //    }, {
   //      capabilities: { tools: {} }
   //    })

   //    client.onerror = (e) => {
			// 	this.pushLog(server.name, e.message);
   //    }

   //    // disable start and connect
   //    transport.start = async () => {}
   //    await client.connect(transport)

   //    // done
   //    return client

   //  } catch (e) {
   //    console.error(`Failed to connect to MCP server ${server.command} ${server.url}:`, e)
   //    this.pushLog(server.name, `Failed to connect to MCP server "${server.command} ${server.url}"\n`)
   //    this.pushLog(server.name, `Error: ${e.message}\n`)
   //    if (e.message.startsWith('spawn')) {
   //      const words = e.message.split(' ')
   //      if (words.length >= 2) {
   //        const cmd = e.message.split(' ')[1]
   //        this.pushLog(server.name, `Command not found: ${cmd}. Please install it and/or add it to your PATH.\n`)
   //      } else {
   //        this.pushLog(server.name, 'Command not found. Please install it and/or add it to your PATH.\n')
   //      }
   //    }
   //  }

  }

  async connectToSseServer(server, transportOptions) {

    try {

      // get transport
      const transport = new SSEClientTransport(
        new URL(server.url), transportOptions
      )
      transport.onerror = (e) => {
        this.pushLog(server.name, e.message)
      }
      transport.onmessage = (message) => {
        console.log('MCP SSE message', message)
      }

      // build the client
      const client = new Client({
        name: `${server?.name}`,
        version: '1.0.0'
      }, {
        capabilities: { tools: {} }
      })

      client.onerror = (e) => {
        this.pushLog(server.name, e.message)
      }

      // connect
      await client.connect(transport)

      // done
      return client


    } catch (e) {
      console.error(`Failed to connect to MCP server ${server.url}:`, e)
      this.pushLog(server.name, e.message)
    }

  }

  async connectToStreamableHttpServer(server, transportOptions) {

    try {

      // get transport
      const transport = new StreamableHTTPClientTransport(
        new URL(server.url), {
					sessionId: undefined,
					...transportOptions,
				}
      )
      transport.onerror = (e) => {
        this.pushLog(server.name, e.message)
      }
      transport.onmessage = (message) => {
        console.log('MCP HTTP message', message)
      }

      // build the client
      const client = new Client({
        name: `${server?.name}`,
        version: '1.0.0'
      }, {
        capabilities: { tools: {} }
      })

      client.onerror = (e) => {
        this.pushLog(server.name, e.message)
      }

      // connect
      await client.connect(transport)

      // done
      return client


    } catch (e) {
      console.error(`Failed to connect to MCP server ${server.url}:`, e)
      this.pushLog(server.name, e.message)
    }

  }  
  
  // disconnect = (client): void => {
  //   client.client.close()
  //   this.clients = this.clients.filter(c => c !== client)
  // }
	
  async fetchListTools(serverName) {
		const clients = this.getClients();
    const client = clients.find(client => client.server.name === serverName)
    if (!client) return []

    const tools = await client.client.listTools();
		return tools.tools.map((tool) => ({
      name: tool.name,
      description: tool.description    
    }))
  }
	
	


  async callTool (uniqueName, args) {

		const clients = this.getClients();
    const client = clients.find(client => client.tools.includes(uniqueName))
    if (!client) {
      throw new Error(`Tool ${uniqueName} not found`)
    }

    // remove unique suffix
    const tool = uniqueName.replace(/___.*/, '')
    console.log('Calling MCP tool', tool, args)

    return await client.client.callTool({
      name: tool,
      arguments: args
    }, CompatibilityCallToolResultSchema)
  }

}