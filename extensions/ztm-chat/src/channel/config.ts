// ZTM Chat Channel Configuration
// Configuration parsing and schema utilities

import * as fs from "fs";
import * as path from "node:path";
import type { TSchema } from "@sinclair/typebox";
import type { OpenClawConfig } from "openclaw/plugin-sdk";
import type { ZTMChatConfig } from "../types/config.js";
import { ZTMChatConfigSchema } from "../config/index.js";
import {
  resolveZTMChatConfig,
  getDefaultConfig,
  mergeAccountConfig,
} from "../config/index.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Resolved ZTM chat account with configuration
 */
export interface ResolvedZTMChatAccount {
  accountId: string;
  username: string;
  enabled: boolean;
  config: ZTMChatConfig;
}

// ============================================================================
// External Config Reading
// ============================================================================

/**
 * Read channel config from external file (~/.openclaw/ztm/config.json)
 */
export function readExternalChannelConfig(): Record<string, unknown> | null {
  try {
    const configPath = path.join(
      process.env.HOME || "",
      ".openclaw",
      "ztm",
      "config.json",
    );
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      return JSON.parse(content);
    }
  } catch {
    // Ignore read/parse errors
  }
  return null;
}

/**
 * Get effective channel config: cfg.channels["ztm-chat"] or external file fallback
 */
export function getEffectiveChannelConfig(
  cfg?: OpenClawConfig,
): Record<string, unknown> | null {
  const inlineConfig = cfg?.channels?.["ztm-chat"] as Record<string, unknown>;
  if (
    inlineConfig &&
    typeof inlineConfig === "object" &&
    Object.keys(inlineConfig).length > 0
  ) {
    return inlineConfig;
  }
  return readExternalChannelConfig();
}

// ============================================================================
// Account Resolution
// ============================================================================

/**
 * List available ZTM chat account IDs
 */
export function listZTMChatAccountIds(cfg?: OpenClawConfig): string[] {
  const channelConfig = getEffectiveChannelConfig(cfg);
  const accounts = channelConfig?.accounts as Record<string, unknown> | undefined;
  if (accounts && typeof accounts === "object") {
    const ids = Object.keys(accounts);
    if (ids.length > 0) return ids;
  }
  // Fallback: return ["default"] so the channel appears in channels status
  return ["default"];
}

/**
 * Resolve a ZTM chat account with its configuration
 */
export function resolveZTMChatAccount({
  cfg,
  accountId,
}: {
  cfg?: OpenClawConfig;
  accountId?: string;
}): ResolvedZTMChatAccount {
  const channelConfig = getEffectiveChannelConfig(cfg);
  const accountKey = accountId ?? "default";

  if (!channelConfig) {
    return {
      accountId: accountKey,
      username: accountKey,  // Use accountKey as default username
      enabled: true,  // Default to enabled
      config: getDefaultConfig(),
    };
  }

  const accounts = channelConfig.accounts as Record<string, unknown> | undefined;
  const account = (accounts?.[accountKey] ?? accounts?.default ?? {}) as Record<string, unknown>;

  // Merge base config with account-level overrides (account takes precedence)
  const merged = mergeAccountConfig(channelConfig, account);

  const config = resolveZTMChatConfig(merged);

  return {
    accountId: accountKey,
    username: (merged.username as string) ?? accountKey,
    enabled: (merged.enabled as boolean) ?? (channelConfig.enabled as boolean) ?? true,
    config,
  };
}

// ============================================================================
// UI Schema Hints
// ============================================================================

/**
 * Build channel config schema with UI hints for the configuration UI
 */
export function buildChannelConfigSchemaWithHints(
  _schema: TSchema,
) {
  return {
    schema: {},
    parse(value: unknown) {
      return resolveZTMChatConfig(value);
    },
    uiHints: {
      agentUrl: {
        label: "ZTM Agent URL",
        placeholder: "https://ztm-agent.example.com:7777",
        help: "URL of your ZTM Agent API server",
        required: true,
        validation: {
          pattern: "^https?://",
          message: "Must start with http:// or https://",
        },
      },
      meshName: {
        label: "Mesh Name",
        placeholder: "my-mesh",
        help: "Name of your ZTM mesh network",
        required: true,
        validation: {
          pattern: "^[a-zA-Z0-9_-]+$",
          message: "Only letters, numbers, hyphens, and underscores",
        },
      },
      username: {
        label: "Bot Username",
        placeholder: "openclaw-bot",
        help: "Username for the bot account in ZTM",
        required: true,
        validation: {
          pattern: "^[a-zA-Z0-9_-]+$",
          message: "Only letters, numbers, hyphens, and underscores",
        },
      },
      enableGroups: {
        label: "Enable Groups",
        help: "Enable group chat support (future feature)",
        advanced: true,
      },
      autoReply: {
        label: "Auto Reply",
        help: "Automatically reply to messages using AI agent",
        default: true,
      },
      messagePath: {
        label: "Message Path",
        help: "Custom message path prefix (advanced)",
        placeholder: "/shared",
        advanced: true,
      },
    },
  };
}
