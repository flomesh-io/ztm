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
import { success, failure, type Result } from "../types/common.js";
import {
  ZtmApiError,
  ZtmTimeoutError,
  ZtmSendError,
  ZtmReadError,
  ZtmDiscoveryError,
  ZtmParseError,
  ZtmError,
} from "../types/errors.js";
import { logger } from "../utils/logger.js";
import { fetchWithRetry } from "../utils/retry.js";

// Re-export types for backward compatibility
export type { ZTMMessage, ZTMPeer, ZTMUserInfo, ZTMMeshInfo, ZTMChat, ZTMApiClient };

/**
 * Type alias for ZTM API operations that can fail with ZtmApiError
 */
type ApiResult<T> = Promise<Result<T, ZtmApiError | ZtmTimeoutError>>;

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

  /**
   * Internal request handler that returns a Result type.
   * All API calls go through this for consistent error handling.
   */
  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    additionalHeaders?: Record<string, string>
  ): ApiResult<T> {
    const url = `${baseUrl}${path}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...additionalHeaders,
    };

    try {
      const response = await fetchWithRetry(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      }, { timeout: apiTimeout });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        return failure(new ZtmApiError({
          method,
          path,
          statusCode: response.status,
          statusText: response.statusText,
          responseBody: errorText,
        }));
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        return success((await response.json()) as T);
      }

      const text = await response.text();
      try {
        return success(JSON.parse(text) as unknown as T);
      } catch {
        return success(text as unknown as T);
      }
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error));
      // Check if it's a timeout by looking at the error message or type
      if (cause.name === "AbortError" || cause.message.includes("timeout")) {
        return failure(new ZtmTimeoutError({
          method,
          path,
          timeoutMs: apiTimeout,
          cause,
        }));
      }
      return failure(new ZtmApiError({
        method,
        path,
        cause,
      }));
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // Helper functions for internal use with Result types
  // ═════════════════════════════════════════════════════════════════════════════

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

  // Type guard for file metadata from API response
  function isFileMeta(obj: unknown): obj is { time?: number; size?: number } {
    return typeof obj === "object" && obj !== null;
  }

  async function listFiles(since?: number): ApiResult<Record<string, { hash?: string; size?: number; time?: number }>> {
    const path = `/api/meshes/${config.meshName}/files`;
    const queryParams = since !== undefined ? `?since=${since}` : "";
    return request<Record<string, { hash?: string; size?: number; time?: number }>>("GET", path + queryParams);
  }

  async function readFile<T = unknown>(filePath: string): ApiResult<T> {
    return request<T>("GET", `/api/meshes/${config.meshName}/file-data${filePath}`);
  }

  async function writeFile(filePath: string, data: unknown): ApiResult<void> {
    return request<void>("POST", `/api/meshes/${config.meshName}/file-data${filePath}`, data);
  }

  const peerMessagePattern = new RegExp(
    `^/apps/ztm/chat/shared/([^/]+)/publish/peers/${config.username}/messages/`
  );

  // ═════════════════════════════════════════════════════════════════════════════
  // Helper: Parse message file content with error handling
  // ═════════════════════════════════════════════════════════════════════════════
  function parseMessageFileWithResult(
    fileContent: unknown,
    peer: string,
    filePath: string
  ): Result<ZTMMessage[], ZtmParseError> {
    try {
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
      return success(result);
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error));
      return failure(new ZtmParseError({
        peer,
        filePath,
        cause,
      }));
    }
  }

  const client: ZTMApiClient = {
    async getMeshInfo(): Promise<Result<ZTMMeshInfo, ZtmApiError | ZtmTimeoutError>> {
      return request<ZTMMeshInfo>("GET", `/api/meshes/${config.meshName}`);
    },

    async discoverUsers(): Promise<Result<ZTMUserInfo[], ZtmDiscoveryError>> {
      return client.discoverUsersViaStorage();
    },

    async discoverPeers(): Promise<Result<ZTMPeer[], ZtmDiscoveryError>> {
      const usersResult = await client.discoverUsersViaStorage();
      if (usersResult.ok) {
        return success(usersResult.value.map(u => ({ username: u.username })));
      }
      return failure(usersResult.error);
    },

    async discoverUsersViaStorage(): Promise<Result<ZTMUserInfo[], ZtmDiscoveryError>> {
      log.debug?.(`[ZTM API] Discovering users via storage`);

      const fileListResult = await listFiles();
      if (!fileListResult.ok) {
        log.error?.(`[ZTM API] Failed to list files for user discovery: ${fileListResult.error.message}`);
        return failure(new ZtmDiscoveryError({
          operation: "discoverUsers",
          source: "storage",
          cause: fileListResult.error,
        }));
      }

      const fileList = fileListResult.value;
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

      const users = Array.from(userSet).map(username => ({ username }));
      log.debug?.(`[ZTM API] Discovered ${users.length} users via storage`);
      return success(users);
    },

    async getChats(): Promise<Result<ZTMChat[], ZtmReadError>> {
      log.debug?.(`[ZTM API] Getting chats via storage`);

      const fileListResult = await listFiles();
      if (!fileListResult.ok) {
        const error = new ZtmReadError({
          peer: "*",
          operation: "list",
          cause: fileListResult.error,
        });
        log.error?.(`[ZTM API] Failed to list files for chats: ${error.message}`);
        return failure(error);
      }

      const fileList = fileListResult.value;
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
      const errors: ZtmReadError[] = [];

      for (const [peer, info] of chatsByPeer) {
        const timestampMatch = info.filename.match(/^(\d+)\.json$/);
        const timestamp = timestampMatch ? parseInt(timestampMatch[1], 10) : info.time;

        const readResult = await readFile(info.path);
        if (!readResult.ok) {
          const readError = new ZtmReadError({
            peer,
            operation: "read",
            filePath: info.path,
            cause: readResult.error,
          });
          log.debug?.(`[ZTM API] Failed to read chat file for ${peer}: ${readError.message}`);
          errors.push(readError);
          // Continue with empty latest message
          chats.push({
            peer,
            time: info.time,
            updated: info.time,
            latest: { time: info.time, message: "", sender: peer },
          });
          continue;
        }

        const parseResult = parseMessageFileWithResult(readResult.value, peer, info.path);
        if (!parseResult.ok) {
          log.debug?.(`[ZTM API] Failed to parse chat file for ${peer}: ${parseResult.error.message}`);
          errors.push(parseResult.error);
          chats.push({
            peer,
            time: info.time,
            updated: info.time,
            latest: { time: info.time, message: "", sender: peer },
          });
          continue;
        }

        const messages = parseResult.value;
        const latest = messages.length > 0
          ? messages.reduce((a, b) => a.time > b.time ? a : b)
          : { time: timestamp, message: "", sender: peer };

        chats.push({
          peer,
          time: timestamp,
          updated: timestamp,
          latest,
        });
      }

      if (errors.length > 0 && chats.length === 0) {
        // If all reads failed, return the first error
        return failure(errors[0]);
      }

      log.debug?.(`[ZTM API] Got ${chats.length} chats via storage`);
      return success(chats);
    },

    async getPeerMessages(
      peer: string,
      since?: number,
      before?: number
    ): Promise<Result<ZTMMessage[], ZtmReadError>> {
      log.debug?.(`[ZTM API] Fetching messages from peer "${peer}" since=${since}, before=${before}`);

      const messagePath = `/apps/ztm/chat/shared/${peer}/publish/peers/${config.username}/messages/`;
      const fileListResult = await listFiles();

      if (!fileListResult.ok) {
        const error = new ZtmReadError({
          peer,
          operation: "list",
          cause: fileListResult.error,
        });
        log.error?.(`[ZTM API] Failed to list files for peer messages: ${error.message}`);
        return failure(error);
      }

      const fileList = fileListResult.value;
      const messages: ZTMMessage[] = [];
      const errors: ZtmReadError[] = [];

      for (const filePath of Object.keys(fileList)) {
        if (!filePath.startsWith(messagePath)) continue;

        const readResult = await readFile(filePath);
        if (!readResult.ok) {
          const readError = new ZtmReadError({
            peer,
            operation: "read",
            filePath,
            cause: readResult.error,
          });
          log.debug?.(`[ZTM API] Failed to read message file ${filePath}: ${readError.message}`);
          errors.push(readError);
          continue;
        }

        const parseResult = parseMessageFileWithResult(readResult.value, peer, filePath);
        if (!parseResult.ok) {
          log.debug?.(`[ZTM API] Failed to parse message file ${filePath}: ${parseResult.error.message}`);
          errors.push(parseResult.error);
          continue;
        }

        for (const msg of parseResult.value) {
          if (since !== undefined && msg.time <= since) continue;
          if (before !== undefined && msg.time >= before) continue;
          messages.push(msg);
        }
      }

      messages.sort((a, b) => b.time - a.time);

      if (errors.length > 0 && messages.length === 0) {
        // If all reads failed, return the first error
        return failure(errors[0]);
      }

      log.debug?.(`[ZTM API] Fetched ${messages.length} messages from peer "${peer}"`);
      return success(messages);
    },

    async sendPeerMessage(peer: string, message: ZTMMessage): Promise<Result<boolean, ZtmSendError>> {
      log.debug?.(`[ZTM API] Sending message to peer "${peer}" at time=${message.time}, text="${message.message.substring(0, 50)}..."`);

      const messagePath = `/apps/ztm/chat/shared/${config.username}/publish/peers/${peer}/messages/${message.time}.json`;
      // ZTM Chat expects array format: [{time, message:{text}}]
      const ztmEntry = { time: message.time, message: { text: message.message } };

      const writeResult = await writeFile(messagePath, [ztmEntry]);
      if (!writeResult.ok) {
        const error = new ZtmSendError({
          peer,
          messageTime: message.time,
          contentPreview: message.message,
          cause: writeResult.error,
        });
        log.error?.(`[ZTM API] Failed to send message to ${peer}: ${error.message}`);
        return failure(error);
      }

      log.debug?.(`[ZTM API] Successfully sent message to peer "${peer}" at path=${messagePath}`);
      return success(true);
    },

    async sendMessageViaStorage(
      peer: string,
      message: ZTMMessage
    ): Promise<Result<boolean, ZtmSendError>> {
      log.debug?.(`[ZTM API] Sending message via storage to peer "${peer}"`);
      const result = await client.sendPeerMessage(peer, message);
      log.debug?.(`[ZTM API] Message via storage ${result.ok ? "succeeded" : "failed"} for peer "${peer}"`);
      return result;
    },

    async receiveMessagesViaStorage(
      peer: string
    ): Promise<Result<ZTMMessage[], ZtmReadError>> {
      log.debug?.(`[ZTM API] Receiving messages via storage from peer "${peer}"`);
      const result = await client.getPeerMessages(peer);
      log.debug?.(`[ZTM API] Received ${result.ok ? result.value.length : 0} messages from peer "${peer}" via storage`);
      return result;
    },

    async watchChanges(
      prefix: string
    ): Promise<Result<string[], ZtmReadError>> {
      log.debug?.(`[ZTM API] Watching for changes with prefix="${prefix}"`);

      // Get the minimum last seen time for the since parameter
      const lastSeenTimes = Array.from(lastSeenFiles.values()).map(m => m.time);
      const minLastSeen = Math.min(...lastSeenTimes, Infinity);
      const sinceTime = isFinite(minLastSeen) ? minLastSeen : undefined;

      const fileListResult = await listFiles(sinceTime);
      if (!fileListResult.ok) {
        const error = new ZtmReadError({
          peer: "*",
          operation: "list",
          cause: fileListResult.error,
        });
        log.error?.(`[ZTM API] Watch failed for ${prefix}: ${error.message}`);
        return failure(error);
      }

      const fileList = fileListResult.value;
      const changedPaths: string[] = [];

      for (const [filePath, meta] of Object.entries(fileList)) {
        if (!filePath.startsWith(prefix)) continue;
        // Use type guard to safely access file metadata
        if (!isFileMeta(meta)) {
          log.debug?.(`[ZTM API] Skipping file with invalid metadata: ${filePath}`);
          continue;
        }
        const fileTime = meta.time ?? 0;
        const fileSize = meta.size ?? 0;
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
      return success(changedPaths);
    },

    async getGroups(): Promise<Result<ZTMChat[], ZtmError>> {
      log.debug?.(`[ZTM API] Groups feature not implemented yet`);
      return success<ZTMChat[], ZtmError>([]);
    },

    async getGroupMessages(
      _creator: string,
      _group: string
    ): Promise<Result<ZTMMessage[], ZtmReadError>> {
      log.debug?.(`[ZTM API] Group messages feature not implemented yet`);
      return success<ZTMMessage[], ZtmReadError>([]);
    },

    async addFile(
      _data: ArrayBuffer
    ): Promise<Result<string, ZtmError>> {
      log.debug?.(`[ZTM API] File addition not implemented yet`);
      return success<string, ZtmError>("");
    },

    async getFile(
      _owner: string,
      _hash: string
    ): Promise<Result<ArrayBuffer, ZtmReadError>> {
      log.debug?.(`[ZTM API] File retrieval not implemented yet`);
      return success<ArrayBuffer, ZtmReadError>(new ArrayBuffer(0));
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
