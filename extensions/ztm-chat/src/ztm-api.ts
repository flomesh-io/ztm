// ZTM Agent API Client
// Handles HTTP communication with remote ZTM Agent for Chat operations

import type { ZTMChatConfig } from "./config.js";

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

  // Chat operations
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

// Validate certificate format
function isValidCertificate(cert: string): boolean {
  return (
    cert.includes("-----BEGIN CERTIFICATE-----") &&
    cert.includes("-----END CERTIFICATE-----")
  );
}

// Validate private key format
function isValidPrivateKey(key: string): boolean {
  return (
    key.includes("-----BEGIN PRIVATE KEY-----") ||
    key.includes("-----BEGIN EC PRIVATE KEY-----") ||
    key.includes("-----BEGIN RSA PRIVATE KEY-----")
  );
}

// Create ZTM API Client
export function createZTMApiClient(config: ZTMChatConfig): ZTMApiClient {
  const baseUrl = config.agentUrl.replace(/\/$/, "");

  // Validate and prepare TLS options
  const tlsOptions: { cert?: string; key?: string } = {};
  if (config.certificate && isValidCertificate(config.certificate)) {
    tlsOptions.cert = config.certificate;
  }
  if (config.privateKey && isValidPrivateKey(config.privateKey)) {
    tlsOptions.key = config.privateKey;
  }

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

    // Add certificate header if available (mTLS-style auth)
    if (tlsOptions.cert) {
      headers["X-Client-Cert"] = tlsOptions.cert;
    }

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
      return response.json();
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

    // Discover all users in the mesh via Chat API
    async discoverUsers(): Promise<ZTMUserInfo[]> {
      return safeRequest<ZTMUserInfo[]>([], "GET", "/apps/ztm/chat/api/users");
    },

    // Discover all peers/endpoints
    async discoverPeers(): Promise<ZTMPeer[]> {
      return safeRequest<ZTMPeer[]>([], "GET", `/api/meshes/${config.meshName}/endpoints`);
    },

    // Get all chats
    async getChats(): Promise<ZTMChat[]> {
      return safeRequest<ZTMChat[]>([], "GET", "/apps/ztm/chat/api/chats");
    },

    // Get messages from a peer
    async getPeerMessages(peer: string, since?: number, before?: number): Promise<ZTMMessage[] | null> {
      try {
        let path = `/apps/ztm/chat/api/peers/${encodeURIComponent(peer)}/messages`;
        const params = new URLSearchParams();
        if (since) params.set("since", since.toString());
        if (before) params.set("before", before.toString());
        const query = params.toString();
        if (query) path += `?${query}`;
        return await request<ZTMMessage[] | null>("GET", path);
      } catch {
        return null;
      }
    },

    // Send message to a peer
    async sendPeerMessage(peer: string, message: ZTMMessage): Promise<boolean> {
      try {
        await request<void>(
          "POST",
          `/apps/ztm/chat/api/peers/${encodeURIComponent(peer)}/messages`,
          message
        );
        return true;
      } catch {
        return false;
      }
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
