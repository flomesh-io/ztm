// Message processing for ZTM Chat
// Normalizes and validates incoming messages

import { logger } from "../utils/logger.js";
import { getMessageStateStore } from "../runtime/store.js";
import { messageDeduplicator } from "./dedup.js";
import { checkDmPolicy } from "../core/dm-policy.js";
import type { ZTMChatConfig } from "../types/config.js";
import type { ZTMChatMessage } from "../types/messaging.js";

/**
 * Process an incoming ZTM message and normalize it
 *
 * Steps:
 * 1. Skip empty messages
 * 2. Check watermark (already processed)
 * 3. Check for duplicates
 * 4. Apply DM policy
 * 5. Return normalized message or null
 *
 * @param msg - Raw message from ZTM API
 * @param config - ZTM Chat configuration
 * @param pendingPairings - Map of pending pairing requests
 * @param storeAllowFrom - Whitelist from persistent store
 * @param accountId - Account identifier for watermark tracking
 * @returns Normalized message or null if rejected
 */
export function processIncomingMessage(
  msg: { time: number; message: string; sender: string },
  config: ZTMChatConfig,
  pendingPairings: Map<string, Date>,
  storeAllowFrom: string[] = [],
  accountId: string = "default"
): ZTMChatMessage | null {
  // Step 1: Skip empty or whitespace-only messages
  if (!msg.message || msg.message.trim() === "") {
    logger.debug(`Skipping empty message from ${msg.sender}`);
    return null;
  }

  // Step 2: Check watermark (skip already-processed messages)
  const watermark = getMessageStateStore().getWatermark(accountId, msg.sender);
  if (msg.time <= watermark) {
    logger.debug(`Skipping already-processed message from ${msg.sender} (time=${msg.time} <= watermark=${watermark})`);
    return null;
  }

  // Step 3: Check for duplicates
  if (messageDeduplicator.isDuplicate(msg.sender, msg.time)) {
    logger.debug(`Skipping duplicate message from ${msg.sender}`);
    return null;
  }

  // Step 4: Apply DM policy
  const check = checkDmPolicy(msg.sender, config, pendingPairings, storeAllowFrom);

  if (!check.allowed) {
    if (check.action === "request_pairing") {
      logger.info(`[DM Policy] Pairing request from ${msg.sender}`);
    } else if (check.action === "ignore") {
      logger.debug(`[DM Policy] Ignoring message from ${msg.sender} (${check.reason})`);
    }
    return null;
  }

  // Step 5: Return normalized message
  return {
    id: `${msg.time}-${msg.sender}`,
    content: msg.message,
    sender: msg.sender,
    senderId: msg.sender,
    timestamp: new Date(msg.time),
    peer: msg.sender,
  };
}

/**
 * Validate if a message object has required fields
 */
export function isValidMessage(msg: unknown): msg is { time: number; message: string; sender: string } {
  if (!msg || typeof msg !== "object") return false;
  const obj = msg as { time?: unknown; message?: unknown; sender?: unknown };
  return (
    typeof obj.time === "number" &&
    typeof obj.message === "string" &&
    typeof obj.sender === "string" &&
    obj.sender.length > 0
  );
}

/**
 * Create a unique message ID from timestamp and sender
 */
export function createMessageId(time: number, sender: string): string {
  return `${time}-${sender}`;
}

/**
 * Parse and normalize message content
 */
export function parseMessageContent(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && raw !== null) {
    const msg = raw as { text?: string; message?: string };
    return msg.text || msg.message || JSON.stringify(raw);
  }
  return String(raw ?? "");
}
