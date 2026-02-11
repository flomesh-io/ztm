// Message watching and polling for ZTM Chat
// Monitors for new messages via Watch mechanism with fallback to polling

import { logger } from "../logger.js";
import { getZTMRuntime } from "../runtime.js";
import { messageStateStore } from "../runtime/store.js";
import { startPollingWatcher } from "./polling.js";
import { processIncomingMessage } from "./processor.js";
import { notifyMessageCallbacks } from "./dispatcher.js";
import { Semaphore } from "../utils/concurrency.js";
import type { AccountRuntimeState } from "../types/runtime.js";

// Peer message path pattern
const PEER_MESSAGE_PATTERN = /\/apps\/ztm\/chat\/shared\/([^/]+)\/publish\/peers\/.*\/messages\//;

/**
 * Start message watcher using ZTM's Watch mechanism
 *
 * The watcher:
 * 1. Seeds API client with persisted file timestamps
 * 2. Performs initial sync of all existing messages
 * 3. Starts a watch loop that polls for changes every 1 second
 * 4. Falls back to polling if watch errors accumulate
 *
 * @param state - Account runtime state with config and API client
 */
export async function startMessageWatcher(
  state: AccountRuntimeState
): Promise<void> {
  const { config, apiClient } = state;
  if (!apiClient) return;

  const messagePath = "/apps/ztm/chat/shared/";

  // Step 1: Seed the API client's lastSeenTimes from persisted state
  await seedFileTimestamps(state);

  // Step 2: Get initial allowFrom store
  const rt = getZTMRuntime();
  const storeAllowFrom = await rt.channel.pairing.readAllowFromStore("ztm-chat").catch(() => [] as string[]);

  // Step 3: Initial sync - read all existing messages
  await performInitialSync(state, storeAllowFrom);

  // Step 4: Handle pairing requests from initial sync
  await handleInitialPairingRequests(state, storeAllowFrom);

  // Step 5: Start watch loop
  startWatchLoop(state, rt, messagePath);
}

/**
 * Seed API client with persisted file timestamps
 */
async function seedFileTimestamps(state: AccountRuntimeState): Promise<void> {
  if (!state.apiClient) return;

  const persistedFileTimes = messageStateStore.getFileTimes(state.accountId);
  if (Object.keys(persistedFileTimes).length > 0) {
    state.apiClient.seedLastSeenTimes(persistedFileTimes);
    logger.info(
      `[${state.accountId}] Seeded ${Object.keys(persistedFileTimes).length} file timestamps from persisted state`
    );
  }
}

/**
 * Perform initial sync of all existing messages
 */
async function performInitialSync(
  state: AccountRuntimeState,
  storeAllowFrom: string[]
): Promise<void> {
  if (!state.apiClient) return;

  try {
    const chats = await state.apiClient.getChats();
    let processedCount = 0;

    for (const chat of chats) {
      if (!chat.peer || chat.peer === state.config.username) continue;
      if (chat.latest) {
        const normalized = processIncomingMessage(
          {
            time: chat.latest.time,
            message: chat.latest.message,
            sender: chat.peer,
          },
          state.config,
          state.pendingPairings,
          storeAllowFrom,
          state.accountId
        );
        if (normalized) {
          notifyMessageCallbacks(state, normalized);
          processedCount++;
        }
      }
    }

    logger.info(`[${state.accountId}] Initial sync: ${chats.length} chats, ${processedCount} messages processed`);
  } catch (error) {
    logger.warn(`[${state.accountId}] Initial read failed: ${error}`);
  }
}

/**
 * Handle pairing requests from initial sync
 */
async function handleInitialPairingRequests(
  state: AccountRuntimeState,
  storeAllowFrom: string[]
): Promise<void> {
  if (!state.apiClient) return;

  const { checkDmPolicy } = await import("../core/dm-policy.js");

  for (const chat of (await state.apiClient.getChats()) || []) {
    if (chat.peer && chat.peer !== state.config.username) {
      const check = checkDmPolicy(chat.peer, state.config, state.pendingPairings, storeAllowFrom);
      if (check.action === "request_pairing") {
        const { handlePairingRequest } = await import("../connectivity/permit.js");
        await handlePairingRequest(state, chat.peer, "Initial chat request", storeAllowFrom);
      }
    }
  }
}

/**
 * Start the watch loop that monitors for changes
 */
