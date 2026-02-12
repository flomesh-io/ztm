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
  const storeAllowFrom = await rt.channel.pairing.readAllowFromStore("ztm-chat").catch((err: unknown) => {
    logger.error(`[${state.accountId}] readAllowFromStore failed during init: ${err instanceof Error ? err.message : String(err)}`);
    return [] as string[];
  });

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

  const WATCH_INTERVAL = 1000;

  const watchLoop = async (): Promise<void> => {
    const loopStart = Date.now();

    const result = await executeWatchIteration(ctx);

    if (isWatchError(result)) {
      handleWatchError(ctx.state, result.errorMessage, scheduleFullSync);
      const elapsed = Date.now() - loopStart;
      setTimeout(watchLoop, Math.max(0, WATCH_INTERVAL - elapsed));
      return;
    }

    messagesReceivedInCycle = await processChangedPaths(
      ctx,
      result.paths,
      messagesReceivedInCycle,
      scheduleFullSync
    );

    state.watchErrorCount = 0;
    const elapsed = Date.now() - loopStart;
    setTimeout(watchLoop, Math.max(0, WATCH_INTERVAL - elapsed));
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
 * Process all changed peers and handle state updates
 */
async function processChangedPaths(
  ctx: WatchContext,
  changedPeers: string[],
  messagesReceivedInCycle: boolean,
  scheduleFullSync: (storeAllowFrom: string[]) => void
): Promise<boolean> {
  const { state, rt, messageSemaphore } = ctx;

  if (changedPeers.length === 0) {
    return false;
  }

  logger.debug(`[${state.accountId}] Processing ${changedPeers.length} peers with new messages`);

  const loopStoreAllowFrom = await rt.channel.pairing.readAllowFromStore("ztm-chat").catch((err: unknown) => {
    logger.error(`[${state.accountId}] readAllowFromStore failed during watch loop: ${err instanceof Error ? err.message : String(err)}`);
    return [] as string[];
  });

  await Promise.all(
    Array.from(changedPeers).map(peer =>
      messageSemaphore.execute(() =>
        processChangedPeer(state, rt, peer, loopStoreAllowFrom)
      )
    )
  );

  scheduleFullSync(loopStoreAllowFrom);
  if (state.apiClient) {
    getMessageStateStore().setFileMetadataBulk(state.accountId, state.apiClient.exportFileMetadata());
  }

  return true;
}

/**
 * Process all messages for a specific peer
 */
async function processChangedPeer(
  state: AccountRuntimeState,
  rt: ReturnType<typeof getZTMRuntime>,
  peer: string,
  storeAllowFrom: string[]
): Promise<void> {
  if (!state.apiClient) return;

  const messagesResult = await state.apiClient.getPeerMessages(peer);

  if (!messagesResult.ok) {
    logger.warn(`[${state.accountId}] Failed to get messages from peer "${peer}": ${messagesResult.error.message}`);
    return;
  }

  const messages = messagesResult.value;

  for (const msg of messages) {
    const normalized = processIncomingMessage(msg, state.config, storeAllowFrom, state.accountId);
    if (normalized) {
      notifyMessageCallbacks(state, normalized);
    }
  }

  const { checkDmPolicy } = await import("../core/dm-policy.js");
  const check = checkDmPolicy(peer, state.config, storeAllowFrom);
  if (check.action === "request_pairing") {
    const { handlePairingRequest } = await import("../connectivity/permit.js");
    await handlePairingRequest(state, peer, "New message", storeAllowFrom);
  }
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

  if (processedCount > 0) {
    logger.debug(`[${state.accountId}] Full sync completed: ${processedCount} new messages from ${chats.length} peers`);
  }
}
