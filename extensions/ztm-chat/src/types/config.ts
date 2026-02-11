// ZTM Chat Configuration Types
// Exported from config.ts for centralized type management

import { Type } from "@sinclair/typebox";

// DM Policy type
export type DMPolicy = "allow" | "deny" | "pairing";

// Validation error reason types
export type ValidationErrorReason = 'required' | 'invalid_format' | 'out_of_range' | 'type_mismatch';

// Single configuration validation error
export interface ConfigValidationError {
  field: string;
  reason: ValidationErrorReason;
  value: unknown;
  message: string;
}

// ZTM Chat Configuration interface
// This matches the schema defined in config.ts
export interface ZTMChatConfig {
  agentUrl: string;
  permitUrl: string;
  meshName: string;
  username: string;
  enableGroups?: boolean;
  autoReply?: boolean;
  messagePath?: string;
  dmPolicy?: DMPolicy;
  allowFrom?: string[];
  apiTimeout?: number;
}

// Extended config with allowFrom (for wizard output)
export interface ExtendedZTMChatConfig extends ZTMChatConfig {
  allowFrom?: string[];
}

// Validation result using Result pattern
export interface ZTMChatConfigValidation {
  valid: boolean;
  errors: ConfigValidationError[];
  config?: ZTMChatConfig;
}

// Re-export TypeBox schema for external use
export { ZTMChatConfigSchema } from '../config/index.js';
export type { Static } from "@sinclair/typebox";
