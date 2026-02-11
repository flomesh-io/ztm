// Fallback polling watcher for ZTM Chat

import { logger } from "../utils/logger.js";
import { getZTMRuntime } from "../runtime.js";
import { processIncomingMessage, notifyMessageCallbacks } from "./inbound.js";
import type { AccountRuntimeState } from "../runtime/state.js";

// Fallback polling watcher (when watch is unavailable)
export async function startPollingWatcher(state: AccountRuntimeState): Promise<void> {
  const { config, apiClient } = state;
  if (!apiClient) return;

  const pollingInterval = Math.max(
    (config as any).pollingInterval ?? 2000,
    1000
  );

  logger.info(`[${state.accountId}] Starting polling watcher (${pollingInterval}ms)`);

  state.watchInterval = setInterval(async () => {
    if (!state.apiClient || !state.config) return;

    try {
      const pollStoreAllowFrom = await getZTMRuntime().channel.pairing.readAllowFromStore("ztm-chat").catch(() => [] as string[]);
      const chats = await state.apiClient.getChats();
      for (const chat of chats) {
        if (!chat.peer || chat.peer === config.username) continue;
        if (chat.latest) {
          const normalized = processIncomingMessage(
            {
              time: chat.latest.time,
              message: chat.latest.message,
              sender: chat.peer,
            },
            config,
            state.pendingPairings,
            pollStoreAllowFrom,
            state.accountId
          );
          if (normalized) {
            notifyMessageCallbacks(state, normalized);
          }

          const check = (await import("./inbound.js")).checkDmPolicy(chat.peer, config, state.pendingPairings, pollStoreAllowFrom);
          if (check.action === "request_pairing") {
            const { handlePairingRequest } = await import("../connectivity/permit.js");
            await handlePairingRequest(state, chat.peer, "Polling check", pollStoreAllowFrom);
          }
        }
      }
    } catch (error) {
      logger.debug(`[${state.accountId}] Polling error: ${error}`);
    }
  }, pollingInterval);
}
