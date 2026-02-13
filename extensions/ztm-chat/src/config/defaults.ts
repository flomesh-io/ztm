// ZTM Chat Configuration Defaults and Resolution
// Default values and configuration resolution logic

import type { ZTMChatConfig, ExtendedZTMChatConfig } from "../types/config.js";
import type { DMPolicy } from "./schema.js";

/**
 * Get default configuration
 */
export function getDefaultConfig(): ZTMChatConfig {
  return {
    agentUrl: "http://localhost:7777",
    permitUrl: "https://ztm-portal.flomesh.io:7779/permit",
    meshName: "openclaw-mesh",
    username: "openclaw-bot",
    enableGroups: false,
    autoReply: true,
    messagePath: "/shared",
    dmPolicy: "pairing",
    allowFrom: undefined,
    apiTimeout: 30000,
  };
}

/**
 * Resolve raw config with defaults
 */
export function resolveZTMChatConfig(raw: unknown): ZTMChatConfig {
  if (!raw || typeof raw !== "object") {
    return getDefaultConfig();
  }

  const config = raw as Record<string, unknown>;

  return {
    agentUrl:
      typeof config.agentUrl === "string" && config.agentUrl.trim()
        ? config.agentUrl.trim()
        : "http://localhost:7777",
    permitUrl:
      typeof config.permitUrl === "string" && config.permitUrl.trim()
        ? config.permitUrl.trim()
        : "https://ztm-portal.flomesh.io:7779/permit",
    meshName:
      typeof config.meshName === "string" && config.meshName.trim()
        ? config.meshName.trim()
        : "openclaw-mesh",
    username:
      typeof config.username === "string" && config.username.trim()
        ? config.username.trim()
        : "openclaw-bot",
    enableGroups: Boolean(config.enableGroups),
    autoReply: config.autoReply !== false, // default true
    messagePath:
      typeof config.messagePath === "string" && config.messagePath.trim()
        ? config.messagePath.trim()
        : "/shared",
    dmPolicy: ["allow", "deny", "pairing"].includes(config.dmPolicy as string)
      ? (config.dmPolicy as DMPolicy)
      : "pairing",
    allowFrom: Array.isArray(config.allowFrom)
      ? config.allowFrom.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean)
      : undefined,
    apiTimeout: typeof config.apiTimeout === "number" && config.apiTimeout >= 1000
      ? Math.min(config.apiTimeout, 300000)
      : 30000,
  };
}

/**
 * Create a partial config for probing
 */
export function createProbeConfig(
  config: Partial<ZTMChatConfig>
): ZTMChatConfig {
  return {
    agentUrl: config.agentUrl ?? "http://localhost:7777",
    permitUrl: config.permitUrl ?? "https://ztm-portal.flomesh.io:7779/permit",
    meshName: config.meshName ?? "openclaw-mesh",
    username: config.username ?? "probe",
    enableGroups: config.enableGroups ?? false,
    autoReply: config.autoReply ?? true,
    messagePath: config.messagePath ?? "/shared",
    dmPolicy: config.dmPolicy ?? "pairing",
    allowFrom: config.allowFrom,
    apiTimeout: config.apiTimeout ?? 30000,
  };
}

/**
 * Merge base config with account overrides
 */
export function mergeAccountConfig(
  baseConfig: Record<string, unknown>,
  accountConfig: Record<string, unknown>
): Record<string, unknown> {
  const { accounts: _ignored, ...cleanBase } = baseConfig;
  return { ...cleanBase, ...accountConfig };
}
