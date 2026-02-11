// ZTM Chat Runtime Types
// Runtime state and management types

import type { ZTMChatConfig } from './config.js';
import type { ZTMChatMessage } from './messaging.js';

// Runtime state per account
export interface AccountRuntimeState {
  accountId: string;
  config: ZTMChatConfig;
  apiClient: import('./api.js').ZTMApiClient | null;
  connected: boolean;
  meshConnected: boolean;
  lastError: string | null;
  lastStartAt: Date | null;
  lastStopAt: Date | null;
  lastInboundAt: Date | null;
  lastOutboundAt: Date | null;
  peerCount: number;
  messageCallbacks: Set<(message: ZTMChatMessage) => void>;
  watchInterval: ReturnType<typeof setInterval> | null;
  watchErrorCount: number;
  // Pairing state for dmPolicy="pairing"
  pendingPairings: Map<string, Date>;
}

// ZTM Chat runtime with additional state
export interface ZTMChatRuntimeState {
  pendingPairings: Map<string, Date>;
}
