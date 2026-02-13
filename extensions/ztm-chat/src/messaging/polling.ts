// Fallback polling watcher for ZTM Chat

import { logger } from "../utils/logger.js";
import { getZTMRuntime } from "../runtime/index.js";
import { processIncomingMessage, notifyMessageCallbacks, checkDmPolicy } from "./inbound.js";
import { handlePairingRequest } from "../connectivity/permit.js";
import type { AccountRuntimeState } from "../runtime/state.js";
import { handleResult } from "../utils/result.js";

// Fallback polling watcher (when watch is unavailable)
export async function startPollingWatcher(state: AccountRuntimeState): Promise<void> {
  const { config, apiClient } = state;
  if (!apiClient) return;

  const rawInterval = (config as Record<string, unknown>).pollingInterval;
  const pollingInterval = typeof rawInterval === "number" ? Math.max(rawInterval, 1000) : 2000;

  logger.info(`[${state.accountId}] Starting polling watcher (${pollingInterval}ms)`);

  state.watchInterval = setInterval(async () => {
    if (!state.apiClient || !state.config) return;

    const pollStoreAllowFrom = await getZTMRuntime().channel.pairing.readAllowFromStore("ztm-chat").catch((err: unknown) => {
      logger.error(`[${state.accountId}] readAllowFromStore failed during polling: ${err instanceof Error ? err.message : String(err)}`);
      return [] as string[];
    });
    const chatsResult = await state.apiClient.getChats();
    const chats = handleResult(chatsResult, {
      operation: "getChats",
      peer: state.accountId,
      logger,
      logLevel: "debug"
    });
    if (!chats) return;
    for (const chat of chats) {
      const isGroup = !!(chat.creator && chat.group);
      
      if (isGroup) {
        if (!chat.latest) continue;
        const sender = chat.latest.sender || "";
        if (sender === config.username) continue;
        
        const normalized = processIncomingMessage(
          {
            time: chat.latest.time,
            message: chat.latest.message,
            sender: sender,
          },
          config,
          pollStoreAllowFrom,
          state.accountId,
          { creator: chat.creator!, group: chat.group! }
        );
        if (normalized) {
          notifyMessageCallbacks(state, {
            ...normalized,
            isGroup: true,
            groupName: chat.name,
            groupCreator: chat.creator,
          });
        }
        continue;
      }
      
      // Peer chat
      if (!chat.peer || chat.peer === config.username) continue;
      if (chat.latest) {
        const normalized = processIncomingMessage(
          {
            time: chat.latest.time,
            message: chat.latest.message,
            sender: chat.peer,
          },
          config,
          pollStoreAllowFrom,
          state.accountId
        );
        if (normalized) {
          notifyMessageCallbacks(state, normalized);
        }

        const check = checkDmPolicy(chat.peer, config, pollStoreAllowFrom);
        if (check.action === "request_pairing") {
          await handlePairingRequest(state, chat.peer, "Polling check", pollStoreAllowFrom);
        }
      }
    }
  }, pollingInterval);
}
