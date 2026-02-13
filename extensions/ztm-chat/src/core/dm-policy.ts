// DM (Direct Message) Policy enforcement for ZTM Chat
// Controls which users can send messages based on policy configuration

import type { ZTMChatConfig } from "../types/config.js";
import type { MessageCheckResult } from "../types/messaging.js";

export function checkDmPolicy(
  sender: string,
  config: ZTMChatConfig,
  storeAllowFrom: string[] = []
): MessageCheckResult {
  if (!sender) {
    return { allowed: false, reason: "denied", action: "ignore" };
  }

  const normalizedSender = sender.trim().toLowerCase();

  const allowFrom = config.allowFrom ?? [];
  const isWhitelisted = allowFrom.length > 0 &&
    allowFrom.some((entry) => entry.trim().toLowerCase() === normalizedSender);

  if (isWhitelisted) {
    return { allowed: true, reason: "whitelisted", action: "process" };
  }

  const isStoreApproved = storeAllowFrom.length > 0 &&
    storeAllowFrom.some((entry) => entry.trim().toLowerCase() === normalizedSender);

  if (isStoreApproved) {
    return { allowed: true, reason: "whitelisted", action: "process" };
  }

  const policy = config.dmPolicy ?? "pairing";

  switch (policy) {
    case "allow":
      return { allowed: true, reason: "allowed", action: "process" };

    case "deny":
      return { allowed: false, reason: "denied", action: "ignore" };

    case "pairing":
      return { allowed: false, reason: "pending", action: "request_pairing" };

    default:
      return { allowed: true, reason: "allowed", action: "process" };
  }
}

export function isUserWhitelisted(
  username: string,
  config: ZTMChatConfig,
  storeAllowFrom: string[] = []
): boolean {
  const normalized = username.trim().toLowerCase();
  const allowFrom = config.allowFrom ?? [];

  const inConfig = allowFrom.some((entry) => entry.trim().toLowerCase() === normalized);
  const inStore = storeAllowFrom.some((entry) => entry.trim().toLowerCase() === normalized);

  return inConfig || inStore;
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function isPairingMode(config: ZTMChatConfig): boolean {
  return config.dmPolicy === "pairing";
}
