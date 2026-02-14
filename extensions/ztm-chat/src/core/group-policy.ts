// Group Policy enforcement for ZTM Chat
// Controls which users can send group messages and what tools are available
//
// Group Policy Types:
// - "open": Allow all messages (with optional mention requirement)
// - "disabled": Block all group messages
// - "allowlist": Only allow whitelisted senders

import type { ZTMChatConfig } from "../types/config.js";
import type {
  GroupPolicy,
  GroupPermissions,
  GroupMessageCheckResult,
} from "../types/group-policy.js";

// Default tool permissions for groups
const DEFAULT_ALLOWED_TOOLS = ["group:messaging", "group:sessions"];

/**
 * Default group permissions when no configuration is provided
 */
const DEFAULT_GROUP_PERMISSIONS: GroupPermissions = {
  creator: "",
  group: "",
  groupPolicy: "allowlist",
  requireMention: true,
  allowFrom: [],
  tools: {
    allow: DEFAULT_ALLOWED_TOOLS,
  },
};

/**
 * Get group permissions from config for a specific group
 *
 * @param creator - Group creator username
 * @param group - Group ID
 * @param config - ZTM Chat configuration
 * @returns GroupPermissions for the specified group
 *
 * @example
 * const perms = getGroupPermission("alice", "123456", config);
 */
export function getGroupPermission(
  creator: string,
  group: string,
  config: ZTMChatConfig
): GroupPermissions {
  const key = `${creator}/${group}`;
  const groupPermissions = config.groupPermissions ?? {};
  const channelGroupPolicy = config.groupPolicy ?? "allowlist";
  // Get global requireMention (defaults to true if not specified)
  const channelRequireMention = config.requireMention ?? true;

  // Check if there's a per-group configuration
  if (groupPermissions[key]) {
    const perGroup = groupPermissions[key]!;
    return {
      creator: perGroup.creator ?? creator,
      group: perGroup.group ?? group,
      groupPolicy: perGroup.groupPolicy ?? channelGroupPolicy,
      // Per-group overrides global, fallback to global or default
      requireMention: perGroup.requireMention ?? channelRequireMention,
      allowFrom: perGroup.allowFrom ?? [],
      tools: perGroup.tools,
      toolsBySender: perGroup.toolsBySender,
    };
  }

  // Return default permissions with provided creator and group
  return {
    ...DEFAULT_GROUP_PERMISSIONS,
    creator,
    group,
    groupPolicy: channelGroupPolicy,
    // Use global requireMention when no per-group config
    requireMention: channelRequireMention,
  };
}

/**
 * Check if a message contains a @mention of the bot
 *
 * @param content - Message content
 * @param botUsername - Bot username to check for
 * @returns true if message contains @mention
 */
function hasMention(content: string, botUsername: string): boolean {
  const normalizedContent = content.toLowerCase();
  const normalizedBot = botUsername.toLowerCase();

  // Check for @username format
  const mentionPatterns = [
    `@${normalizedBot}`,
    `@${normalizedBot.replace(/[^a-zA-Z0-9_-]/g, "")}`,
  ];

  return mentionPatterns.some((pattern) => normalizedContent.includes(pattern));
}

/**
 * Normalize a username for comparison
 *
 * @param username - Username to normalize
 * @returns Normalized username (lowercase, trimmed)
 */
function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * Check if sender is whitelisted in allowFrom list
 *
 * @param sender - Sender to check
 * @param allowFrom - Whitelist array
 * @returns true if sender is whitelisted
 */
function isWhitelisted(sender: string, allowFrom: string[]): boolean {
  const normalizedSender = normalizeUsername(sender);
  return allowFrom.some((entry) => normalizeUsername(entry) === normalizedSender);
}

/**
 * Check if sender is the group creator
 *
 * @param sender - Sender to check
 * @param creator - Group creator
 * @returns true if sender is the creator
 */
function isCreator(sender: string, creator: string): boolean {
  return normalizeUsername(sender) === normalizeUsername(creator);
}

