// Message watching and polling for ZTM Chat
// Monitors for new messages via Watch mechanism with fallback to polling

import { logger } from "../utils/logger.js";
import { getZTMRuntime } from "../runtime/index.js";
import { getMessageStateStore } from "../runtime/store.js";
import { startPollingWatcher } from "./polling.js";
import { processIncomingMessage } from "./processor.js";
import { notifyMessageCallbacks } from "./dispatcher.js";
import { Semaphore } from "../utils/concurrency.js";
import type { AccountRuntimeState } from "../types/runtime.js";
import { isSuccess } from "../types/common.js";

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
  await seedFileMetadata(state);

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
 * Seed API client with persisted file metadata
 */
async function seedFileMetadata(state: AccountRuntimeState): Promise<void> {
  if (!state.apiClient) return;

  const persistedMetadata = getMessageStateStore().getFileMetadata(state.accountId);
  if (Object.keys(persistedMetadata).length > 0) {
    state.apiClient.seedFileMetadata(persistedMetadata);
    logger.info(
      `[${state.accountId}] Seeded ${Object.keys(persistedMetadata).length} file metadata from persisted state`
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

  const chatsResult = await state.apiClient.getChats();
  if (!isSuccess(chatsResult)) {
    logger.warn(`[${state.accountId}] Initial read failed: ${chatsResult.error?.message}`);
    return;
  }

  const chats = chatsResult.value;
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

  const chatsResult = await state.apiClient.getChats();
  if (!isSuccess(chatsResult)) {
    logger.warn(`[${state.accountId}] Failed to get chats for pairing requests: ${chatsResult.error?.message}`);
    return;
  }

  for (const chat of chatsResult.value) {
    if (chat.peer && chat.peer !== state.config.username) {
      const check = checkDmPolicy(chat.peer, state.config, storeAllowFrom);
      if (check.action === "request_pairing") {
        const { handlePairingRequest } = await import("../connectivity/permit.js");
        await handlePairingRequest(state, chat.peer, "Initial chat request", storeAllowFrom);
      }
    }
  }
}

// Watch context for iteration execution
interface WatchContext {
  state: AccountRuntimeState;
  rt: ReturnType<typeof getZTMRuntime>;
  messagePath: string;
  messageSemaphore: Semaphore;
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

  const ctx: WatchContext = { state, rt, messagePath, messageSemaphore };

  const scheduleFullSync = (storeAllowFrom: string[]): void => {
    if (fullSyncTimer) {
      clearTimeout(fullSyncTimer);
    }
    fullSyncTimer = setTimeout(async () => {
      logger.debug(`[${state.accountId}] Performing delayed full sync after inactivity`);
      await performFullSync(state, storeAllowFrom);
      if (state.apiClient) {
        getMessageStateStore().setFileMetadataBulk(state.accountId, state.apiClient.exportFileMetadata());
      }
    }, FULL_SYNC_DELAY);
  };

  const watchLoop = async (): Promise<void> => {
    const result = await executeWatchIteration(ctx);

    if (isWatchError(result)) {
      handleWatchError(ctx.state, result.errorMessage, scheduleFullSync);
      setTimeout(watchLoop, 1000);
      return;
    }

    messagesReceivedInCycle = await processChangedPaths(
      ctx,
      result.paths,
      messagesReceivedInCycle,
      scheduleFullSync
    );

    state.watchErrorCount = 0;
    setTimeout(watchLoop, 1000);
  };

  watchLoop();
}

// Result type for watch iteration
type WatchResult =
  | { success: false; errorMessage: string }
  | { success: true; paths: string[] };

function isWatchError(result: WatchResult): result is { success: false; errorMessage: string } {
  return !result.success;
}

/**
 * Execute a single watch iteration and return changed paths
 */
async function executeWatchIteration(ctx: WatchContext): Promise<WatchResult> {
  const { state, messagePath } = ctx;
  if (!state.apiClient || !state.config) {
    return { success: false, errorMessage: "API client or config not available" };
  }

  const changedResult = await state.apiClient.watchChanges(messagePath);
  if (!isSuccess(changedResult)) {
    return { success: false, errorMessage: changedResult.error?.message ?? "Unknown watch error" };
  }

  return { success: true, paths: changedResult.value };
}

/**
 * Handle watch errors and decide whether to fallback to polling
 */
function handleWatchError(
  state: AccountRuntimeState,
  errorMessage: string,
  scheduleFullSync: (storeAllowFrom: string[]) => void
): void {
  state.watchErrorCount++;
  logger.warn(`[${state.accountId}] Watch error (${state.watchErrorCount}): ${errorMessage}`);

  if (state.watchErrorCount > 5) {
    scheduleFullSync([]);
    logger.warn(`[${state.accountId}] Too many watch errors, falling back to polling`);
    state.watchErrorCount = 0;
    startPollingWatcher(state);
  }
}

/**
 * Process all changed paths and handle state updates
 */
async function processChangedPaths(
  ctx: WatchContext,
  changedPaths: string[],
  messagesReceivedInCycle: boolean,
  scheduleFullSync: (storeAllowFrom: string[]) => void
): Promise<boolean> {
  const { state, rt, messageSemaphore } = ctx;

  if (changedPaths.length === 0) {
    return false;
  }

  logger.debug(`[${state.accountId}] Watch detected changes: ${changedPaths.length} paths`);
  const loopStoreAllowFrom = await rt.channel.pairing.readAllowFromStore("ztm-chat").catch(() => [] as string[]);

  await Promise.all(
    changedPaths.map(path => processChangedPath(state, path, loopStoreAllowFrom, messageSemaphore))
  );

  scheduleFullSync(loopStoreAllowFrom);
  if (state.apiClient) {
    getMessageStateStore().setFileMetadataBulk(state.accountId, state.apiClient.exportFileMetadata());
  }

  return true;
}

/**
 * Perform full sync of all peers to catch missed messages in append-only files
 */
async function performFullSync(
  state: AccountRuntimeState,
  storeAllowFrom: string[]
): Promise<void> {
  if (!state.apiClient) return;

  const chatsResult = await state.apiClient.getChats();
  if (!isSuccess(chatsResult)) {
    logger.warn(`[${state.accountId}] Full sync failed: ${chatsResult.error?.message}`);
    return;
  }

  const chats = chatsResult.value;
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

  const messagesResult = await state.apiClient.getPeerMessages(peer);
  if (!isSuccess(messagesResult)) {
    logger.warn(`[${state.accountId}] Failed to read messages from ${peer}: ${messagesResult.error?.message}`);
    return;
  }

  const messages = messagesResult.value;
  for (const msg of messages) {
    const normalized = processIncomingMessage(
      msg,
      state.config,
      storeAllowFrom,
      state.accountId
    );
    if (normalized) {
      notifyMessageCallbacks(state, normalized);
    }
  }

  // Check for pairing request
  const { checkDmPolicy } = await import("../core/dm-policy.js");
  const check = checkDmPolicy(peer, state.config, storeAllowFrom);
  if (check.action === "request_pairing") {
    const { handlePairingRequest } = await import("../connectivity/permit.js");
    await handlePairingRequest(state, peer, "New message", storeAllowFrom);
  }
}
