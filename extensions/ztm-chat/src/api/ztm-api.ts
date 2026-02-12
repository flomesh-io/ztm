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
  ZTMApiClient,
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
import { defaultLogger, type Logger } from "../utils/logger.js";
import { fetchWithRetry, type FetchWithRetry, type RetryOptions } from "../utils/retry.js";

// Re-export types for backward compatibility
export type { ZTMMessage, ZTMPeer, ZTMUserInfo, ZTMMeshInfo, ZTMChat, ZTMApiClient };

/**
 * Logger interface for dependency injection
 */
export interface ZtmLogger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/**
 * Dependencies that can be injected into the API client
 */
export interface ZtmApiClientDeps {
  logger: ZtmLogger;
  fetch: typeof fetch;
  fetchWithRetry: FetchWithRetry;
}

/**
 * Default values for dependencies
 */
const defaultDeps: ZtmApiClientDeps = {
  logger: defaultLogger,
  fetch,
  fetchWithRetry,
};

/**
 * Type alias for ZTM API operations that can fail with ZtmApiError
 */
type ApiResult<T> = Promise<Result<T, ZtmApiError | ZtmTimeoutError>>;

// Default timeout for API requests (in milliseconds)
const DEFAULT_TIMEOUT = 30000;

// Maximum number of tracked files to prevent memory leaks
const MAX_TRACKED_FILES = 500;

/**
 * Escape special regex characters in string literals
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Pre-compiled regex patterns for performance
 */
function createPeerMessagePattern(username: string): RegExp {
  return new RegExp(`^/apps/ztm/chat/shared/([^/]+)/publish/peers/${escapeRegExp(username)}/messages/`);
}

/**
 * Create ZTM API Client with dependency injection
 */
