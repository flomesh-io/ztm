// ZTM Chat Configuration Schema
// TypeBox schema definition with inferred types
// Schema drives types - no separate type definitions needed

import { Type, type TSchema, type Static } from "@sinclair/typebox";

// ============================================
// ZTM Chat Configuration Schema & Types
// ============================================

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
  dmPolicy: Type.Optional(Type.Union([
    Type.Literal("allow"),
    Type.Literal("deny"),
    Type.Literal("pairing"),
  ], {
    description: "Direct message policy: allow, deny, or pairing",
    default: "pairing",
  })),
  allowFrom: Type.Optional(Type.Array(Type.String({
    description: "List of allowed sender usernames",
  }))),
  apiTimeout: Type.Optional(Type.Number({
    description: "API request timeout in milliseconds",
    minimum: 1000,
    maximum: 300000,
    default: 30000,
  })),
});

// Type alias inferred from schema - guaranteed to stay in sync
export type ZTMChatConfig = Static<typeof ZTMChatConfigSchema>;

// DMPolicy type inferred from schema's dmPolicy field
type DMPolicyType = Static<typeof ZTMChatConfigSchema>["dmPolicy"];
export type DMPolicy = NonNullable<DMPolicyType>;

// Extended config with allowFrom (for wizard output)
export type ExtendedZTMChatConfig = ZTMChatConfig;

// Export types for convenience
export type { Static } from "@sinclair/typebox";

// ============================================
// Validation Types
// ============================================

export type ValidationErrorReason = 'required' | 'invalid_format' | 'out_of_range' | 'type_mismatch';

// Single configuration validation error
export interface ConfigValidationError {
  field: string;
  reason: ValidationErrorReason;
  value: unknown;
  message: string;
}

// Validation result using Result pattern
export interface ZTMChatConfigValidation {
  valid: boolean;
  errors: ConfigValidationError[];
  config?: ZTMChatConfig;
}

// ============================================
// Schema Accessor
// ============================================

// Export the schema for UI hints
export function getConfigSchema(): TSchema {
  return ZTMChatConfigSchema;
}
