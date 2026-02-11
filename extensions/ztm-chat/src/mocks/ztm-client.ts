// Mock ZTM Agent Server for Integration Testing
// Simulates the ZTM Chat API endpoints

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import type { ZTMChatConfig } from "../types/config.js";
import type { ZTMMessage } from "../api/ztm-api.js";
import type { ZTMChat, ZTMPeer, ZTMUserInfo } from "../api/ztm-api.js";

// Test configuration
export interface MockZTMConfig {
  meshName: string;
  username: string;
  users: ZTMUserInfo[];
  peers: ZTMPeer[];
  chats: ZTMChat[];
  messages: Map<string, ZTMMessage[]>;  // key: "peer→bot" or "creator/group→chat"
  certificate?: string;
  privateKey?: string;
}

export class MockZTMClient {
  private server: ReturnType<typeof createServer> | null = null;
  private port: number;
  private config: MockZTMConfig;
  private lastWatchPrefix: string | null = null;
  private watchPollCount = 0;

  constructor(config: Partial<MockZTMConfig> = {}) {
    this.port = 0;  // Random port
    this.config = {
      meshName: config.meshName || "test-mesh",
      username: config.username || "test-bot",
      users: config.users || [],
      peers: config.peers || [],
      chats: config.chats || [],
      messages: config.messages || new Map(),
      certificate: config.certificate,
      privateKey: config.privateKey,
    };
  }

  get url(): string {
    return `http://localhost:${this.port}`;
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
        this.handleRequest(req, res);
      });
      this.server.listen(this.port, () => {
        // Get actual port
        this.port = (this.server!.address() as { port: number }).port;
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err) => {
          this.server = null;
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url || "/", `http://localhost:${this.port}`);
    const pathname = url.pathname;

    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");

    // Handle OPTIONS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // Route: GET /api/meshes/{meshName}
      if (pathname.match(/^\/api\/meshes\/[^/]+$/) && req.method === "GET") {
        const meshName = pathname.split("/")[3];
        this.handleGetMesh(meshName, res);
        return;
      }

      // Route: GET /api/meshes
      if (pathname === "/api/meshes" && req.method === "GET") {
        this.handleGetMeshes(res);
        return;
      }

      // Route: GET /apps/ztm/chat/api/users
      if (pathname === "/apps/ztm/chat/api/users" && req.method === "GET") {
        this.handleGetUsers(res);
        return;
      }

      // Route: GET /apps/ztm/chat/api/chats
      if (pathname === "/apps/ztm/chat/api/chats" && req.method === "GET") {
        this.handleGetChats(res);
        return;
      }

      // Route: GET /apps/ztm/chat/api/peers/{peer}/messages
      if (pathname.match(/^\/apps\/ztm\/chat\/api\/peers\/[^/]+\/messages$/) && req.method === "GET") {
        const peer = pathname.split("/")[6];
        this.handleGetPeerMessages(peer, url, res);
        return;
      }

      // Route: POST /apps/ztm/chat/api/peers/{peer}/messages
      if (pathname.match(/^\/apps\/ztm\/chat\/api\/peers\/[^/]+\/messages$/) && req.method === "POST") {
        const peer = pathname.split("/")[6];
        this.handleSendPeerMessage(peer, req, res);
        return;
      }

      // Route: GET /api/watch{prefix}
      if (pathname.startsWith("/api/watch") && req.method === "GET") {
        const prefix = url.searchParams.get("prefix") || pathname.replace("/api/watch", "");
        this.handleWatch(prefix, url, res);
        return;
      }

      // 404 for unknown routes
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not Found" }));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: "Internal Server Error" }));
    }
  }

  private handleGetMesh(meshName: string, res: ServerResponse): void {
    if (meshName !== this.config.meshName) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Mesh not found" }));
      return;
    }
    res.writeHead(200);
    res.end(JSON.stringify({
      name: meshName,
      connected: true,
      peers: this.config.peers.length,
    }));
  }

  private handleGetMeshes(res: ServerResponse): void {
    res.writeHead(200);
    res.end(JSON.stringify([
      { name: this.config.meshName, connected: true },
    ]));
  }

  private handleGetUsers(res: ServerResponse): void {
    res.writeHead(200);
    res.end(JSON.stringify(this.config.users));
  }

  private handleGetChats(res: ServerResponse): void {
    res.writeHead(200);
    res.end(JSON.stringify(this.config.chats));
  }

  private handleGetPeerMessages(peer: string, url: URL, res: ServerResponse): void {
    const since = url.searchParams.get("since");
    const before = url.searchParams.get("before");
    const key = `${peer}→${this.config.username}`;
    let messages = this.config.messages.get(key) || [];

    // Filter by since/before
    if (since) {
      messages = messages.filter(m => m.time > Number(since));
    }
    if (before) {
      messages = messages.filter(m => m.time < Number(before));
    }

    res.writeHead(200);
    res.end(JSON.stringify(messages));
  }

  private handleSendPeerMessage(peer: string, req: IncomingMessage, res: ServerResponse): void {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const message: ZTMMessage = JSON.parse(body);
        const key = `${this.config.username}→${peer}`;
        const messages = this.config.messages.get(key) || [];
        messages.push(message);
        this.config.messages.set(key, messages);

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, id: `msg-${Date.now()}` }));
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "Invalid message format" }));
      }
    });
  }

  private handleWatch(prefix: string, url: URL, res: ServerResponse): void {
    const pollingInterval = Number(url.searchParams.get("pollingInterval")) || 2000;
    this.lastWatchPrefix = prefix;
    this.watchPollCount++;

    // Simulate watch response with changes
    const changes = [`${prefix}/new-message`];
    res.writeHead(200);
    res.end(JSON.stringify(changes));
  }

  // Public methods for test manipulation
  addMessage(fromPeer: string, message: ZTMMessage): void {
    const key = `${fromPeer}→${this.config.username}`;
    const messages = this.config.messages.get(key) || [];
    messages.push(message);
    this.config.messages.set(key, messages);
  }

  addUser(user: ZTMUserInfo): void {
    this.config.users.push(user);
  }

  addPeer(peer: ZTMPeer): void {
    this.config.peers.push(peer);
  }

  getWatchPollCount(): number {
    return this.watchPollCount;
  }

  resetWatchState(): void {
    this.watchPollCount = 0;
    this.lastWatchPrefix = null;
  }
}

// Helper to create a complete mock configuration
export function createMockConfig(): MockZTMConfig {
  const now = Date.now();
  return {
    meshName: "test-mesh",
    username: "test-bot",
    users: [
      { username: "alice" },
      { username: "bob" },
    ],
    peers: [
      { username: "alice", endpoint: "alice@192.168.1.10:7777" },
      { username: "bob", endpoint: "bob@192.168.1.11:7777" },
    ],
    chats: [
      {
        creator: "alice",
        group: "test-group",
        members: ["alice", "test-bot"],
        time: now,
        updated: now,
        latest: { time: now, message: "", sender: "alice" },
      },
    ],
    messages: new Map([
      ["alice→test-bot", [
        { time: now - 60000, message: "Hello!", sender: "alice" },
        { time: now - 30000, message: "How are you?", sender: "alice" },
      ]],
      ["test-bot→alice", [
        { time: now - 45000, message: "Hi Alice!", sender: "test-bot" },
      ]],
    ]),
  };
}