export function createZTMApiClient(
  config: ZTMChatConfig,
  deps: Partial<ZtmApiClientDeps> = {}
): ZTMApiClient {
  const { logger, fetch, fetchWithRetry: doFetchWithRetry }: ZtmApiClientDeps = {
    ...defaultDeps,
    ...deps,
  };

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
    additionalHeaders?: Record<string, string>,
    retryOverrides?: RetryOptions
  ): ApiResult<T> {
    const url = `${baseUrl}${path}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...additionalHeaders,
    };

    try {
      const response = await doFetchWithRetry(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      }, { timeout: apiTimeout, ...retryOverrides });

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
  let lastPollTime: number | undefined;

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

  async function listFiles(since?: number, retryOverrides?: RetryOptions): ApiResult<Record<string, { hash?: string; size?: number; time?: number }>> {
    const path = `/api/meshes/${config.meshName}/files`;
    const queryParams = since !== undefined ? `?since=${since}` : "";
    return request<Record<string, { hash?: string; size?: number; time?: number }>>("GET", path + queryParams, undefined, undefined, retryOverrides);
  }

  async function readFile<T = unknown>(filePath: string): ApiResult<T> {
    return request<T>("GET", `/api/meshes/${config.meshName}/file-data${filePath}`);
  }

  async function writeFile(filePath: string, data: unknown): ApiResult<void> {
    return request<void>("POST", `/api/meshes/${config.meshName}/file-data${filePath}`, data);
  }

  // Pre-compiled regex pattern for peer message path matching
  const peerMessagePattern = createPeerMessagePattern(config.username);

  // ═════════════════════════════════════════════════════════════════════════════
  // Helper: Find latest file for each peer from file list
  // ════════════════════════════════════════════════════════════════════════
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

  // ═════════════════════════════════════════════════════════════════════════════
  // Helper functions for data transformation
  // ═════════════════════════════════════════════════════════════════════════════

  // Build Chat App API paths
  const CHAT_API_BASE = `/api/meshes/${config.meshName}/apps/ztm/chat/api`;

  /**
   * Parse timestamp from filename
   * @example "123.json" -> 123
   */
  function parseTimestampFromFilename(filename: string): number {
    const match = filename.match(/^(\d+)\.json$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Create an empty chat placeholder when file read/parse fails
   */
  function createEmptyChat(peer: string, time: number): ZTMChat {
    return {
      peer,
      time,
      updated: time,
      latest: { time, message: "", sender: peer },
    };
  }

  /**
   * Find latest file for each peer from file list
   */
  function findLatestFilesByPeer(
    fileList: Record<string, { time?: number }>,
    pattern: RegExp
  ): Map<string, { path: string; time: number; filename: string }> {
    const latestByPeer = new Map<string, { path: string; time: number; filename: string }>();

    for (const filePath of Object.keys(fileList)) {
      const match = filePath.match(pattern);
      if (!match) continue;

      const peer = match[1];
      const meta = fileList[filePath];
      const fileTime = meta?.time ?? 0;
      const existing = latestByPeer.get(peer);

      if (!existing || fileTime > existing.time) {
        const filename = filePath.split('/').pop() ?? '';
        latestByPeer.set(peer, { path: filePath, time: fileTime, filename });
      }
    }

    return latestByPeer;
  }

  const client: ZTMApiClient = {
    readFile<T = unknown>(filePath: string): Promise<Result<T, ZtmApiError | ZtmTimeoutError>> {
      return readFile<T>(filePath);
    },

    async getMeshInfo(): Promise<Result<ZTMMeshInfo, ZtmApiError | ZtmTimeoutError>> {
      return request<ZTMMeshInfo>("GET", `/api/meshes/${config.meshName}`);
    },

    async discoverUsers(): Promise<Result<ZTMUserInfo[], ZtmDiscoveryError>> {
      return client.listUsers();
    },

    async discoverPeers(): Promise<Result<ZTMPeer[], ZtmDiscoveryError>> {
      const usersResult = await client.listUsers();
      if (usersResult.ok) {
        return success(usersResult.value.map(u => ({ username: u.username })));
      }
      return failure(usersResult.error);
    },

    async listUsers(): Promise<Result<ZTMUserInfo[], ZtmDiscoveryError>> {
      logger.debug?.(`[ZTM API] Discovering users via Chat App API`);

      const result = await request<string[]>("GET", `${CHAT_API_BASE}/users`);

      if (!result.ok) {
        logger.error?.(`[ZTM API] Failed to list users: ${result.error.message}`);
        return failure(new ZtmDiscoveryError({
          operation: "discoverUsers",
          source: "ChatAppAPI",
          cause: result.error,
        }));
      }

      const users = result.value.map(username => ({ username }));
      logger.debug?.(`[ZTM API] Discovered ${users.length} users`);
      return success(users);
    },

    async getChats(): Promise<Result<ZTMChat[], ZtmReadError>> {
      logger.debug?.(`[ZTM API] Fetching chats via Chat App API`);

      const result = await request<ZTMChat[]>("GET", `${CHAT_API_BASE}/chats`);

      if (!result.ok) {
        const error = new ZtmReadError({
          peer: "*",
          operation: "list",
          cause: result.error,
        });
        logger.error?.(`[ZTM API] Failed to get chats: ${error.message}`);
        return failure(error);
      }

      const chats = result.value;
      logger.debug?.(`[ZTM API] Got ${chats.length} chats`);
      return success(chats);
    },

    async getPeerMessages(
      peer: string,
      since?: number,
      before?: number
    ): Promise<Result<ZTMMessage[], ZtmReadError>> {
      logger.debug?.(`[ZTM API] Fetching messages from peer "${peer}" since=${since}, before=${before}`);

      const queryParams = new URLSearchParams();
      if (since !== undefined) {
        queryParams.set('since', since.toString());
      }
      if (before !== undefined) {
        queryParams.set('before', before.toString());
      }

      const result = await request<ZTMMessage[]>("GET", `${CHAT_API_BASE}/peers/${peer}/messages?${queryParams.toString()}`);

      if (!result.ok) {
        const error = new ZtmReadError({
          peer,
          operation: "read",
          cause: result.error,
        });
        logger.error?.(`[ZTM API] Failed to get peer messages: ${error.message}`);
        return failure(error);
      }

      const messages = result.value;
      logger.debug?.(`[ZTM API] Fetched ${messages.length} messages from peer "${peer}"`);
      return success(messages);
    },

    async sendPeerMessage(peer: string, message: ZTMMessage): Promise<Result<boolean, ZtmSendError>> {
      logger.debug?.(`[ZTM API] Sending message to peer "${peer}" at time=${message.time}, text="${message.message.substring(0, 50)}..."`);

      const ztmEntry = { time: message.time, message: { text: message.message } };

      const result = await request<void>("POST", `${CHAT_API_BASE}/peers/${peer}/messages`, ztmEntry);

      if (!result.ok) {
        const error = new ZtmSendError({
          peer,
          messageTime: message.time,
          contentPreview: message.message,
          cause: result.error,
        });
        logger.error?.(`[ZTM API] Failed to send message to ${peer}: ${error.message}`);
        return failure(error);
      }

      logger.debug?.(`[ZTM API] Successfully sent message to peer "${peer}"`);
      return success(true);
    },

    async watchChanges(
      prefix: string
    ): Promise<Result<string[], ZtmReadError>> {
      logger.debug?.(`[ZTM API] Watching for changes with prefix="${prefix}"`);

      const chatsResult = await client.getChats();
      if (!chatsResult.ok) {
        const error = new ZtmReadError({
          peer: "*",
          operation: "list",
          cause: chatsResult.error,
        });
        logger.error?.(`[ZTM API] Watch failed for ${prefix}: ${error.message}`);
        return failure(error);
      }

      const changedPeers: string[] = [];

      for (const chat of chatsResult.value) {
        if (!chat.peer || chat.peer === config.username) continue;

        const chatLatestTime = chat.latest?.time ?? 0;
        if (chatLatestTime <= (lastPollTime ?? 0)) continue;

        changedPeers.push(chat.peer);
      }

      if (changedPeers.length > 0) {
        const latestTime = Math.max(...chatsResult.value.map(c => c.latest?.time ?? 0));
        lastPollTime = latestTime;
      }

      logger.debug?.(`[ZTM API] Watch complete: ${changedPeers.length} peers with new messages`);
      return success(changedPeers);
    },

    async getGroups(): Promise<Result<ZTMChat[], ZtmError>> {
      logger.debug?.(`[ZTM API] Groups feature not implemented yet`);
      return success<ZTMChat[], ZtmError>([]);
    },

    async getGroupMessages(
      _creator: string,
      _group: string
    ): Promise<Result<ZTMMessage[], ZtmReadError>> {
      logger.debug?.(`[ZTM API] Group messages feature not implemented yet`);
      return success<ZTMMessage[], ZtmReadError>([]);
    },

    async addFile(
      _data: ArrayBuffer
    ): Promise<Result<string, ZtmError>> {
      logger.debug?.(`[ZTM API] File addition not implemented yet`);
      return success<string, ZtmError>("");
    },

    async getFile(
      _owner: string,
      _hash: string
    ): Promise<Result<ArrayBuffer, ZtmReadError>> {
      logger.debug?.(`[ZTM API] File retrieval not implemented yet`);
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

// Re-export test utilities for backward compatibility
export * from './test-utils.js';

