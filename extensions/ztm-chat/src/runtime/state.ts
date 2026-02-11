// Account runtime state management

import { logger } from "../logger.js";
import { messageStateStore } from "./store.js";
import { createZTMApiClient } from "../ztm-api.js";
import type { ZTMChatConfig } from "../config.js";
import type { ZTMApiClient, ZTMMeshInfo } from "../ztm-api.js";

// Runtime state per account
export interface AccountRuntimeState {
  accountId: string;
  config: ZTMChatConfig;
  apiClient: ZTMApiClient | null;
  connected: boolean;
  meshConnected: boolean;
  lastError: string | null;
  lastStartAt: Date | null;
  lastStopAt: Date | null;
  lastInboundAt: Date | null;
  lastOutboundAt: Date | null;
  peerCount: number;
  messageCallbacks: Set<(message: import("../messaging/inbound.js").ZTMChatMessage) => void>;
  watchInterval: ReturnType<typeof setInterval> | null;
  watchErrorCount: number;
  // Pairing state for dmPolicy="pairing"
  pendingPairings: Map<string, Date>;
}

// Multi-account state management
const accountStates = new Map<string, AccountRuntimeState>();

// Get or create account state
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

  try {
    const apiClient = createZTMApiClient(config);

    const MAX_RETRIES = 10;
    const RETRY_DELAY_MS = 2000;
    let meshInfo: ZTMMeshInfo | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      meshInfo = await apiClient.getMeshInfo();
      if (meshInfo.connected) break;
      if (attempt < MAX_RETRIES) {
        logger.info(
          `[${accountId}] Mesh not yet connected (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_MS}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }

    state.apiClient = apiClient;
    state.connected = true;
    state.meshConnected = meshInfo!.connected;
    state.peerCount = meshInfo!.endpoints;
    state.lastError = meshInfo!.connected ? null : "Not connected to ZTM mesh";

    logger.info(
      `[${accountId}] Connected: mesh=${config.meshName}, peers=${meshInfo!.endpoints}`
    );

    return meshInfo!.connected;
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : String(error);
    state.connected = false;
    state.meshConnected = false;
    logger.error(`[${accountId}] Initialization failed: ${state.lastError}`);
    return false;
  }
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

  messageStateStore.flush();

  logger.info(`[${accountId}] Stopped`);
}
