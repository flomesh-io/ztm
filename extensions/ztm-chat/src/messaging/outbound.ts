// Outbound message sending for ZTM Chat

import { logger } from "../utils/logger.js";
import { type ZTMMessage } from "../api/ztm-api.js";
import type { AccountRuntimeState } from "../runtime/state.js";

// Helper to generate unique message ID
export function generateMessageId(): string {
  return `ztm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Send message to peer
export async function sendZTMMessage(
  state: AccountRuntimeState,
  peer: string,
  content: string
): Promise<boolean> {
  if (!state.config || !state.apiClient) {
    state.lastError = "Runtime not initialized";
    return false;
  }

  const message: ZTMMessage = {
    time: Date.now(),
    message: content,
    sender: state.config.username,
  };

  try {
    const success = await state.apiClient.sendPeerMessage(peer, message);

    if (success) {
      state.lastOutboundAt = new Date();
      logger.info(`[${state.accountId}] Message sent to ${peer}: ${content.substring(0, 50)}...`);
    }

    return success;
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : String(error);
    logger.error(`[${state.accountId}] Send failed: ${state.lastError}`);
    return false;
  }
}
