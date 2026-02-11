// ZTM Chat Configuration Validation
// Validates configuration with detailed error messages

import type { ZTMChatConfig, ZTMChatConfigValidation, DMPolicy } from "../types/config.js";

// Helper validators
const isValidUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Validate configuration with detailed errors
 */
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

  // Resolve and return validated config (include resolution logic here to avoid circular dep)
  const resolvedConfig: ZTMChatConfig = {
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
    autoReply: config.autoReply !== false,
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

  return {
    valid: true,
    config: resolvedConfig,
    errors: [],
  };
}

/**
 * Check if config is minimally valid (has required fields)
 */
export function isConfigMinimallyValid(config: Partial<ZTMChatConfig>): boolean {
  return Boolean(
    config.agentUrl &&
      config.agentUrl.trim() &&
      config.username &&
      config.username.trim()
  );
}

/**
 * Validate a single username format
 */
export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(username) && username.length > 0 && username.length <= 64;
}

/**
 * Validate a mesh name format
 */
export function isValidMeshName(meshName: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(meshName) && meshName.length > 0 && meshName.length <= 64;
}

/**
 * Validate DM policy value
 */
export function isValidDmPolicy(policy: string): policy is DMPolicy {
  return ["allow", "deny", "pairing"].includes(policy);
}
