// ZTM Agent API Client
// Handles HTTP communication with remote ZTM Agent for Chat operations
// Supports both direct storage API access and Chat App HTTP endpoints

import type { ZTMChatConfig } from "./config.js";
import { logger as ztmLogger } from "./logger.js";

// Use actual logger if available, fallback to console
const logger: {
  debug?: (...args: unknown[]) => void;
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
} = ztmLogger || {
  debug: (...args: unknown[]) => console.debug("[ZTM API]", ...args),
  info: (...args: unknown[]) => console.info("[ZTM API]", ...args),
  warn: (...args: unknown[]) => console.warn("[ZTM API]", ...args),
  error: (...args: unknown[]) => console.error("[ZTM API]", ...args),
};

// ZTM Message interface - matches ZTM Agent API format
export interface ZTMMessage {
  time: number;
  message: string;
  sender: string;
}

// ZTM Peer interface
export interface ZTMPeer {
  username: string;
  endpoint?: string;
}

// ZTM User Info interface
export interface ZTMUserInfo {
  username: string;
  endpoint?: string;
}

// ZTM Mesh Info interface - matches /api/meshes/{name} response
export interface ZTMMeshInfo {
  name: string;
  connected: boolean;
  endpoints: number;
  errors?: Array<{ time: string; message: string }>;
}

// ZTM Chat interface - matches /apps/ztm/chat/api/chats response
export interface ZTMChat {
  peer?: string;
  creator?: string;
  group?: string;
  name?: string;
  members?: string[];
  time: number;
  updated: number;
  latest: ZTMMessage;
}

// ZTM API Client interface
export interface ZTMApiClient {
  // Mesh operations
  getMeshInfo(): Promise<ZTMMeshInfo>;

  // User/Peer discovery
  discoverUsers(): Promise<ZTMUserInfo[]>;
  discoverPeers(): Promise<ZTMPeer[]>;

  // Chat operations (direct storage-based implementation)
  getChats(): Promise<ZTMChat[]>;
  getPeerMessages(peer: string, since?: number, before?: number): Promise<ZTMMessage[] | null>;
  sendPeerMessage(peer: string, message: ZTMMessage): Promise<boolean>;

  // Group operations (future)
  getGroups(): Promise<ZTMChat[]>;
  getGroupMessages(creator: string, group: string): Promise<ZTMMessage[] | null>;

  // File operations
  addFile(data: ArrayBuffer): Promise<string | null>;
  getFile(owner: string, hash: string): Promise<ArrayBuffer | null>;

  // Watch mechanism for real-time updates
  watchChanges(prefix: string): Promise<string[]>;

  // Direct storage API methods (MVP implementation)
  /** Send message using direct storage API */
  sendMessageViaStorage(peer: string, message: ZTMMessage): Promise<boolean>;
  /** Receive messages using direct storage API */
  receiveMessagesViaStorage(peer: string): Promise<ZTMMessage[] | null>;
  /** Discover active peers by scanning shared storage */
  discoverUsersViaStorage(): Promise<ZTMUserInfo[]>;
}

// Default timeout for API requests (in milliseconds)
const DEFAULT_TIMEOUT = 15000;

