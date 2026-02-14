// Message processing for ZTM Chat
// Normalizes and validates incoming messages
//
// This module handles the inbound message processing pipeline:
// 1. Validate message has required fields
// 2. Skip empty messages and self-messages
// 3. Check watermark to skip duplicate/already-processed messages
// 4. Enforce DM policy rules
// 5. Return normalized ZTMChatMessage

import { logger } from "../utils/logger.js";
import { getMessageStateStore } from "../runtime/store.js";
import { checkDmPolicy } from "../core/dm-policy.js";
import type { ZTMChatConfig } from "../types/config.js";
import type { ZTMChatMessage } from "../types/messaging.js";

/**
 * Process an incoming message through the validation and policy pipeline.
 *
 * This function performs several processing steps:
 * 1. Skips empty or whitespace-only messages
 * 2. Skips messages from the bot itself (self-m3. Usesessages)
 *  watermark to skip already-processed messages
 * 4. Applies DM policy to determine if message should be accepted
 *
 * @param msg - Raw message object with time, message, and sender
 * @param config - ZTM Chat configuration for policy evaluation
 * @param storeAllowFrom - Optional persisted approved user list
 * @param accountId - Account identifier for watermark tracking (default: "default")
 * @param groupInfo - Optional group info for group messages
 * @returns Processed ZTMChatMessage or null if message should be skipped
 *
 * @example
 * const result = processIncomingMessage(
 *   { time: 1234567890, message: "Hello", sender: "alice" },
 *   { dmPolicy: "pairing", allowFrom: [], username: "bot" }
 * );
 * // result: { id: "1234567890-alice", content: "Hello", sender: "alice", ... }
 */
export function processIncomingMessage(
  msg: { time: number; message: string; sender: string },
  config: ZTMChatConfig,
  storeAllowFrom: string[] = [],
  accountId: string = "default",
  groupInfo?: { creator: string; group: string }
): ZTMChatMessage | null {
  const watermarkKey = groupInfo 
    ? `group:${groupInfo.creator}/${groupInfo.group}`
    : msg.sender;

  // Step 1: Skip empty or whitespace-only messages
  if (typeof msg.message !== "string" || msg.message.trim() === "") {
    logger.debug(`Skipping empty message from ${msg.sender}`);
    return null;
  }

  // Step 2: Skip messages from the bot itself
  if (msg.sender === config.username) {
    logger.debug(`Skipping own message from ${msg.sender}`);
    return null;
  }

  // Step 3: Check watermark (skip already-processed messages)
  const watermark = getMessageStateStore().getWatermark(accountId, watermarkKey);
  if (msg.time <= watermark) {
    logger.debug(`Skipping already-processed message from ${watermarkKey} (time=${msg.time} <= watermark=${watermark})`);
    return null;
  }

  const check = checkDmPolicy(msg.sender, config, storeAllowFrom);

  if (!check.allowed) {
    if (check.action === "request_pairing") {
      logger.debug(`[DM Policy] Pairing request from ${msg.sender}`);
    } else if (check.action === "ignore") {
      logger.debug(`[DM Policy] Ignoring message from ${msg.sender} (${check.reason})`);
    }
    return null;
  }

  // Return normalized message
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
