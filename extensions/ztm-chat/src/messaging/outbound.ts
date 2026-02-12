// Outbound message sending for ZTM Chat

import { logger } from "../utils/logger.js";
import { type ZTMMessage } from "../api/ztm-api.js";
import type { AccountRuntimeState } from "../runtime/state.js";
import { type Result } from "../types/common.js";
import { ZtmSendError } from "../types/errors.js";
import { handleResult } from "../utils/result.js";

// Helper to generate unique message ID
export function generateMessageId(): string {
  return `ztm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Send message to peer using Result<T, E> pattern.
 *
 * @param state - Account runtime state
 * @param peer - Peer username to send to
 * @param content - Message content
 * @returns Result indicating success with true value, or failure with ZtmSendError
 *
 * @example
 * ```typescript
 * const result = await sendZTMMessage(state, "alice", "Hello!");
 * if (isSuccess(result)) {
 *   console.log("Message sent successfully");
 * } else {
 *   console.error("Failed:", result.error.message);
 * }
 * ```
 */
export async function sendZTMMessage(
  state: AccountRuntimeState,
  peer: string,
  content: string
): Promise<Result<boolean, ZtmSendError>> {
  if (!state.config || !state.apiClient) {
    const error = new ZtmSendError({
      peer,
      messageTime: Date.now(),
      cause: new Error("Runtime not initialized"),
    });
    state.lastError = error.message;
    return { ok: false, error };
  }

  const message: ZTMMessage = {
    time: Date.now(),
    message: content,
    sender: state.config.username,
  };

  const result = await state.apiClient.sendPeerMessage(peer, message);

  handleResult(result, {
    operation: "sendPeerMessage",
    peer: state.accountId,
    logger,
    onSuccess: () => {
      state.lastOutboundAt = new Date();
    },
    onError: (err) => {
      state.lastError = err.message;
    }
  });

  return result;
}
