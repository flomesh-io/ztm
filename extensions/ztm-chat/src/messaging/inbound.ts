// Inbound message processing for ZTM Chat

import { logger } from "../logger.js";
import { getZTMRuntime } from "../runtime.js";
import { messageStateStore } from "../runtime/store.js";
import { messageDeduplicator } from "./dedup.js";
import type { AccountRuntimeState } from "../runtime/state.js";
import type { ZTMChatConfig } from "../config.js";
import type { ZTMApiClient, ZTMMeshInfo } from "../ztm-api.js";
import { startPollingWatcher } from "./polling.js";

// Local type for ZTM chat messages (normalized)
export interface ZTMChatMessage {
  id: string;
  content: string;
  sender: string;
  senderId: string;
  timestamp: Date;
  peer: string;
  thread?: string;
}

// Message processing result
export interface MessageCheckResult {
  allowed: boolean;
  reason?: "allowed" | "denied" | "pending" | "whitelisted";
  action?: "process" | "ignore" | "request_pairing";
}

// Simple Semaphore implementation for concurrency control
class Semaphore {
  private permits: number;
  private waiters: Array<{ resolve: () => void }> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise((resolve) => {
      this.waiters.push({ resolve });
    });
  }

  release(): void {
    this.permits++;
    if (this.waiters.length > 0) {
      this.permits--;
      const waiter = this.waiters.shift();
      waiter?.resolve();
    }
  }
}

// Check if a sender is allowed to send messages
export function checkDmPolicy(
  sender: string,
  config: ZTMChatConfig,
  pendingPairings: Map<string, Date>,
  storeAllowFrom: string[] = []
): MessageCheckResult {
  const normalizedSender = sender.trim().toLowerCase();

  const allowFrom = config.allowFrom ?? [];
  const isWhitelisted = allowFrom.length > 0 &&
    allowFrom.some((entry) => entry.trim().toLowerCase() === normalizedSender);

  if (isWhitelisted) {
    return { allowed: true, reason: "whitelisted", action: "process" };
  }

  const isStoreApproved = storeAllowFrom.length > 0 &&
    storeAllowFrom.some((entry) => entry.trim().toLowerCase() === normalizedSender);

  if (isStoreApproved) {
    return { allowed: true, reason: "whitelisted", action: "process" };
  }

  const policy = config.dmPolicy ?? "pairing";

  switch (policy) {
    case "allow":
      return { allowed: true, reason: "allowed", action: "process" };

    case "deny":
      return { allowed: false, reason: "denied", action: "ignore" };

    case "pairing":
      // Check if already pending
      if (pendingPairings.has(normalizedSender)) {
        return { allowed: false, reason: "pending", action: "ignore" };
      }
      // Request pairing
      return { allowed: false, reason: "pending", action: "request_pairing" };

    default:
      // Default to allow for unknown policy
      return { allowed: true, reason: "allowed", action: "process" };
  }
}

export function processIncomingMessage(
  msg: { time: number; message: string; sender: string },
  config: ZTMChatConfig,
  pendingPairings: Map<string, Date>,
  storeAllowFrom: string[] = [],
  accountId: string = "default"
): ZTMChatMessage | null {
  // Skip empty or whitespace-only messages
  if (!msg.message || msg.message.trim() === "") {
    logger.debug(`Skipping empty message from ${msg.sender}`);
    return null;
  }

  const watermark = messageStateStore.getWatermark(accountId, msg.sender);
  if (msg.time <= watermark) {
    logger.debug(`Skipping already-processed message from ${msg.sender} (time=${msg.time} <= watermark=${watermark})`);
    return null;
  }

  if (messageDeduplicator.isDuplicate(msg.sender, msg.time, msg.message)) {
    logger.debug(`Skipping duplicate message from ${msg.sender}`);
    return null;
  }

  const check = checkDmPolicy(msg.sender, config, pendingPairings, storeAllowFrom);

  if (!check.allowed) {
    if (check.action === "request_pairing") {
      logger.info(`[DM Policy] Pairing request from ${msg.sender}`);
    } else if (check.action === "ignore") {
      logger.debug(`[DM Policy] Ignoring message from ${msg.sender} (${check.reason})`);
    }
    return null;
  }

  return {
    id: `${msg.time}-${msg.sender}`,
    content: msg.message,
    sender: msg.sender,
    senderId: msg.sender,
    timestamp: new Date(msg.time),
    peer: msg.sender,
  };
}

// Notify all message callbacks
export function notifyMessageCallbacks(
  state: AccountRuntimeState,
  message: ZTMChatMessage
): void {
  state.lastInboundAt = new Date();
  for (const callback of state.messageCallbacks) {
    try {
      callback(message);
    } catch (error) {
      logger.error(`[${state.accountId}] Callback error: ${error}`);
    }
  }
  messageStateStore.setWatermark(state.accountId, message.peer, message.timestamp.getTime());
}

