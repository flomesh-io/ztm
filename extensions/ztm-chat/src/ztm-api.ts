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

  return {
    // Get mesh connection status
    async getMeshInfo(): Promise<ZTMMeshInfo> {
      return request<ZTMMeshInfo>("GET", `/api/meshes/${config.meshName}`);
    },

    // Discover all users in the mesh - uses direct storage API (MVP)
    async discoverUsers(): Promise<ZTMUserInfo[]> {
      // MVP: Use direct storage API
      return this.discoverUsersViaStorage();
    },

    // Discover all peers/endpoints
    async discoverPeers(): Promise<ZTMPeer[]> {
      return safeRequest<ZTMPeer[]>([], "GET", `/api/meshes/${config.meshName}/endpoints`);
    },

    // Get all chats - uses direct storage API (MVP)
    async getChats(): Promise<ZTMChat[]> {
      // MVP: Discover users via storage and build chat list
      const users = await this.discoverUsersViaStorage();

      const chats: ZTMChat[] = [];
      const now = Date.now();

      for (const user of users) {
        // Check if there's a conversation with this user
        const messages = await this.receiveMessagesViaStorage(user.username);
        if (messages && messages.length > 0) {
          const latest = messages[messages.length - 1];
          chats.push({
            peer: user.username,
            time: latest.time,
            updated: now,
            latest,
          });
        }
      }

      return chats;
    },

    // Get messages from a peer - uses direct storage API (MVP)
    async getPeerMessages(peer: string, since?: number, before?: number): Promise<ZTMMessage[] | null> {
      // MVP: Use direct storage API
      const messages = await this.receiveMessagesViaStorage(peer);

      if (!messages) return null;

      // Apply time filters
      let filtered = messages;
      if (since) {
        filtered = filtered.filter(m => m.time > since);
      }
      if (before) {
        filtered = filtered.filter(m => m.time < before);
      }

      return filtered;
    },

    // Send message to a peer - uses direct storage API (MVP)
    async sendPeerMessage(peer: string, message: ZTMMessage): Promise<boolean> {
      // MVP: Use direct storage API
      return this.sendMessageViaStorage(peer, message);
    },

    // Get all groups (future feature)
    async getGroups(): Promise<ZTMChat[]> {
      // Placeholder for group chat API when enableGroups is implemented
      return safeRequest<ZTMChat[]>([], "GET", "/apps/ztm/chat/api/chats");
    },

    // Get group messages (future feature)
    async getGroupMessages(creator: string, group: string): Promise<ZTMMessage[] | null> {
      try {
        return await request<ZTMMessage[] | null>(
          "GET",
          `/apps/ztm/chat/api/groups/${encodeURIComponent(creator)}/${encodeURIComponent(group)}/messages`
        );
      } catch {
        return null;
      }
    },

    // Add a file to shared storage
    async addFile(data: ArrayBuffer): Promise<string | null> {
      try {
        const response = await fetchWithTimeout(`${baseUrl}/apps/ztm/chat/api/files`, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
          },
          body: data,
        });
        if (!response.ok) return null;
        const hash = await response.text();
        return hash.trim() || null;
      } catch {
        return null;
      }
    },

    // Get a file from shared storage
    async getFile(owner: string, hash: string): Promise<ArrayBuffer | null> {
      try {
        const response = await fetchWithTimeout(
          `${baseUrl}/apps/ztm/chat/api/files/${encodeURIComponent(owner)}/${encodeURIComponent(hash)}`
        );
        if (!response.ok) return null;
        return response.arrayBuffer();
      } catch {
        return null;
      }
    },

    // Watch for changes in a path prefix
    async watchChanges(prefix: string): Promise<string[]> {
      try {
        return await request<string[]>("GET", `/api/watch${prefix}`);
      } catch {
        return [];
      }
    },

    // ===== Direct Storage API Methods (MVP) =====

    /** Send message using direct storage API (setFileData) */
    async sendMessageViaStorage(peer: string, message: ZTMMessage): Promise<boolean> {
      try {
        const messageId = `${message.time}-${message.sender}`;
        const path = buildPeerMessagePath("/shared", config.username, peer);
        const filePath = `${path}${messageId}.json`;
        const data = JSON.stringify(message, null, 2);

        await request<void>("POST", `/api/setFileData${filePath}`, { data });
        logger.debug(`[ZTM API] Sent message to ${peer} via storage: ${filePath}`);
        return true;
      } catch (error) {
        logger.warn(`[ZTM API] Failed to send message via storage: ${error}`);
        return false;
      }
    },

    /** Receive messages using direct storage API (allFiles + getFileData) */
    async receiveMessagesViaStorage(peer: string): Promise<ZTMMessage[] | null> {
      try {
        // Path where the peer publishes messages intended for us
        // Pattern: /shared/{peer}/publish/peers/{botUsername}/messages/
        const publishPath = `/shared/${peer}/publish/peers/${config.username}/messages/`;

        // Get list of message files
        const fileList = await request<string[]>("GET", `/api/allFiles${publishPath}`);

        if (!fileList || fileList.length === 0) {
          return [];
        }

        const messages: ZTMMessage[] = [];
        for (const fullPath of fileList) {
          if (!fullPath.endsWith('.json')) continue;

          try {
            const response = await request<{ data: string }>("GET", `/api/getFileData${fullPath}`);
            if (response?.data) {
              const message = JSON.parse(response.data) as ZTMMessage;
              messages.push(message);
            }
          } catch {
            logger.debug(`[ZTM API] Failed to read message file: ${fullPath}`);
          }
        }

        // Sort by time
        messages.sort((a, b) => a.time - b.time);
        return messages;
      } catch (error) {
        logger.warn(`[ZTM API] Failed to receive messages via storage: ${error}`);
        return null;
      }
    },

    /** Discover active peers by scanning shared storage */
    async discoverUsersViaStorage(): Promise<ZTMUserInfo[]> {
      try {
        // Scan /shared/*/publish/ to find active users
        const publishPath = "/shared/*/publish/";
        const fileList = await request<string[]>("GET", `/api/allFiles${publishPath}`);

        if (!fileList || fileList.length === 0) {
          return [];
        }

        // Extract usernames from paths like /shared/{username}/publish/...
        const users = new Map<string, ZTMUserInfo>();
        const userSet = new Set<string>();

        for (const path of fileList) {
          const match = path.match(/^\/shared\/([^\/]+)\//);
          if (match && match[1] !== config.username) {
            userSet.add(match[1]);
          }
        }

        for (const username of userSet) {
          users.set(username, { username });
        }

        return Array.from(users.values());
      } catch (error) {
        logger.warn(`[ZTM API] Failed to discover users via storage: ${error}`);
        return [];
      }
    },
  };
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
  // Match: /shared/{username}/publish/peers/{peer}/messages/
  const peerMatch = path.match(/\/shared\/[^/]+\/publish\/peers\/([^/]+)\/messages/);
  if (peerMatch) {
    return { peer: peerMatch[1] };
  }

  // Match: /shared/{username}/publish/groups/{creator}/{group}/messages/
  const groupMatch = path.match(
    /\/shared\/[^/]+\/publish\/groups\/([^/]+)\/([^/]+)\/messages/
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
