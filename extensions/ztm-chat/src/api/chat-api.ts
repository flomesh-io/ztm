// Chat operations API for ZTM Chat

import type { ZTMChatConfig } from "../types/config.js";
import type { ZTMChat } from "../types/api.js";
import { success, failure, type Result } from "../types/common.js";
import {
  ZtmReadError,
} from "../types/errors.js";
import type { ZtmLogger, RequestHandler, ApiResult } from "./request.js";

/**
 * Normalize message content from API format to plain string.
 * Handles cases where message is:
 * - A plain string
 * - An object with {text: "..."}
 * - An object with {message: {text: "..."}} (nested format)
 */
export function normalizeMessageContent(message: unknown): string {
  if (message === null || message === undefined) {
    return '';
  }
  if (typeof message === 'object') {
    // Handle nested {message: {text: "..."}} format
    const nestedMessage = (message as { message?: unknown }).message;
    if (nestedMessage !== undefined && nestedMessage !== null && typeof nestedMessage === 'object') {
      const nestedText = (nestedMessage as { text?: string }).text;
      if (typeof nestedText === 'string') {
        return nestedText;
      }
      return JSON.stringify(nestedMessage);
    }
    // Handle standard {text: "..."} format
    const text = (message as { text?: string }).text;
    if (typeof text === 'string') {
      return text;
    }
    return JSON.stringify(message);
  }
  return String(message);
}

/**
 * Create chat operations API
 */
export function createChatApi(
  config: ZTMChatConfig,
  request: RequestHandler,
  logger: ZtmLogger
) {
  const CHAT_API_BASE = `/api/meshes/${config.meshName}/apps/ztm/chat/api`;

  return {
    /**
     * Get all chats from the Chat App API
     */
    async getChats(): Promise<Result<ZTMChat[], ZtmReadError>> {
      logger.debug?.(`[ZTM API] Fetching chats via Chat App API`);

      const result = await request<ZTMChat[]>("GET", `${CHAT_API_BASE}/chats`);

      if (!result.ok) {
        const error = new ZtmReadError({
          peer: "*",
          operation: "list",
          cause: result.error ?? new Error("Unknown error"),
        });
        logger.error?.(`[ZTM API] Failed to get chats: ${error.message}`);
        return failure(error);
      }

      // Normalize message format: convert {text: "..."} to string
      const chats = (result.value ?? []).map((chat) => {
        if (chat.latest) {
          return {
            ...chat,
            latest: {
              ...chat.latest,
              message: normalizeMessageContent(chat.latest?.message),
            },
          };
        }
        return chat;
      });

      logger.debug?.(`[ZTM API] Got ${chats.length} chats`);
      return success(chats);
    },
  };
}