// Start message watcher with Watch mechanism
export async function startMessageWatcher(
  state: AccountRuntimeState
): Promise<void> {
  const { config, apiClient } = state;
  if (!apiClient) return;

  const messagePath = "/apps/ztm/chat/shared/";

  // Seed the API client's lastSeenTimes from persisted state
  const persistedFileTimes = messageStateStore.getFileTimes(state.accountId);
  if (Object.keys(persistedFileTimes).length > 0) {
    apiClient.seedLastSeenTimes(persistedFileTimes);
    logger.info(`[${state.accountId}] Seeded ${Object.keys(persistedFileTimes).length} file timestamps from persisted state`);
  }

  const rt = getZTMRuntime();
  const storeAllowFrom = await rt.channel.pairing.readAllowFromStore("ztm-chat").catch(() => [] as string[]);

  // Initial read of all messages (watermark check in processIncomingMessage will skip old ones)
  try {
    const chats = await apiClient.getChats();
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
          storeAllowFrom,
          state.accountId
        );
        if (normalized) {
          notifyMessageCallbacks(state, normalized);
        }
      }
    }
    logger.info(`[${state.accountId}] Initial sync: ${chats.length} chats`);
  } catch (error) {
    logger.warn(`[${state.accountId}] Initial read failed: ${error}`);
  }

  // Handle pairing requests for initial chats
  for (const chat of (await apiClient.getChats()) || []) {
    if (chat.peer && chat.peer !== config.username) {
      const check = checkDmPolicy(chat.peer, config, state.pendingPairings, storeAllowFrom);
      if (check.action === "request_pairing") {
        const { handlePairingRequest } = await import("../connectivity/permit.js");
        await handlePairingRequest(state, chat.peer, "Initial chat request", storeAllowFrom);
      }
    }
  }

  // Start watching for changes
  const watchLoop = async (): Promise<void> => {
    if (!state.apiClient || !state.config) return;

    // Semaphore to limit concurrent message processing
    const messageSemaphore = new Semaphore(5);

    try {
      const changedPaths = await state.apiClient.watchChanges(messagePath);

      if (changedPaths.length > 0) {
        logger.debug(`[${state.accountId}] Watch detected changes: ${changedPaths.length} paths`);
      }

      const loopStoreAllowFrom = await rt.channel.pairing.readAllowFromStore("ztm-chat").catch(() => [] as string[]);

      for (const path of changedPaths) {
        await messageSemaphore.acquire();
        try {
          const match = path.match(
            /\/apps\/ztm\/chat\/shared\/([^/]+)\/publish\/peers\/.*\/messages/
          );
          if (!match) {
            messageSemaphore.release();
            continue;
          }
          const peer = match[1];
          if (peer === state.config.username) {
            messageSemaphore.release();
            continue;
          }
          try {
            const messages = await state.apiClient!.getPeerMessages(peer);
            if (messages) {
              for (const msg of messages) {
                const normalized = processIncomingMessage(
                  msg,
                  state.config,
                  state.pendingPairings,
                  loopStoreAllowFrom,
                  state.accountId
                );
                if (normalized) {
                  notifyMessageCallbacks(state, normalized);
                }
              }
            }

            const check = checkDmPolicy(peer, state.config, state.pendingPairings, loopStoreAllowFrom);
            if (check.action === "request_pairing") {
              const { handlePairingRequest } = await import("../connectivity/permit.js");
              await handlePairingRequest(state, peer, "New message", loopStoreAllowFrom);
            }
          } catch (error) {
            logger.warn(`[${state.accountId}] Failed to read messages from ${peer}: ${error}`);
          } finally {
            messageSemaphore.release();
          }
        } catch (error) {
          logger.warn(`[${state.accountId}] Error processing path ${path}: ${error}`);
          messageSemaphore.release();
        }
      }

      if (changedPaths.length > 0 && state.apiClient) {
        messageStateStore.setFileTimes(state.accountId, state.apiClient.exportLastSeenTimes());
      }

      state.watchErrorCount = 0;
    } catch (error) {
      state.watchErrorCount++;
      logger.warn(
        `[${state.accountId}] Watch error (${state.watchErrorCount}): ${error}`
      );

      if (state.watchErrorCount > 5) {
        logger.warn(`[${state.accountId}] Too many watch errors, falling back to polling`);
        state.watchErrorCount = 0; // Reset for fresh start in polling mode
        await startPollingWatcher(state);
        return;
      }
    }

    setTimeout(watchLoop, 1000);
  };

  watchLoop();
}