// Create fetch with timeout support
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${DEFAULT_TIMEOUT}ms`);
    }
    throw error;
  }
}

// Create ZTM API Client
export function createZTMApiClient(config: ZTMChatConfig): ZTMApiClient {
  const baseUrl = config.agentUrl.replace(/\/$/, "");

  // Generic request handler
  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    additionalHeaders?: Record<string, string>
  ): Promise<T> {
    const url = `${baseUrl}${path}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...additionalHeaders,
    };

    const response = await fetchWithTimeout(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`ZTM API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Handle different response types
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return (await response.json()) as T;
    }

    // For non-JSON responses
    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  // Handle errors gracefully
  async function safeRequest<T>(
    fallback: T,
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    try {
      return await request<T>(method, path, body);
    } catch {
      return fallback;
    }
  }

  const lastSeenTimes = new Map<string, number>();

  // ZTM Chat stores messages as [{time, message:{text}}, ...]
  function parseMessageFile(fileContent: unknown, peer: string): ZTMMessage[] {
    const entries = Array.isArray(fileContent) ? fileContent : [fileContent];
    const result: ZTMMessage[] = [];
    for (const entry of entries) {
      if (!entry?.time) continue;
      const messageText = typeof entry.message === 'object' && entry.message !== null
        ? (entry.message.text || JSON.stringify(entry.message))
        : String(entry.message || '');
      result.push({
        time: entry.time,
        message: messageText,
        sender: entry.sender || peer,
      });
    }
    return result;
  }

  async function listFiles(): Promise<Record<string, { hash?: string; size?: number; time?: number }>> {
    return request<Record<string, { hash?: string; size?: number; time?: number }>>("GET", `/api/meshes/${config.meshName}/files`);
  }

  async function readFile<T = unknown>(filePath: string): Promise<T> {
    return request<T>("GET", `/api/meshes/${config.meshName}/file-data${filePath}`);
  }

  async function writeFile(filePath: string, data: unknown): Promise<void> {
    await request("POST", `/api/meshes/${config.meshName}/file-data${filePath}`, data);
  }

  const peerMessagePattern = new RegExp(
    `^/apps/ztm/chat/shared/([^/]+)/publish/peers/${config.username}/messages/`
  );

  const client: ZTMApiClient = {
    async getMeshInfo(): Promise<ZTMMeshInfo> {
      return request<ZTMMeshInfo>("GET", `/api/meshes/${config.meshName}`);
    },

    async discoverUsers(): Promise<ZTMUserInfo[]> {
      return client.discoverUsersViaStorage();
    },

    async discoverPeers(): Promise<ZTMPeer[]> {
      const users = await client.discoverUsersViaStorage();
      return users.map(u => ({ username: u.username }));
    },

    async discoverUsersViaStorage(): Promise<ZTMUserInfo[]> {
      try {
        const fileList = await listFiles();
        const userSet = new Set<string>();

        for (const filePath of Object.keys(fileList)) {
          const match = filePath.match(/^\/apps\/ztm\/chat\/shared\/([^\/]+)\/publish\/peers\//);
          if (match) {
            const username = match[1];
            if (username !== config.username) {
              userSet.add(username);
            }
          }
        }

        return Array.from(userSet).map(username => ({ username }));
      } catch (error) {
        logger.warn?.(`[ZTM API] Failed to discover users via storage: ${error}`);
        return [];
      }
    },

    async getChats(): Promise<ZTMChat[]> {
      try {
        const fileList = await listFiles();
        const chatsByPeer = new Map<string, { path: string; time: number }>();

        for (const filePath of Object.keys(fileList)) {
          const peerMatch = filePath.match(peerMessagePattern);
          if (peerMatch) {
            const peer = peerMatch[1];
            const meta = fileList[filePath];
            const fileTime = meta?.time ?? 0;
            const existing = chatsByPeer.get(peer);
            if (!existing || fileTime > existing.time) {
              chatsByPeer.set(peer, { path: filePath, time: fileTime });
            }
          }
        }

        const chats: ZTMChat[] = [];
        for (const [peer, info] of chatsByPeer) {
          try {
            const fileContent = await readFile(info.path);
            const messages = parseMessageFile(fileContent, peer);
            const latest = messages.length > 0
              ? messages.reduce((a, b) => a.time > b.time ? a : b)
              : { time: info.time, message: "", sender: peer };
            chats.push({
              peer,
              time: info.time,
              updated: info.time,
              latest,
            });
          } catch {
            chats.push({
              peer,
              time: info.time,
              updated: info.time,
              latest: { time: info.time, message: "", sender: peer },
            });
          }
        }

        return chats;
      } catch (error) {
        logger.warn?.(`[ZTM API] Failed to get chats via storage: ${error}`);
        return [];
      }
    },

    async getPeerMessages(peer: string, since?: number, before?: number): Promise<ZTMMessage[] | null> {
      logger.debug?.(`[ZTM API] Fetching messages from peer "${peer}" since=${since}, before=${before}`);
      try {
        const messagePath = `/apps/ztm/chat/shared/${peer}/publish/peers/${config.username}/messages/`;
        const fileList = await listFiles();

        const messages: ZTMMessage[] = [];
        for (const filePath of Object.keys(fileList)) {
          if (filePath.startsWith(messagePath)) {
            try {
              const fileContent = await readFile(filePath);
              const parsed = parseMessageFile(fileContent, peer);
              for (const msg of parsed) {
                if (since !== undefined && msg.time <= since) continue;
                if (before !== undefined && msg.time >= before) continue;
                messages.push(msg);
              }
            } catch (error) {
              logger.debug?.(`[ZTM API] Failed to read message file ${filePath}: ${error}`);
            }
          }
        }

        messages.sort((a, b) => b.time - a.time);
        logger.debug?.(`[ZTM API] Fetched ${messages.length} messages from peer "${peer}"`);
        return messages;
      } catch (error) {
        logger.warn?.(`[ZTM API] Failed to get peer messages from ${peer}: ${error}`);
        return null;
      }
    },

    async sendPeerMessage(peer: string, message: ZTMMessage): Promise<boolean> {
      logger.debug?.(`[ZTM API] Sending message to peer "${peer}" at time=${message.time}, text="${message.message}"`);
      try {
        const messagePath = `/apps/ztm/chat/shared/${config.username}/publish/peers/${peer}/messages/${message.time}.json`;
        // ZTM Chat expects array format: [{time, message:{text}}]
        const ztmEntry = { time: message.time, message: { text: message.message } };
        await writeFile(messagePath, [ztmEntry]);
        logger.debug?.(`[ZTM API] Successfully sent message to peer "${peer}" at path=${messagePath}`);
        return true;
      } catch (error) {
        logger.error?.(`[ZTM API] Failed to send message to ${peer}: ${error}`);
        return false;
      }
    },

    async sendMessageViaStorage(peer: string, message: ZTMMessage): Promise<boolean> {
      logger.debug?.(`[ZTM API] Sending message via storage to peer "${peer}"`);
      const success = await client.sendPeerMessage(peer, message);
      logger.debug?.(`[ZTM API] Message via storage ${success ? "succeeded" : "failed"} for peer "${peer}"`);
      return success;
    },

    async receiveMessagesViaStorage(peer: string): Promise<ZTMMessage[] | null> {
      logger.debug?.(`[ZTM API] Receiving messages via storage from peer "${peer}"`);
      const messages = await client.getPeerMessages(peer);
      logger.debug?.(`[ZTM API] Received ${messages?.length ?? 0} messages from peer "${peer}" via storage`);
      return messages;
    },

    async watchChanges(prefix: string): Promise<string[]> {
      logger.debug?.(`[ZTM API] Watching for changes with prefix="${prefix}"`);
      try {
        const fileList = await listFiles();
        const changedPaths: string[] = [];

        for (const [filePath, meta] of Object.entries(fileList)) {
          if (!filePath.startsWith(prefix)) continue;
          const fileMeta = meta as { time?: number };
          const fileTime = fileMeta?.time ?? 0;
          const lastSeen = lastSeenTimes.get(filePath) ?? 0;
          if (fileTime > lastSeen) {
            changedPaths.push(filePath);
            lastSeenTimes.set(filePath, fileTime);
            logger.debug?.(`[ZTM API] Change detected: ${filePath} (time=${fileTime}, lastSeen=${lastSeen})`);
          }
        }

        logger.debug?.(`[ZTM API] Watch complete: ${changedPaths.length} changed paths for prefix="${prefix}"`);
        return changedPaths;
      } catch (error) {
        logger.warn?.(`[ZTM API] Watch failed for ${prefix}: ${error}`);
        return [];
      }
    },

    async getGroups(): Promise<ZTMChat[]> {
      return [];
    },

    async getGroupMessages(_creator: string, _group: string): Promise<ZTMMessage[] | null> {
      return null;
    },

    async addFile(_data: ArrayBuffer): Promise<string | null> {
      return null;
    },

    async getFile(_owner: string, _hash: string): Promise<ArrayBuffer | null> {
      return null;
    },
  };

  return client;
}

// Helper to build peer message path (storage format, not API format)
export function buildPeerMessagePath(
  messagePath: string,
  username: string,
  peer: string
): string {
  return `${messagePath}/${username}/publish/peers/${peer}/messages/`;
}

// Helper to build group message path (storage format)
export function buildGroupMessagePath(
  messagePath: string,
  username: string,
  creator: string,
  group: string
): string {
  return `${messagePath}/${username}/publish/groups/${creator}/${group}/messages/`;
}

// Parse storage path to extract peer or group info
export function parseMessagePath(
  path: string
): { peer?: string; creator?: string; group?: string } | null {
  const peerMatch = path.match(/(?:\/apps\/ztm\/chat)?\/shared\/[^/]+\/publish\/peers\/([^/]+)\/messages/);
  if (peerMatch) {
    return { peer: peerMatch[1] };
  }

  const groupMatch = path.match(
    /(?:\/apps\/ztm\/chat)?\/shared\/[^/]+\/publish\/groups\/([^/]+)\/([^/]+)\/messages/
  );
  if (groupMatch) {
    return { creator: groupMatch[1], group: groupMatch[2] };
  }

  return null;
}

// Create API client with timeout
export function createZTMApiClientWithTimeout(
  config: ZTMChatConfig,
  timeoutMs: number = 15000
): ZTMApiClient {
  // This is a wrapper that could be used for per-request timeout customization
  return createZTMApiClient(config);
}
