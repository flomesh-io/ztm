// Fallback polling watcher for ZTM Chat

import { logger } from "../utils/logger.js";
import { getZTMRuntime } from "../runtime.js";
import { getPairingStateStore } from "../runtime/pairing-store.js";
import { processIncomingMessage, notifyMessageCallbacks } from "./inbound.js";
import type { AccountRuntimeState } from "../runtime/state.js";
import { handleResult } from "../utils/result.js";

// Fallback polling watcher (when watch is unavailable)
export async function startPollingWatcher(state: AccountRuntimeState): Promise<void> {
  const { config, apiClient } = state;
  if (!apiClient) return;

  const rawInterval = (config as Record<string, unknown>).pollingInterval;
  const pollingInterval = typeof rawInterval === "number" ? Math.max(rawInterval, 1000) : 2000;

  logger.info(`[${state.accountId}] Starting polling watcher (${pollingInterval}ms)`);

  const CLEANUP_INTERVAL_ITERATIONS = 300;
  let iterationCount = 0;

  state.watchInterval = setInterval(async () => {
    if (!state.apiClient || !state.config) return;

    iterationCount++;
    if (iterationCount >= CLEANUP_INTERVAL_ITERATIONS) {
      iterationCount = 0;
      const cleanedCount = getPairingStateStore().cleanupExpiredPairings(state.accountId);
      if (cleanedCount > 0) {
        const refreshed = getPairingStateStore().loadPendingPairings(state.accountId);
        state.pendingPairings.clear();
        refreshed.forEach((date, peer) => state.pendingPairings.set(peer, date));
      }
    }

    const pollStoreAllowFrom = await getZTMRuntime().channel.pairing.readAllowFromStore("ztm-chat").catch(() => [] as string[]);
    const chatsResult = await state.apiClient.getChats();
    const chats = handleResult(chatsResult, {
      operation: "getChats",
      peer: state.accountId,
      logger,
      logLevel: "debug"
    });
    if (!chats) return;
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
  }, pollingInterval);
}
