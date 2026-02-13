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
  WatchChangeItem,
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
import type { Logger } from "../utils/logger.js";
import { defaultLogger } from "../utils/logger.js";
import { fetchWithRetry, type FetchWithRetry } from "../utils/retry.js";

import {
  createRequestHandler,
  defaultDeps,
  type ZtmApiClientDeps,
  type ZtmLogger,
  type RequestHandler,
} from "./request.js";

import { createMeshApi } from "./mesh-api.js";
import { createChatApi, normalizeMessageContent } from "./chat-api.js";
import { createMessageApi } from "./message-api.js";
import { createFileApi } from "./file-api.js";

// Re-export types for backward compatibility
export type { ZTMMessage, ZTMPeer, ZTMUserInfo, ZTMMeshInfo, ZTMChat, ZTMApiClient, ZtmApiClientDeps };

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
 * Parse message file content and return Result
 */
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
      const messageText = normalizeMessageContent(entry.message);
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
  const apiTimeout = config.apiTimeout || 30000;

  // Create the request handler
  const request = createRequestHandler(baseUrl, apiTimeout, {
    logger,
    fetch,
    fetchWithRetry: doFetchWithRetry,
  });

  // Pre-compiled regex pattern for peer message path matching
  const peerMessagePattern = createPeerMessagePattern(config.username);

  // Create the various API modules
  const meshApi = createMeshApi(config, request, logger);
  const chatApi = createChatApi(config, request, logger);
  const fileApi = createFileApi(config, request, logger);

  // Create message API with getChats dependency
  const messageApi = createMessageApi(
    config,
    request,
    logger,
    () => chatApi.getChats()
  );

  const client: ZTMApiClient = {
    getMeshInfo: meshApi.getMeshInfo,

    discoverUsers: meshApi.discoverUsers,

    discoverPeers: meshApi.discoverPeers,

    listUsers: meshApi.listUsers,

    getChats: chatApi.getChats,

    getPeerMessages: messageApi.getPeerMessages,

    sendPeerMessage: messageApi.sendPeerMessage,

    watchChanges: messageApi.watchChanges,

    getGroupMessages: messageApi.getGroupMessages,

    sendGroupMessage: messageApi.sendGroupMessage,

    seedFileMetadata: fileApi.seedFileMetadata,

    exportFileMetadata: fileApi.exportFileMetadata,
  };

  return client;
}

// Re-export test utilities for backward compatibility
export * from './test-utils.js';
