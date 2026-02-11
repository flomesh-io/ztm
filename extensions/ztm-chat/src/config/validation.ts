// ZTM Chat Configuration Validation
// Validates configuration with detailed error messages using Result pattern

import type {
  ZTMChatConfig,
  ZTMChatConfigValidation,
  DMPolicy,
  ConfigValidationError,
  ValidationErrorReason,
} from "../types/config.js";

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
 * Create a validation error for a specific field
 */
function validationError(
  field: string,
  reason: ValidationErrorReason,
  value: unknown,
  message: string
): ConfigValidationError {
  return { field, reason, value, message };
}

/**
 * Validate agent URL field
 */
function validateAgentUrl(
  config: Record<string, unknown>,
  errors: ConfigValidationError[]
): void {
  const value = config.agentUrl;
  if (!value || typeof value !== "string" || !value.trim()) {
    errors.push(
      validationError(
        "agentUrl",
        "required",
        value,
        "agentUrl is required"
      )
    );
  } else if (!isValidUrl(value)) {
    errors.push(
      validationError(
        "agentUrl",
        "invalid_format",
        value,
        "agentUrl must be a valid HTTP/HTTPS URL (e.g., https://ztm-agent.example.com:7777)"
      )
    );
  }
}

/**
 * Validate permit URL field
 */
function validatePermitUrl(
  config: Record<string, unknown>,
  errors: ConfigValidationError[]
): void {
  const value = config.permitUrl;
  if (!value || typeof value !== "string" || !value.trim()) {
    errors.push(
      validationError(
        "permitUrl",
        "required",
        value,
        "permitUrl is required"
      )
    );
  } else if (!isValidUrl(value)) {
    errors.push(
      validationError(
        "permitUrl",
        "invalid_format",
        value,
        "permitUrl must be a valid HTTP/HTTPS URL (e.g., https://ztm-portal.flomesh.io:7779/permit)"
      )
    );
  }
}

/**
 * Validate mesh name field
 */
function validateMeshName(
  config: Record<string, unknown>,
  errors: ConfigValidationError[]
): void {
  const value = config.meshName;
  if (!value || typeof value !== "string" || !value.trim()) {
    errors.push(
      validationError(
        "meshName",
        "required",
        value,
        "meshName is required"
      )
    );
  } else if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    errors.push(
      validationError(
        "meshName",
        "invalid_format",
        value,
        "meshName must contain only letters, numbers, hyphens, and underscores"
      )
    );
  } else if (value.length > 64) {
    errors.push(
      validationError(
        "meshName",
        "out_of_range",
        value,
        "meshName must be 64 characters or less"
      )
    );
  }
}

/**
 * Validate username field
 */
function validateUsername(
  config: Record<string, unknown>,
  errors: ConfigValidationError[]
): void {
  const value = config.username;
  if (!value || typeof value !== "string" || !value.trim()) {
    errors.push(
      validationError(
        "username",
        "required",
        value,
        "username is required"
      )
    );
  } else if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    errors.push(
      validationError(
        "username",
        "invalid_format",
        value,
        "username must contain only letters, numbers, hyphens, and underscores"
      )
    );
  } else if (value.length > 64) {
    errors.push(
      validationError(
        "username",
        "out_of_range",
        value,
        "username must be 64 characters or less"
      )
    );
  }
}

/**
 * Validate DM policy field
 */
function validateDmPolicy(
  config: Record<string, unknown>,
  errors: ConfigValidationError[]
): void {
  const value = config.dmPolicy;
  if (value !== undefined && !["allow", "deny", "pairing"].includes(value as string)) {
    errors.push(
      validationError(
        "dmPolicy",
        "type_mismatch",
        value,
        "dmPolicy must be 'allow', 'deny', or 'pairing'"
      )
    );
  }
}

/**
 * Validate API timeout field
 */
function validateApiTimeout(
  config: Record<string, unknown>,
  errors: ConfigValidationError[]
): void {
  const value = config.apiTimeout;
  if (value !== undefined && (typeof value !== "number" || value < 1000)) {
    errors.push(
      validationError(
        "apiTimeout",
        "out_of_range",
        value,
        "apiTimeout must be at least 1000ms"
      )
    );
  }
}

/**
 * Validate configuration with detailed errors using Result pattern
 *
 * @param raw - Raw configuration object to validate
 * @returns Validation result with structured errors or resolved config
 *
 * @example
 * ```typescript
 * const result = validateZTMChatConfig(rawConfig);
 * if (result.valid) {
 *   console.log("Config:", result.config);
 * } else {
 *   for (const error of result.errors) {
 *     console.error(`${error.field}: ${error.message}`);
 *   }
 * }
 * ```
 */
export function validateZTMChatConfig(
  raw: unknown
): ZTMChatConfigValidation {
  const errors: ConfigValidationError[] = [];

  // Validate root object type
  if (!raw || typeof raw !== "object") {
    return {
      valid: false,
      errors: [
        {
          field: "root",
          reason: "type_mismatch",
          value: raw,
          message: "Configuration must be an object",
        },
      ],
    };
  }

  const config = raw as Record<string, unknown>;

  // Validate all required fields
  validateAgentUrl(config, errors);
  validatePermitUrl(config, errors);
  validateMeshName(config, errors);
  validateUsername(config, errors);
  validateDmPolicy(config, errors);
  validateApiTimeout(config, errors);

  // Return early if there are validation errors
  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  // Resolve and return validated config
  const resolvedConfig: ZTMChatConfig = {
    agentUrl: config.agentUrl!.toString().trim(),
    permitUrl: config.permitUrl!.toString().trim(),
    meshName: config.meshName!.toString().trim(),
    username: config.username!.toString().trim(),
    enableGroups: Boolean(config.enableGroups),
    autoReply: config.autoReply !== false,
    messagePath:
      typeof config.messagePath === "string" && config.messagePath.trim()
        ? config.messagePath.trim()
        : "/shared",
    dmPolicy: (config.dmPolicy as DMPolicy) || "pairing",
    allowFrom: Array.isArray(config.allowFrom)
      ? config.allowFrom
          .filter((v): v is string => typeof v === "string")
          .map((v) => v.trim())
          .filter(Boolean)
      : undefined,
    apiTimeout:
      typeof config.apiTimeout === "number" && config.apiTimeout >= 1000
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
  return (
    /^[a-zA-Z0-9_-]+$/.test(username) &&
    username.length > 0 &&
    username.length <= 64
  );
}

/**
 * Validate a mesh name format
 */
export function isValidMeshName(meshName: string): boolean {
  return (
    /^[a-zA-Z0-9_-]+$/.test(meshName) &&
    meshName.length > 0 &&
    meshName.length <= 64
  );
}

/**
 * Validate DM policy value
 */
export function isValidDmPolicy(policy: string): policy is DMPolicy {
  return ["allow", "deny", "pairing"].includes(policy);
}
