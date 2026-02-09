// ZTM Chat Configuration Schema
// Uses TypeBox for schema definition (compatible with OpenClaw SDK)

import { Type, type TSchema, type Static } from "@sinclair/typebox";

// DM Policy type
export type DMPolicy = "allow" | "deny" | "pairing";

// Helper validators
const isValidUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

// ZTM Chat Configuration Schema
export const ZTMChatConfigSchema = Type.Object({
  agentUrl: Type.String({
    description: "ZTM Agent API URL (e.g., http://localhost:7777)",
    format: "uri",
  }),
  permitUrl: Type.String({
    description: "Permit Server URL (e.g., https://ztm-portal.flomesh.io:7779/permit)",
    format: "uri",
  }),
  meshName: Type.String({
    description: "ZTM mesh name",
    minLength: 1,
    maxLength: 64,
    pattern: "^[a-zA-Z0-9_-]+$",
  }),
  username: Type.String({
    description: "Bot's ZTM username",
    minLength: 1,
    maxLength: 64,
    pattern: "^[a-zA-Z0-9_-]+$",
  }),
  enableGroups: Type.Optional(Type.Boolean({
    description: "Enable group chat support",
    default: false,
  })),
  autoReply: Type.Optional(Type.Boolean({
    description: "Automatically reply to messages",
    default: true,
  })),
  messagePath: Type.Optional(Type.String({
    description: "Custom message path prefix",
    default: "/shared",
  })),
  dmPolicy: Type.Optional(Type.String({
    description: "Direct message policy: allow, deny, or pairing",
    enum: ["allow", "deny", "pairing"],
    default: "allow",
  })),
  allowFrom: Type.Optional(Type.Array(Type.String({
    description: "List of allowed sender usernames",
  }))),
});

export type ZTMChatConfig = Static<typeof ZTMChatConfigSchema>;

// Extended config with allowFrom (for wizard output)
export interface ExtendedZTMChatConfig extends ZTMChatConfig {
  allowFrom?: string[];
}

// Validation result type
export interface ZTMChatConfigValidation {
  valid: boolean;
  errors: string[];
  config?: ZTMChatConfig;
}

// Validate configuration with detailed errors
export function validateZTMChatConfig(
  raw: unknown
): ZTMChatConfigValidation {
  const errors: string[] = [];

  if (!raw || typeof raw !== "object") {
    return {
      valid: false,
      errors: ["Invalid configuration format"],
    };
  }

  const config = raw as Record<string, unknown>;

  // Check required fields
  if (!config.agentUrl || typeof config.agentUrl !== "string" || !config.agentUrl.trim()) {
    errors.push("agentUrl is required");
  } else if (!isValidUrl(config.agentUrl)) {
    errors.push("agentUrl must be a valid HTTP/HTTPS URL (e.g., https://ztm-agent.example.com:7777)");
  }

  if (!config.permitUrl || typeof config.permitUrl !== "string" || !config.permitUrl.trim()) {
    errors.push("permitUrl is required");
  } else if (!isValidUrl(config.permitUrl)) {
    errors.push("permitUrl must be a valid HTTP/HTTPS URL (e.g., https://ztm-portal.flomesh.io:7779/permit)");
  }

  if (!config.meshName || typeof config.meshName !== "string" || !config.meshName.trim()) {
    errors.push("meshName is required");
  } else if (!/^[a-zA-Z0-9_-]+$/.test(config.meshName)) {
    errors.push("meshName must contain only letters, numbers, hyphens, and underscores");
  }

  if (!config.username || typeof config.username !== "string" || !config.username.trim()) {
    errors.push("username is required");
  } else if (!/^[a-zA-Z0-9_-]+$/.test(config.username)) {
    errors.push("username must contain only letters, numbers, hyphens, and underscores");
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  // Return validated config
  return {
    valid: true,
    config: resolveZTMChatConfig(raw) as ZTMChatConfig,
    errors: [],
  };
}

// Resolve raw config with defaults
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
  };
}

// Get default configuration
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
  };
}

// Check if config is minimally valid (has required fields)
export function isConfigMinimallyValid(config: Partial<ZTMChatConfig>): boolean {
  return Boolean(
    config.agentUrl &&
      config.agentUrl.trim() &&
      config.meshName &&
      config.meshName.trim() &&
      config.username &&
      config.username.trim()
  );
}

// Create a partial config for probing
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
  };
}

// Export the schema for UI hints
export function getConfigSchema(): TSchema {
  return ZTMChatConfigSchema;
}
