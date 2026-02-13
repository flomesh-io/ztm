// ZTM Chat State Management
// Account snapshot building and state utilities

import type { ZTMChatConfig } from "../types/config.js";
import { isConfigMinimallyValid } from "../config/validation.js";
import { getAllAccountStates } from "../runtime/state.js";
import type { ResolvedZTMChatAccount } from "./config.js";

// ============================================================================
// Build Account Snapshot
// ============================================================================

/**
 * Build account snapshot for status display
 */
export function buildAccountSnapshot({
  account,
}: {
  account: ResolvedZTMChatAccount;
}): {
  accountId: string;
  name: string;
  enabled: boolean;
  configured: boolean;
  running: boolean;
  connected: boolean;
  meshConnected: boolean;
  lastStartAt: number | null;
  lastStopAt: number | null;
  lastError: string | null;
  lastInboundAt: number | null;
  lastOutboundAt: number | null;
  peerCount: number;
} {
  const accountStates = getAllAccountStates();
  const state = accountStates.get(account.accountId);

  return {
    accountId: account.accountId,
    name: account.username,
    enabled: account.enabled,
    configured: isConfigMinimallyValid(account.config as ZTMChatConfig),
    running: state?.connected ?? false,
    connected: state?.meshConnected ?? false,
    meshConnected: state?.meshConnected ?? false,
    lastStartAt: state?.lastStartAt ? Number(state.lastStartAt) : null,
    lastStopAt: state?.lastStopAt ? Number(state.lastStopAt) : null,
    lastError: state?.lastError ?? null,
    lastInboundAt: state?.lastInboundAt ? Number(state.lastInboundAt) : null,
    lastOutboundAt: state?.lastOutboundAt ? Number(state.lastOutboundAt) : null,
    peerCount: state?.peerCount ?? 0,
  };
}
