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

    // Discover all users in mesh - uses ZTM Agent storage API
    async discoverUsersViaStorage(): Promise<ZTMUserInfo[]> {
      try {
        const fileList = await request<Record<string, unknown>>("GET", `/api/meshes/${config.meshName}/files`);
        const users = new Map<string, ZTMUserInfo>();
        const userSet = new Set<string>();

        for (const path of Object.keys(fileList)) {
          const match = path.match(/^\/apps\/ztm\/chat\/shared\/([^\/]+)\/publish\/peers\//);
          if (match) {
            const username = match[1];
            if (username !== config.username && !userSet.has(username)) {
              userSet.add(username);
              users.set(username, { username });
            }
          }
        }

        return Array.from(users.values());
      } catch (error) {
        logger.warn(`[ZTM API] Failed to discover users via storage: ${error}`);
        return [];
      }
    },

    // Get all chats - uses ZTM Agent storage API
    async getChats(): Promise<ZTMChat[]> {
      try {
        const fileList = await request<Record<string, unknown>>("GET", `/api/meshes/${config.meshName}/files`);
        const chats: ZTMChat[] = [];

        for (const path of Object.keys(fileList)) {
          const peerPattern = new RegExp(`^/apps/ztm/chat/shared/([^/]+)/publish/peers/${config.username}/messages/`);
          const peerMatch = path.match(peerPattern);
          if (peerMatch) {
            const peer = peerMatch[1];
            const meta = fileList[path] as { time?: number; $?: number; T?: number };
            if (meta.time) {
              chats.push({
                peer,
                time: meta.time,
                updated: meta.T || meta.time,
                latest: {
                  time: meta.time,
                  message: "",
                  sender: peer,
                },
              });
            }
          }
        }

        return chats;
      } catch (error) {
        logger.warn(`[ZTM API] Failed to get chats via storage: ${error}`);
        return [];
      }
    },

    // Get messages from a peer - uses ZTM Agent storage API
    async getPeerMessages(peer: string, since?: number, before?: number): Promise<ZTMMessage[] | null> {
      try {
        const messagePath = `/apps/ztm/chat/shared/${peer}/publish/peers/${config.username}/messages/`;
        const fileList = await request<Record<string, unknown>>("GET", `/api/meshes/${config.meshName}/files`);

        const messages: ZTMMessage[] = [];
        for (const path of Object.keys(fileList)) {
          if (path.startsWith(messagePath)) {
            try {
              const fileContent = await request<any>("GET", `/api/meshes/${config.meshName}/file-data${path}`);
              // File content is an array of {time, message: {text}} entries
              const entries = Array.isArray(fileContent) ? fileContent : [fileContent];
              for (const entry of entries) {
                if (entry?.time) {
                  if (since !== undefined && entry.time <= since) {
                    continue;
                  }
                  if (before !== undefined && entry.time >= before) {
                    continue;
                  }
                  // Extract text from nested message object or use as-is
                  const messageText = typeof entry.message === 'object' && entry.message !== null
                    ? (entry.message.text || JSON.stringify(entry.message))
                    : String(entry.message || '');
                  messages.push({
                    time: entry.time,
                    message: messageText,
                    sender: entry.sender || peer,
                  });
                }
              }
            } catch (error) {
              logger.debug(`[ZTM API] Failed to read message file ${path}: ${error}`);
            }
          }
        }

        messages.sort((a, b) => b.time - a.time);

        return messages;
      } catch (error) {
        logger.warn(`[ZTM API] Failed to get peer messages from ${peer}: ${error}`);
        return null;
      }
    },

    async sendPeerMessage(peer: string, message: ZTMMessage): Promise<boolean> {
      try {
        const messageId = `${message.time}-${message.sender}`;
        const messagePath = `/apps/ztm/chat/shared/${config.username}/publish/peers/${peer}/messages/${messageId}.json`;

        await request("POST", `/api/meshes/${config.meshName}/file-data${messagePath}`, message);
        return true;
      } catch (error) {
        logger.error(`[ZTM API] Failed to send message to ${peer}: ${error}`);
        return false;
      }
    },

    async watchChanges(prefix: string): Promise<string[]> {
      try {
        const fileList = await request<Record<string, unknown>>("GET", `/api/meshes/${config.meshName}/files?since=0`);
        const changedPaths = Object.keys(fileList).filter(path => path.startsWith(prefix));
        return changedPaths || [];
      } catch (error) {
        logger.warn(`[ZTM API] Watch failed for ${prefix}: ${error}`);
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
