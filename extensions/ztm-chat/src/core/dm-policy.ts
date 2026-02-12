// DM (Direct Message) Policy enforcement for ZTM Chat
// Controls which users can send messages based on policy configuration

import type { ZTMChatConfig } from "../types/config.js";
import type { MessageCheckResult } from "../types/messaging.js";

/**
 * Check if a sender is allowed to send messages based on DM policy
 *
 * Policies:
 * - "allow": Accept messages from anyone
 * - "deny": Reject all messages
 * - "pairing": Accept only from whitelisted users or initiate pairing flow
 *
 * @param sender - The username of the message sender
 * @param config - ZTM Chat configuration
 * @param pendingPairings - Map of users currently in pairing flow
 * @param storeAllowFrom - Additional whitelist from persistent store
 * @returns MessageCheckResult with allowed status and recommended action
 */
export function checkDmPolicy(
  sender: string,
  config: ZTMChatConfig,
  pendingPairings: Map<string, Date>,
  storeAllowFrom: string[] = []
): MessageCheckResult {
  const normalizedSender = sender.trim().toLowerCase();

  // Check config whitelist first
  const allowFrom = config.allowFrom ?? [];
  const isWhitelisted = allowFrom.length > 0 &&
    allowFrom.some((entry) => entry.trim().toLowerCase() === normalizedSender);

  if (isWhitelisted) {
    return { allowed: true, reason: "whitelisted", action: "process" };
  }

  // Check persistent store whitelist
  const isStoreApproved = storeAllowFrom.length > 0 &&
    storeAllowFrom.some((entry) => entry.trim().toLowerCase() === normalizedSender);

  if (isStoreApproved) {
    return { allowed: true, reason: "whitelisted", action: "process" };
  }

  // Apply DM policy
  const policy = config.dmPolicy ?? "pairing";

  switch (policy) {
    case "allow":
      return { allowed: true, reason: "allowed", action: "process" };

    case "deny":
      return { allowed: false, reason: "denied", action: "ignore" };

    case "pairing":
      // Check if already pending pairing
      if (pendingPairings.has(normalizedSender)) {
        return { allowed: false, reason: "pending", action: "ignore" };
      }
      // Initiate pairing flow
      return { allowed: false, reason: "pending", action: "request_pairing" };

    default:
      // Default to allow for unknown policy (fail open for safety)
      return { allowed: true, reason: "allowed", action: "process" };
  }
}

/**
 * Check if a user is whitelisted (in config or store)
 */
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

/**
 * Normalize a username for consistent comparison
 */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * Check if pairing mode is enabled
 */
export function isPairingMode(config: ZTMChatConfig): boolean {
  return config.dmPolicy === "pairing";
}

/**
 * Check if user is currently pending pairing
 */
export function isPendingPairing(
  username: string,
  pendingPairings: Map<string, Date>
): boolean {
  return pendingPairings.has(normalizeUsername(username));
}

/**
 * Add user to pending pairings
 */
export function addPendingPairing(
  username: string,
  pendingPairings: Map<string, Date>
): void {
  pendingPairings.set(normalizeUsername(username), new Date());
}

/**
 * Remove user from pending pairings (approved or rejected)
 */
export function removePendingPairing(
  username: string,
  pendingPairings: Map<string, Date>
): boolean {
  return pendingPairings.delete(normalizeUsername(username));
}

/**
 * Get all pending pairings that are older than specified duration
 */
export function getExpiredPendingPairings(
  pendingPairings: Map<string, Date>,
  maxAgeMs: number
): string[] {
  const now = Date.now();
  const expired: string[] = [];

  for (const [username, date] of pendingPairings) {
    if (now - date.getTime() > maxAgeMs) {
      expired.push(username);
    }
  }

  return expired;
}

/**
 * Clean up expired pending pairings
 */
export function cleanupExpiredPairings(
  pendingPairings: Map<string, Date>,
  maxAgeMs: number = 60 * 60 * 1000 // 1 hour default
): number {
  const expired = getExpiredPendingPairings(pendingPairings, maxAgeMs);
  for (const username of expired) {
    pendingPairings.delete(username);
  }
  return expired.length;
}
