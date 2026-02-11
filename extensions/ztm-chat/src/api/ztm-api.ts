// ZTM Agent API Client
// Handles HTTP communication with remote ZTM Agent for Chat operations
// Supports both direct storage API access and Chat App HTTP endpoints

import type { ZTMChatConfig } from "../types/config.js";
import type {
  ZTMMessage,
  ZTMPeer,
  ZTMUserInfo,
  ZTMMeshInfo,
  ZTMChat,
  ZTMApiClient
} from "../types/api.js";
import { logger } from "../utils/logger.js";
import { fetchWithRetry } from "../utils/retry.js";

// Re-export types for backward compatibility
export type { ZTMMessage, ZTMPeer, ZTMUserInfo, ZTMMeshInfo, ZTMChat, ZTMApiClient };

// Default timeout for API requests (in milliseconds)
const DEFAULT_TIMEOUT = 30000;

// Maximum number of tracked files to prevent memory leaks
const MAX_TRACKED_FILES = 500;

// Create ZTM API Client
export function createZTMApiClient(config: ZTMChatConfig, _logger?: typeof logger): ZTMApiClient {
  // Use injected logger or fall back to module-level logger
  const log = _logger ?? logger;
  const baseUrl = config.agentUrl.replace(/\/$/, "");
  const apiTimeout = config.apiTimeout || DEFAULT_TIMEOUT;

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

    const response = await fetchWithRetry(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }, { timeout: apiTimeout });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`ZTM API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return (await response.json()) as T;
    }

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

  // Track both time and size for each file to detect changes in append-only files
  interface FileMetadata {
    time: number;
    size: number;
  }
  const lastSeenFiles = new Map<string, FileMetadata>();

  // Clean up oldest entries when reaching the limit to prevent memory leaks
  function trimFileMetadata(): void {
    while (lastSeenFiles.size > MAX_TRACKED_FILES) {
      const firstKey = lastSeenFiles.keys().next().value;
      lastSeenFiles.delete(firstKey);
    }
  }

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

  async function listFiles(since?: number): Promise<Record<string, { hash?: string; size?: number; time?: number }>> {
    const path = `/api/meshes/${config.meshName}/files`;
    const queryParams = since !== undefined ? `?since=${since}` : "";
    return request<Record<string, { hash?: string; size?: number; time?: number }>>("GET", path + queryParams);
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
        log.warn?.(`[ZTM API] Failed to discover users via storage: ${error}`);
        return [];
      }
    },

    async getChats(): Promise<ZTMChat[]> {
      try {
        const fileList = await listFiles();
        const chatsByPeer = new Map<string, { path: string; time: number; filename: string }>();

        for (const filePath of Object.keys(fileList)) {
          const peerMatch = filePath.match(peerMessagePattern);
          if (peerMatch) {
            const peer = peerMatch[1];
            const meta = fileList[filePath];
            const fileTime = meta?.time ?? 0;
            const existing = chatsByPeer.get(peer);
            if (!existing || fileTime > existing.time) {
              const filename = filePath.split('/').pop() || '';
              chatsByPeer.set(peer, { path: filePath, time: fileTime, filename });
            }
          }
        }

        const chats: ZTMChat[] = [];
        for (const [peer, info] of chatsByPeer) {
          try {
            const timestampMatch = info.filename.match(/^(\d+)\.json$/);
            const timestamp = timestampMatch ? parseInt(timestampMatch[1], 10) : info.time;

            const fileContent = await readFile(info.path);
            const messages = parseMessageFile(fileContent, peer);
            const latest = messages.length > 0
              ? messages.reduce((a, b) => a.time > b.time ? a : b)
              : { time: timestamp, message: "", sender: peer };
            chats.push({
              peer,
              time: timestamp,
              updated: timestamp,
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
        log.warn?.(`[ZTM API] Failed to get chats via storage: ${error}`);
        return [];
      }
    },

    async getPeerMessages(peer: string, since?: number, before?: number): Promise<ZTMMessage[] | null> {
      log.debug?.(`[ZTM API] Fetching messages from peer "${peer}" since=${since}, before=${before}`);
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
              log.debug?.(`[ZTM API] Failed to read message file ${filePath}: ${error}`);
            }
          }
        }

        messages.sort((a, b) => b.time - a.time);
        log.debug?.(`[ZTM API] Fetched ${messages.length} messages from peer "${peer}"`);
        return messages;
      } catch (error) {
        log.warn?.(`[ZTM API] Failed to get peer messages from ${peer}: ${error}`);
        return null;
      }
    },

    async sendPeerMessage(peer: string, message: ZTMMessage): Promise<boolean> {
      log.debug?.(`[ZTM API] Sending message to peer "${peer}" at time=${message.time}, text="${message.message}"`);
      try {
        const messagePath = `/apps/ztm/chat/shared/${config.username}/publish/peers/${peer}/messages/${message.time}.json`;
        // ZTM Chat expects array format: [{time, message:{text}}]
        const ztmEntry = { time: message.time, message: { text: message.message } };
        await writeFile(messagePath, [ztmEntry]);
        log.debug?.(`[ZTM API] Successfully sent message to peer "${peer}" at path=${messagePath}`);
        return true;
      } catch (error) {
        log.error?.(`[ZTM API] Failed to send message to ${peer}: ${error}`);
        return false;
      }
    },

    async sendMessageViaStorage(peer: string, message: ZTMMessage): Promise<boolean> {
      log.debug?.(`[ZTM API] Sending message via storage to peer "${peer}"`);
      const success = await client.sendPeerMessage(peer, message);
      log.debug?.(`[ZTM API] Message via storage ${success ? "succeeded" : "failed"} for peer "${peer}"`);
      return success;
    },

    async receiveMessagesViaStorage(peer: string): Promise<ZTMMessage[] | null> {
      log.debug?.(`[ZTM API] Receiving messages via storage from peer "${peer}"`);
      const messages = await client.getPeerMessages(peer);
      log.debug?.(`[ZTM API] Received ${messages?.length ?? 0} messages from peer "${peer}" via storage`);
      return messages;
    },

    async watchChanges(prefix: string): Promise<string[]> {
      log.debug?.(`[ZTM API] Watching for changes with prefix="${prefix}"`);
      try {
        // Get the minimum last seen time for the since parameter
        const lastSeenTimes = Array.from(lastSeenFiles.values()).map(m => m.time);
        const minLastSeen = Math.min(...lastSeenTimes, Infinity);
        const fileList = await listFiles(isFinite(minLastSeen) ? minLastSeen : undefined);
        const changedPaths: string[] = [];

        for (const [filePath, meta] of Object.entries(fileList)) {
          if (!filePath.startsWith(prefix)) continue;
          const fileMeta = meta as { time?: number; size?: number };
          const fileTime = fileMeta?.time ?? 0;
          const fileSize = fileMeta?.size ?? 0;
          const lastSeen = lastSeenFiles.get(filePath);

          // Check if either time or size changed (handles append-only files)
          const timeChanged = !lastSeen || fileTime > lastSeen.time;
          const sizeChanged = !lastSeen || fileSize > lastSeen.size;

          if (timeChanged || sizeChanged) {
            changedPaths.push(filePath);
            lastSeenFiles.set(filePath, { time: fileTime, size: fileSize });
            trimFileMetadata();
            log.debug?.(`[ZTM API] Change detected: ${filePath} (time=${fileTime}, size=${fileSize}, lastTime=${lastSeen?.time}, lastSize=${lastSeen?.size})`);
          }
        }

        log.debug?.(`[ZTM API] Watch complete: ${changedPaths.length} changed paths for prefix="${prefix}"`);
        return changedPaths;
      } catch (error) {
        log.warn?.(`[ZTM API] Watch failed for ${prefix}: ${error}`);
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

    seedFileMetadata(metadata: Record<string, { time: number; size: number }>): void {
      for (const [filePath, meta] of Object.entries(metadata)) {
        const current = lastSeenFiles.get(filePath);
        if (!current || meta.time > current.time || meta.size > current.size) {
          lastSeenFiles.set(filePath, meta);
        }
      }
      trimFileMetadata();
    },

    exportFileMetadata(): Record<string, { time: number; size: number }> {
      const result: Record<string, { time: number; size: number }> = {};
      for (const [filePath, metadata] of lastSeenFiles) {
        result[filePath] = metadata;
      }
      return result;
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
