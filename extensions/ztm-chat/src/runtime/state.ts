// Account runtime state management

import { logger } from "../utils/logger.js";
import { getMessageStateStore } from "./store.js";
import { getPairingStateStore } from "./pairing-store.js";
import { createZTMApiClient } from "../api/ztm-api.js";
import type { ZTMChatConfig } from "../types/config.js";
import type { ZTMApiClient, ZTMMeshInfo } from "../types/api.js";
import type { AccountRuntimeState } from "../types/runtime.js";
import { isSuccess } from "../types/common.js";

// Re-export types for backward compatibility
export type { AccountRuntimeState };

// Multi-account state management
const accountStates = new Map<string, AccountRuntimeState>();

// Get or create account state
export function getOrCreateAccountState(accountId: string): AccountRuntimeState {
  let state = accountStates.get(accountId);
  if (!state) {
    const persistedPairings = getPairingStateStore().loadPendingPairings(accountId);
    
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
      pendingPairings: persistedPairings,
    };
    accountStates.set(accountId, state);
    
    if (persistedPairings.size > 0) {
      logger.info(`[${accountId}] Restored ${persistedPairings.size} pending pairing(s) from store`);
    }
  }
  return state;
}

// Remove account state
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

// Get all account states
export function getAllAccountStates(): Map<string, AccountRuntimeState> {
  return accountStates;
}

// Initialize runtime for an account
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
  getPairingStateStore().flush();

  logger.info(`[${accountId}] Stopped`);
}
