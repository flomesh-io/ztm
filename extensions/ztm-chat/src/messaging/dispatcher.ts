// Message callback dispatching for ZTM Chat
// Handles notification of registered message callbacks

import { logger } from "../utils/logger.js";
import { messageStateStore } from "../runtime/store.js";
import type { AccountRuntimeState } from "../types/runtime.js";
import type { ZTMChatMessage } from "../types/messaging.js";

/**
 * Notify all registered message callbacks for a received message
 *
 * This function:
 * 1. Updates the last inbound timestamp
 * 2. Calls all registered callbacks
 * 3. Handles callback errors gracefully
 * 4. Updates watermark after successful processing
 *
 * @param state - Account runtime state containing callbacks
 * @param message - Normalized message to dispatch
 */
export function notifyMessageCallbacks(
  state: AccountRuntimeState,
  message: ZTMChatMessage
): void {
  // Update last inbound timestamp
  state.lastInboundAt = new Date();

  // Notify all registered callbacks
  let successCount = 0;
  let errorCount = 0;

  for (const callback of state.messageCallbacks) {
    try {
      callback(message);
      successCount++;
    } catch (error) {
      errorCount++;
      logger.error(`[${state.accountId}] Callback error: ${error}`);
    }
  }

  // Log summary if multiple callbacks
  if (state.messageCallbacks.size > 1) {
    logger.debug(
      `[${state.accountId}] Notified ${successCount} callbacks, ${errorCount} errors`
    );
  }

  // Update watermark after processing
  messageStateStore.setWatermark(state.accountId, message.peer, message.timestamp.getTime());
}

/**
 * Get statistics about registered callbacks
 */
export function getCallbackStats(state: AccountRuntimeState): {
  total: number;
  active: number;
} {
  return {
    total: state.messageCallbacks.size,
    active: state.messageCallbacks.size, // All callbacks are considered active
  };
}

/**
 * Check if any callbacks are registered
 */
export function hasCallbacks(state: AccountRuntimeState): boolean {
  return state.messageCallbacks.size > 0;
}

/**
 * Clear all callbacks (useful for cleanup)
 */
export function clearCallbacks(state: AccountRuntimeState): void {
  const count = state.messageCallbacks.size;
  state.messageCallbacks.clear();
  logger.debug(`[${state.accountId}] Cleared ${count} callback(s)`);
}
