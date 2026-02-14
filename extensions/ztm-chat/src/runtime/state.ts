// Account runtime state management
// Manages runtime state for multiple ZTM Chat accounts
//
// This module provides:
// - Multi-account state storage using a Map
// - Account initialization and cleanup
// - Runtime start/stop operations
// - State retrieval utilities

import { logger } from "../utils/logger.js";
import { getMessageStateStore } from "./store.js";
import { createZTMApiClient } from "../api/ztm-api.js";
import type { ZTMChatConfig } from "../types/config.js";
import type { ZTMApiClient, ZTMMeshInfo } from "../types/api.js";
import type { AccountRuntimeState } from "../types/runtime.js";
import { isSuccess } from "../types/common.js";

// Re-export types for backward compatibility
export type { AccountRuntimeState };

// Multi-account state management
const accountStates = new Map<string, AccountRuntimeState>();

/**
 * Get an existing account state or create a new one.
 *
 * Each account (identified by accountId) has its own isolated runtime state,
 * including API client, connection status, message callbacks, and more.
 *
 * @param accountId - Unique identifier for the account
 * @returns AccountRuntimeState for the specified account
 *
 * @example
 * const state = getOrCreateAccountState("my-account");
 * // Returns existing state or creates new empty state
 */
export function getOrCreateAccountState(accountId: string): AccountRuntimeState {
  let state = accountStates.get(accountId);
  if (!state) {
    state = {
      accountId,
      config: {} as ZTMChatConfig,
      apiClient: null,
      connected: false,
      meshConnected: false,
      lastError: null,
      lastStartAt: null,
      lastStopAt: null,
      lastInboundAt: null,
      lastOutboundAt: null,
      peerCount: 0,
      messageCallbacks: new Set(),
      watchInterval: null,
      watchErrorCount: 0,
      pendingPairings: new Map(),
    };
    accountStates.set(accountId, state);
  }
  return state;
}

/**
 * Remove an account state and clean up resources.
 *
 * This function removes the account from the state map and cleans up
 * any associated resources like watch intervals and message callbacks.
 *
 * @param accountId - The account identifier to remove
 *
 * @example
 * removeAccountState("my-account");
 * // Account state is removed and resources are cleaned up
 */
export function removeAccountState(accountId: string): void {
  const state = accountStates.get(accountId);
  if (state) {
    if (state.watchInterval) {
      clearInterval(state.watchInterval);
    }
    state.messageCallbacks.clear();
    accountStates.delete(accountId);
  }
}

/**
 * Get all account states.
 *
 * @returns Map of accountId to AccountRuntimeState for all managed accounts
 *
 * @example
 * const allStates = getAllAccountStates();
 * for (const [accountId, state] of allStates) {
 *   console.log(`${accountId}: ${state.connected ? "connected" : "disconnected"}`);
 * }
 */
export function getAllAccountStates(): Map<string, AccountRuntimeState> {
  return accountStates;
}

/**
 * Initialize runtime for an account.
 *
 * This function:
 * 1. Creates or retrieves the account state
 * 2. Initializes the ZTM API client
 * 3. Attempts to connect to the mesh (with retries)
 * 4. Sets up state for message processing
 *
 * @param config - ZTM Chat configuration for this account
 * @param accountId - Unique identifier for the account
 * @returns Promise resolving to true if initialization succeeded, false otherwise
 *
 * @example
 * const success = await initializeRuntime(config, "my-account");
 * if (success) {
 *   console.log("Runtime initialized successfully");
 * }
 */
export async function initializeRuntime(
  config: ZTMChatConfig,
  accountId: string
): Promise<boolean> {
  const state = getOrCreateAccountState(accountId);
  state.config = config;

  const apiClient = createZTMApiClient(config);

  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 100;
  let meshInfo: ZTMMeshInfo | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const meshResult = await apiClient.getMeshInfo();
    if (!isSuccess(meshResult)) {
      if (attempt < MAX_RETRIES) {
        logger.info(
          `[${accountId}] Mesh info request failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_MS}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
      continue;
    }
    meshInfo = meshResult.value;
    if (meshInfo.connected) break;
    if (attempt < MAX_RETRIES) {
      logger.info(
        `[${accountId}] Mesh not yet connected (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_MS}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  if (!meshInfo) {
    state.lastError = "Failed to get mesh info after retries";
    state.connected = false;
    state.meshConnected = false;
    logger.error(`[${accountId}] Initialization failed: ${state.lastError}`);
    return false;
  }

  state.apiClient = apiClient;
  state.connected = true;
  state.meshConnected = meshInfo.connected;
  state.peerCount = meshInfo.endpoints;
  state.lastError = meshInfo.connected ? null : "Not connected to ZTM mesh";

  logger.info(
    `[${accountId}] Connected: mesh=${config.meshName}, peers=${meshInfo.endpoints}`
  );

  return meshInfo.connected;
}

// Stop runtime for an account
/**
 * Stop runtime for an account.
 *
 * This function:
 * 1. Clears any watch intervals
 * 2. Clears message callbacks
 * 3. Marks the account as disconnected
 *
 * Note: The account state is NOT removed - call removeAccountState() to fully clean up.
 *
 * @param accountId - The account identifier to stop
 *
 * @example
 * await stopRuntime("my-account");
 * console.log("Runtime stopped");
 */
export async function stopRuntime(accountId: string): Promise<void> {
  const state = accountStates.get(accountId);
  if (!state) return;

  if (state.watchInterval) {
    clearInterval(state.watchInterval);
    state.watchInterval = null;
  }

  state.messageCallbacks.clear();
  state.apiClient = null;
  state.connected = false;
  state.meshConnected = false;
  state.lastStopAt = new Date();

  getMessageStateStore().flush();

  logger.info(`[${accountId}] Stopped`);
}