/**
 * Check group message policy to determine if message should be processed
 *
 * This function evaluates:
 * 1. Whether sender is the group creator (always allowed)
 * 2. Group policy (open/disabled/allowlist)
 * 3. AllowFrom whitelist
 * 4. Mention requirement
 *
 * @param sender - Username of the message sender
 * @param content - Message content
 * @param permissions - Group permissions configuration
 * @param botUsername - Bot username for mention detection
 * @returns GroupMessageCheckResult with allowed flag, reason, and action
 *
 * @example
 * // Check if Bob can send message to a group
 * const result = checkGroupPolicy("bob", "hello", {
 *   creator: "alice",
 *   group: "test-group",
 *   groupPolicy: "allowlist",
 *   requireMention: true,
 *   allowFrom: ["bob", "charlie"],
 * }, "chatbot");
 */
export function checkGroupPolicy(
  sender: string,
  content: string,
  permissions: GroupPermissions,
  botUsername: string
): GroupMessageCheckResult {
  if (!sender) {
    return { allowed: false, reason: "denied", action: "ignore" };
  }

  const isSenderCreator = isCreator(sender, permissions.creator);

  // Creator always bypasses groupPolicy and allowFrom checks
  // But still subject to requireMention check

  // If not creator, check groupPolicy and allowFrom
  if (!isSenderCreator) {
    switch (permissions.groupPolicy) {
      case "disabled":
        return { allowed: false, reason: "denied", action: "ignore" };

      case "allowlist":
        if (!isWhitelisted(sender, permissions.allowFrom)) {
          return { allowed: false, reason: "whitelisted", action: "ignore" };
        }
        break;

      case "open":
        // open policy allows all non-creator senders
        break;

      default:
        return { allowed: false, reason: "denied", action: "ignore" };
    }
  }

  // requireMention check applies to ALL users (including creator)
  if (permissions.requireMention) {
    const mentioned = hasMention(content, botUsername);
    if (!mentioned) {
      return {
        allowed: false,
        reason: "mention_required",
        action: "ignore",
        wasMentioned: false,
      };
    }
  }

  // Passed all checks
  return {
    allowed: true,
    reason: isSenderCreator ? "creator" : permissions.groupPolicy === "allowlist" ? "whitelisted" : "allowed",
    action: "process",
    wasMentioned: hasMention(content, botUsername),
  };
}

/**
 * Apply tool restrictions based on group permissions
 *
 * This function filters the available tools based on:
 * 1. Group-level tools.allow and tools.deny
 * 2. Sender-specific toolsBySender overrides
 *
 * @param sender - Message sender
 * @param permissions - Group permissions with tool restrictions
 * @param allTools - Complete list of available tools
 * @returns Filtered list of allowed tools
 *
 * @example
 * // Apply tool restrictions
 * const tools = applyGroupToolsPolicy("bob", {
 *   creator: "alice",
 *   group: "test",
 *   groupPolicy: "open",
 *   requireMention: false,
 *   allowFrom: [],
 *   tools: { deny: ["group:fs", "group:ui"] },
 * }, ["group:messaging", "group:sessions", "group:fs", "group:ui", "exec"]);
 *
 * // Result: ["group:messaging", "group:sessions", "exec"]
 */
export function applyGroupToolsPolicy(
  sender: string,
  permissions: GroupPermissions,
  allTools: string[]
): string[] {
  const senderPolicy = permissions.toolsBySender?.[sender];

  // Start with group-level tools config
  let effectiveAllow = permissions.tools?.allow;
  let effectiveDeny = permissions.tools?.deny ?? [];

  // Apply sender-specific overrides
  if (senderPolicy) {
    // If sender has alsoAllow and no group-level allow, add alsoAllow to the pool
    if (senderPolicy.alsoAllow) {
      if (effectiveAllow) {
        // Merge with group allow
        effectiveAllow = [...effectiveAllow, ...senderPolicy.alsoAllow];
      } else {
        // No group allow, so alsoAllow removes the group-level deny
        effectiveDeny = effectiveDeny.filter(d => !senderPolicy.alsoAllow!.includes(d));
      }
    }
    if (senderPolicy.deny) {
      effectiveDeny = [...effectiveDeny, ...senderPolicy.deny];
    }
  }

  // If no restrictions at all, return all tools
  if (!effectiveAllow && effectiveDeny.length === 0) {
    return allTools;
  }

  let result = allTools;

  // Apply allow list first (if specified)
  if (effectiveAllow && effectiveAllow.length > 0) {
    result = result.filter((tool) => effectiveAllow!.includes(tool));
  }

  // Apply deny list
  if (effectiveDeny.length > 0) {
    result = result.filter((tool) => !effectiveDeny.includes(tool));
  }

  return result;
}
