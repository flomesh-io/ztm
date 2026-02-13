// Message operations API for ZTM Chat

import type { ZTMChatConfig } from "../types/config.js";
import type { ZTMMessage, WatchChangeItem } from "../types/api.js";
import { success, failure, type Result } from "../types/common.js";
import {
  ZtmReadError,
  ZtmSendError,
} from "../types/errors.js";
import type { ZtmLogger, RequestHandler } from "./request.js";
import { normalizeMessageContent } from "./chat-api.js";

/**
 * Create message operations API
 */
export function createMessageApi(
  config: ZTMChatConfig,
  request: RequestHandler,
  logger: ZtmLogger,
  getChats: () => Promise<Result<import("../types/api.js").ZTMChat[], ZtmReadError>>
) {
  const CHAT_API_BASE = `/api/meshes/${config.meshName}/apps/ztm/chat/api`;

  let lastPollTime: number | undefined;

  return {
    /**
     * Get peer messages from Chat App API
     */
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
          cause: result.error ?? new Error("Unknown error"),
        });
        logger.error?.(`[ZTM API] Failed to get peer messages: ${error.message}`);
        return failure(error);
      }

      const messages = (result.value ?? []).map((msg) => ({
        ...msg,
        message: normalizeMessageContent(msg.message),
      }));

      logger.debug?.(`[ZTM API] Fetched ${messages.length} messages from peer "${peer}"`);
      return success(messages);
    },

    /**
     * Send a message to a peer
     */
    async sendPeerMessage(peer: string, message: ZTMMessage): Promise<Result<boolean, ZtmSendError>> {
      logger.debug?.(`[ZTM API] Sending message to peer "${peer}" at time=${message.time}, text="${message.message.substring(0, 50)}..."`);

      const ztmEntry = { text: message.message };

      const result = await request<void>("POST", `${CHAT_API_BASE}/peers/${peer}/messages`, ztmEntry);

      if (!result.ok) {
        const error = new ZtmSendError({
          peer,
          messageTime: message.time,
          contentPreview: message.message,
          cause: result.error ?? new Error("Unknown error"),
        });
        logger.error?.(`[ZTM API] Failed to send message to ${peer}: ${error.message}`);
        return failure(error);
      }

      logger.debug?.(`[ZTM API] Successfully sent message to peer "${peer}"`);
      return success(true);
    },

    /**
     * Get group messages
     */
    async getGroupMessages(
      creator: string,
      group: string
    ): Promise<Result<ZTMMessage[], ZtmReadError>> {
      logger.debug?.(`[ZTM API] Fetching group messages from "${creator}/${group}"`);

      const result = await request<ZTMMessage[]>(
        "GET",
        `${CHAT_API_BASE}/groups/${encodeURIComponent(creator)}/${encodeURIComponent(group)}/messages`
      );

      if (!result.ok) {
        const error = new ZtmReadError({
          peer: `${creator}/${group}`,
          operation: "read",
          cause: result.error ?? new Error("Unknown error"),
        });
        logger.error?.(`[ZTM API] Failed to get group messages: ${error.message}`);
        return failure(error);
      }

      const messages = (result.value ?? []).map((msg) => {
        const msgMessage = msg.message ?? null;
        let normalizedMessage = '';
        if (msgMessage !== null && typeof msgMessage === 'object') {
          normalizedMessage = (msgMessage as { text?: string }).text || JSON.stringify(msgMessage);
        } else {
          normalizedMessage = String(msgMessage ?? '');
        }
        return {
          ...msg,
          message: normalizedMessage,
        };
      });

      logger.debug?.(`[ZTM API] Fetched ${messages.length} messages from group "${creator}/${group}"`);
      return success(messages);
    },

    /**
     * Send a message to a group
     */
    async sendGroupMessage(
      creator: string,
      group: string,
      message: ZTMMessage
    ): Promise<Result<boolean, ZtmSendError>> {
      logger.debug?.(`[ZTM API] Sending message to group "${creator}/${group}", text="${message.message.substring(0, 50)}..."`);

      const ztmEntry = { text: message.message };

      const result = await request<void>(
        "POST",
        `${CHAT_API_BASE}/groups/${encodeURIComponent(creator)}/${encodeURIComponent(group)}/messages`,
        ztmEntry
      );

      if (!result.ok) {
        const error = new ZtmSendError({
          peer: `${creator}/${group}`,
          messageTime: message.time,
          contentPreview: message.message,
          cause: result.error ?? new Error("Unknown error"),
        });
        logger.error?.(`[ZTM API] Failed to send group message: ${error.message}`);
        return failure(error);
      }

      logger.debug?.(`[ZTM API] Successfully sent message to group "${creator}/${group}"`);
      return success(true);
    },

    /**
     * Watch for changes in chats
     */
    async watchChanges(
      prefix: string
    ): Promise<Result<WatchChangeItem[], ZtmReadError>> {
      logger.debug?.(`[ZTM API] Watching for changes with prefix="${prefix}"`);

      const chatsResult = await getChats();
      if (!chatsResult.ok) {
        const error = new ZtmReadError({
          peer: "*",
          operation: "list",
          cause: chatsResult.error ?? new Error("Unknown error"),
        });
        logger.error?.(`[ZTM API] Watch failed for ${prefix}: ${error.message}`);
        return failure(error);
      }

      const changedItems: WatchChangeItem[] = [];

      logger.debug?.(`[ZTM API] Watch: got ${chatsResult.value?.length ?? 0} chats, lastPollTime=${lastPollTime}`);

      for (const chat of chatsResult.value ?? []) {
        const chatLatestTime = chat.latest?.time ?? 0;
        if (chatLatestTime <= (lastPollTime ?? 0)) continue;

        if (chat.peer && chat.peer !== config.username) {
          changedItems.push({ type: 'peer', peer: chat.peer });
        } else if (chat.group && chat.creator) {
          changedItems.push({
            type: 'group',
            creator: chat.creator,
            group: chat.group,
            name: chat.name
          });
        }
      }

      if (changedItems.length > 0) {
        const latestTime = Math.max(...(chatsResult.value ?? []).map(c => c.latest?.time ?? 0));
        lastPollTime = latestTime;
        const peerCount = changedItems.filter(i => i.type === 'peer').length;
        const groupCount = changedItems.filter(i => i.type === 'group').length;
        logger.debug?.(`[ZTM API] Watch: found ${peerCount} peers, ${groupCount} groups with new messages`);
      }

      logger.debug?.(`[ZTM API] Watch complete: ${changedItems.length} chats with new messages`);
      return success(changedItems);
    },

    /**
     * Get the last poll time (for testing)
     */
    getLastPollTime(): number | undefined {
      return lastPollTime;
    },

    /**
     * Set the last poll time (for testing)
     */
    setLastPollTime(time: number): void {
      lastPollTime = time;
    },
  };
}
