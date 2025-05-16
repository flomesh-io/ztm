import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CompatibilityCallToolResultSchema } from '@modelcontextprotocol/sdk/types'
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
export default class MCP {

  clients = []
  logs = {}
  
  constructor () {
    this.clients = []
    this.logs = {}
  }

  private connectToServer = async(server) => {

    // clear logs
    this.logs[server.name] = []

    // now connect
    let client = null
    if (server.type === 'stdio') {
      client = await this.connectToStdioServer(server)
    } else if (server.type === 'sse') {
      client = await this.connectToSseServer(server)
    } else if (server.type === 'http') {
      client = await this.connectToStreamableHttpServer(server)
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
    const toolNames = tools.tools.map(tool => this.uniqueToolName(server, tool.name))

    // store
    this.clients.push({
      client,
      server,
      tools: toolNames
    })

    // done
    return true

  }

  private connectToStdioServer = async(server) => {

    try {

      // build command and args
      const command = process.platform === 'win32' ? 'cmd' : server.command
      const args = process.platform === 'win32' ? ['/C', `"${server.command}" ${server.url}`] : server.url.split(' ')
      let env = {
        ...getDefaultEnvironment(),
        ...server.env,
      }

      // clean up double cmd /c with smithery on windows
      if (command === 'cmd' && args.length > 0 && args[1].toLowerCase().startsWith('"cmd" /c')) {
        args[1] = args[1].slice(9)
      }

      // if env is empty, remove it
      if (Object.keys(env).length === 0) {
        env = undefined
      }

      // working directory
      const cwd = server.cwd || undefined

      // console.log('MCP Stdio command', process.platform, command, args, env)

      const transport = new StdioClientTransport({
        command, args, env, stderr: 'pipe', cwd
      })

      // start transport to get errors
      await transport.start()
      transport.stderr?.on('data', async (data: Buffer) => {
        const error = data.toString()
        this.logs[server.name].push(error)
      })

      // build the client
      const client = new Client({
        name: `${server?.name}-client`,
        version: '1.0.0'
      }, {
        capabilities: { tools: {} }
      })

      client.onerror = (e) => {
        this.logs[server.name].push(e.message)
      }

      // disable start and connect
      transport.start = async () => {}
      await client.connect(transport)

      // done
      return client

    } catch (e) {
      console.error(`Failed to connect to MCP server ${server.command} ${server.url}:`, e)
      this.logs[server.name].push(`Failed to connect to MCP server "${server.command} ${server.url}"\n`)
      this.logs[server.name].push(`Error: ${e.message}\n`)
      if (e.message.startsWith('spawn')) {
        const words = e.message.split(' ')
        if (words.length >= 2) {
          const cmd = e.message.split(' ')[1]
          this.logs[server.name].push(`Command not found: ${cmd}. Please install it and/or add it to your PATH.\n`)
        } else {
          this.logs[server.name].push('Command not found. Please install it and/or add it to your PATH.\n')
        }
      }
    }

  }

  private connectToSseServer = async(server) => {

    try {

      // get transport
      const transport = new SSEClientTransport(
        new URL(server.url)
      )
      transport.onerror = (e) => {
        this.logs[server.name].push(e.message)
      }
      transport.onmessage = (message: any) => {
        console.log('MCP SSE message', message)
      }

      // build the client
      const client = new Client({
        name: `${server?.name}-client`,
        version: '1.0.0'
      }, {
        capabilities: { tools: {} }
      })

      client.onerror = (e) => {
        this.logs[server.name].push(e.message)
      }

      // connect
      await client.connect(transport)

      // done
      return client


    } catch (e) {
      console.error(`Failed to connect to MCP server ${server.url}:`, e)
      this.logs[server.name].push(e.message)
    }

  }

  private connectToStreamableHttpServer = async(server) => {

    try {

      // get transport
      const transport = new StreamableHTTPClientTransport(
        new URL(server.url)
      )
      transport.onerror = (e) => {
        this.logs[server.name].push(e.message)
      }
      transport.onmessage = (message: any) => {
        console.log('MCP HTTP message', message)
      }

      // build the client
      const client = new Client({
        name: `${server?.name}-client`,
        version: '1.0.0'
      }, {
        capabilities: { tools: {} }
      })

      client.onerror = (e) => {
        this.logs[server.name].push(e.message)
      }

      // connect
      await client.connect(transport)

      // done
      return client


    } catch (e) {
      console.error(`Failed to connect to MCP server ${server.url}:`, e)
      this.logs[server.name].push(e.message)
    }

  }  
  
  private disconnect = (client): void => {
    client.client.close()
    this.clients = this.clients.filter(c => c !== client)
  }

  getListTools = async (serverName) => {

    const client = this.clients.find(client => client.server.name === serverName)
    if (!client) return []

    const tools = await client.client.listTools()
    return tools.tools.map((tool) => ({
      name: tool.name,
      description: tool.description    
    }))

  }


  callTool = async (name, args) => {

    const client = this.clients.find(client => client.tools.includes(name))
    if (!client) {
      throw new Error(`Tool ${name} not found`)
    }

    // remove unique suffix
    const tool = this.originalToolName(name)
    console.log('Calling MCP tool', tool, args)

    return await client.client.callTool({
      name: tool,
      arguments: args
    }, CompatibilityCallToolResultSchema)

  }

  originalToolName(name) {
    return name.replace(/___....$/, '')
  }

  protected uniqueToolName(server, name) {
    return `${name}___${server.name}`
  }

}