function startWatchLoop(
  state: AccountRuntimeState,
  rt: ReturnType<typeof getZTMRuntime>,
  messagePath: string
): void {
  const messageSemaphore = new Semaphore(5);
  const FULL_SYNC_DELAY = 30000;
  let lastMessageTime = Date.now();
  let fullSyncTimer: ReturnType<typeof setTimeout> | null = null;
  let messagesReceivedInCycle = false;

  const scheduleFullSync = (storeAllowFrom: string[]) => {
    if (fullSyncTimer) {
      clearTimeout(fullSyncTimer);
    }
    fullSyncTimer = setTimeout(async () => {
      logger.debug(`[${state.accountId}] Performing delayed full sync after inactivity`);
      await performFullSync(state, storeAllowFrom);
      if (state.apiClient) {
        messageStateStore.setFileTimes(state.accountId, state.apiClient.exportLastSeenTimes());
      }
    }, FULL_SYNC_DELAY);
  };

  const watchLoop = async (): Promise<void> => {
    if (!state.apiClient || !state.config) return;

    try {
      const changedPaths = await state.apiClient.watchChanges(messagePath);
      messagesReceivedInCycle = changedPaths.length > 0;

      if (messagesReceivedInCycle) {
        logger.debug(`[${state.accountId}] Watch detected changes: ${changedPaths.length} paths`);
        lastMessageTime = Date.now();
      }

      const loopStoreAllowFrom = await rt.channel.pairing.readAllowFromStore("ztm-chat").catch(() => [] as string[]);

      for (const path of changedPaths) {
        await processChangedPath(state, path, loopStoreAllowFrom, messageSemaphore);
      }

      if (messagesReceivedInCycle) {
        scheduleFullSync(loopStoreAllowFrom);
        if (state.apiClient) {
          messageStateStore.setFileTimes(state.accountId, state.apiClient.exportLastSeenTimes());
        }
      }

      state.watchErrorCount = 0;
    } catch (error) {
      state.watchErrorCount++;
      logger.warn(`[${state.accountId}] Watch error (${state.watchErrorCount}): ${error}`);

      if (state.watchErrorCount > 5) {
        if (fullSyncTimer) clearTimeout(fullSyncTimer);
        logger.warn(`[${state.accountId}] Too many watch errors, falling back to polling`);
        state.watchErrorCount = 0;
        await startPollingWatcher(state);
        return;
      }
    }

    setTimeout(watchLoop, 1000);
  };

  watchLoop();
}

/**
 * Perform full sync of all peers to catch missed messages in append-only files
 */
async function performFullSync(
  state: AccountRuntimeState,
  storeAllowFrom: string[]
): Promise<void> {
  if (!state.apiClient) return;

  try {
    const chats = await state.apiClient.getChats();
    let processedCount = 0;

    for (const chat of chats) {
      if (!chat.peer || chat.peer === state.config.username) continue;

      // Re-process all messages from this peer, watermark will skip already-processed ones
      await processPeerMessages(state, chat.peer, storeAllowFrom);
      processedCount++;
    }

    if (processedCount > 0) {
      logger.debug(`[${state.accountId}] Full sync completed: checked ${processedCount} peers`);
    }
  } catch (error) {
    logger.warn(`[${state.accountId}] Full sync failed: ${error}`);
  }
}

/**
 * Process a single changed path
 */
async function processChangedPath(
  state: AccountRuntimeState,
  path: string,
  storeAllowFrom: string[],
  semaphore: Semaphore
): Promise<void> {
  await semaphore.acquire();
  try {
    const match = path.match(PEER_MESSAGE_PATTERN);
    if (!match) {
      semaphore.release();
      return;
    }

    const peer = match[1];
    if (peer === state.config.username) {
      semaphore.release();
      return;
    }

    // Process messages from this peer
    await processPeerMessages(state, peer, storeAllowFrom);
  } catch (error) {
    logger.warn(`[${state.accountId}] Error processing path ${path}: ${error}`);
  } finally {
    semaphore.release();
  }
}

/**
 * Process all messages from a specific peer
 */
async function processPeerMessages(
  state: AccountRuntimeState,
  peer: string,
  storeAllowFrom: string[]
): Promise<void> {
  if (!state.apiClient) return;

  try {
    const messages = await state.apiClient.getPeerMessages(peer);
    if (messages) {
      for (const msg of messages) {
        const normalized = processIncomingMessage(
          msg,
          state.config,
          state.pendingPairings,
          storeAllowFrom,
          state.accountId
        );
        if (normalized) {
          notifyMessageCallbacks(state, normalized);
        }
      }
    }

    // Check for pairing request
    const { checkDmPolicy } = await import("../core/dm-policy.js");
    const check = checkDmPolicy(peer, state.config, state.pendingPairings, storeAllowFrom);
    if (check.action === "request_pairing") {
      const { handlePairingRequest } = await import("../connectivity/permit.js");
      await handlePairingRequest(state, peer, "New message", storeAllowFrom);
    }
  } catch (error) {
    logger.warn(`[${state.accountId}] Failed to read messages from ${peer}: ${error}`);
  }
}
