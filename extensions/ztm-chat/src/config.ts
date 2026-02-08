// ZTM Chat Configuration Schema
// Uses TypeBox for schema definition (compatible with OpenClaw SDK)

import { Type, type TSchema } from "@sinclair/typebox";

// Helper validators
const isValidUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const isValidCertificate = (value: string): boolean => {
  if (!value) return true;
  return (
    value.includes("-----BEGIN CERTIFICATE-----") &&
    value.includes("-----END CERTIFICATE-----")
  );
};

const isValidPrivateKey = (value: string): boolean => {
  if (!value) return true;
  return (
    value.includes("-----BEGIN PRIVATE KEY-----") ||
    value.includes("-----BEGIN EC PRIVATE KEY-----") ||
    value.includes("-----BEGIN RSA PRIVATE KEY-----")
  );
};

// ZTM Chat Configuration Schema
export const ZTMChatConfigSchema = Type.Object({
  agentUrl: Type.String({
    description: "ZTM Agent API URL (e.g., https://ztm-agent.example.com:7777)",
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
  certificate: Type.Optional(Type.String({
    description: "ZTM agent certificate (PEM format)",
  })),
  privateKey: Type.Optional(Type.String({
    description: "ZTM private key (PEM format)",
  })),
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
  allowFrom: Type.Optional(Type.Array(Type.String({
    description: "List of allowed sender usernames",
  }))),
});

export type ZTMChatConfig = Type.TypeOf<typeof ZTMChatConfigSchema>;

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

  // Validate certificate format
  const certificate = config.certificate;
  if (certificate && typeof certificate === "string" && !isValidCertificate(certificate)) {
    errors.push("certificate must be a valid PEM certificate");
  }

  // Validate private key format
  const privateKey = config.privateKey;
  if (privateKey && typeof privateKey === "string" && !isValidPrivateKey(privateKey)) {
    errors.push("privateKey must be a valid PEM private key");
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
    meshName:
      typeof config.meshName === "string" && config.meshName.trim()
        ? config.meshName.trim()
        : "",
    username:
      typeof config.username === "string" && config.username.trim()
        ? config.username.trim()
        : "openclaw-bot",
    certificate:
      typeof config.certificate === "string" && config.certificate.trim()
        ? config.certificate
        : undefined,
    privateKey:
      typeof config.privateKey === "string" && config.privateKey.trim()
        ? config.privateKey
        : undefined,
    enableGroups: Boolean(config.enableGroups),
    autoReply: config.autoReply !== false, // default true
    messagePath:
      typeof config.messagePath === "string" && config.messagePath.trim()
        ? config.messagePath.trim()
        : "/shared",
    allowFrom: Array.isArray(config.allowFrom)
      ? config.allowFrom.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean)
      : undefined,
  };
}

// Get default configuration
export function getDefaultConfig(): ZTMChatConfig {
  return {
    agentUrl: "http://localhost:7777",
    meshName: "",
    username: "openclaw-bot",
    certificate: undefined,
    privateKey: undefined,
    enableGroups: false,
    autoReply: true,
    messagePath: "/shared",
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
    meshName: config.meshName ?? "",
    username: config.username ?? "probe",
    certificate: config.certificate,
    privateKey: config.privateKey,
    enableGroups: config.enableGroups ?? false,
    autoReply: config.autoReply ?? true,
    messagePath: config.messagePath ?? "/shared",
    allowFrom: config.allowFrom,
  };
}

// Export the schema for UI hints
export function getConfigSchema(): TSchema {
  return ZTMChatConfigSchema;
}
