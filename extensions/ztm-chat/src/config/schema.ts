// ZTM Chat Configuration Schema
// TypeBox schema definition with inferred types
// Schema drives types - no separate type definitions needed

import { Type, type TSchema, type Static } from "@sinclair/typebox";

// ============================================
// ZTM Chat Configuration Schema & Types
// ============================================

// Group Tool Policy Schema
const GroupToolPolicySchema = Type.Object({
  allow: Type.Optional(Type.Array(Type.String())),
  deny: Type.Optional(Type.Array(Type.String())),
});

// Group Tool Policy By Sender Schema
const GroupToolPolicyBySenderSchema = Type.Record(
  Type.String(),
  Type.Object({
    alsoAllow: Type.Optional(Type.Array(Type.String())),
    deny: Type.Optional(Type.Array(Type.String())),
  })
);

// Group Permissions Schema (per-group)
const GroupPermissionsSchema = Type.Object({
  creator: Type.String(),
  group: Type.String(),
  groupPolicy: Type.Optional(Type.Union([
    Type.Literal("open"),
    Type.Literal("disabled"),
    Type.Literal("allowlist"),
  ], { default: "allowlist" })),
  requireMention: Type.Optional(Type.Boolean({ default: true })),
  allowFrom: Type.Optional(Type.Array(Type.String())),
  tools: Type.Optional(GroupToolPolicySchema),
  toolsBySender: Type.Optional(GroupToolPolicyBySenderSchema),
});

// ZTM Chat Configuration Schema
export const ZTMChatConfigSchema = Type.Object({
  agentUrl: Type.String({
    title: "Agent URL",
    description: "ZTM Agent HTTP endpoint URL for mesh communication",
    format: "uri",
    examples: ["http://localhost:7777", "https://agent.example.com:7777"],
  }),
  permitUrl: Type.String({
    title: "Permit Server URL",
    description: "Permit server URL for mesh authentication and authorization",
    format: "uri",
    examples: ["https://ztm-portal.flomesh.io:7779/permit"],
  }),
  meshName: Type.String({
    title: "Mesh Name",
    description: "Unique identifier for the ZTM mesh network",
    minLength: 1,
    maxLength: 64,
    pattern: "^[a-zA-Z0-9_-]+$",
    examples: ["my-mesh", "production-mesh"],
  }),
  username: Type.String({
    title: "Bot Username",
    description: "Bot identifier used when communicating on the mesh",
    minLength: 1,
    maxLength: 64,
    pattern: "^[a-zA-Z0-9_-]+$",
    examples: ["chatbot", "assistant-bot"],
  }),
  enableGroups: Type.Optional(Type.Boolean({
    title: "Enable Group Chat",
    description: "Enable group messaging features (requires ZTM groups support)",
    default: false,
  })),
  autoReply: Type.Optional(Type.Boolean({
    title: "Auto-Reply",
    description: "Automatically respond to received messages",
    default: true,
  })),
  messagePath: Type.Optional(Type.String({
    title: "Message Storage Path",
    description: "Custom storage path for messages within ZTM shared directory",
    default: "/shared",
    examples: ["/shared", "/messages"],
  })),
  dmPolicy: Type.Optional(Type.Union([
    Type.Literal("allow"),
    Type.Literal("deny"),
    Type.Literal("pairing"),
  ], {
    title: "Direct Message Policy",
    description: "Control who can send direct messages: allow all, deny all, or require pairing approval",
    default: "pairing",
  })),
  allowFrom: Type.Optional(Type.Array(Type.String({
    description: "List of allowed sender usernames",
  }), {
    title: "Allowed Senders",
    description: "Whitelist of usernames allowed to send messages (empty = allow all paired users)",
  })),
  apiTimeout: Type.Optional(Type.Number({
    title: "API Timeout (ms)",
    description: "Timeout in milliseconds for ZTM API requests",
    minimum: 1000,
    maximum: 300000,
    default: 30000,
    examples: [5000, 30000, 60000],
  })),
  // Group policy configuration
  groupPolicy: Type.Optional(Type.Union([
    Type.Literal("open"),
    Type.Literal("disabled"),
    Type.Literal("allowlist"),
  ], {
    title: "Group Policy",
    description: "Default policy for group messages: open (allow all), disabled (block all), or allowlist (whitelist only)",
    default: "allowlist",
  })),
  requireMention: Type.Optional(Type.Boolean({
    title: "Require Mention",
    description: "Require @mention to process group messages (default: true)",
    default: true,
  })),
  groupPermissions: Type.Optional(Type.Record(
    Type.String(),  // key: "creator/groupId"
    GroupPermissionsSchema
  )),
}, { $id: "ztmChatConfig" });

// Type alias inferred from schema - guaranteed to stay in sync
export type ZTMChatConfig = Static<typeof ZTMChatConfigSchema>;

// DMPolicy type inferred from schema's dmPolicy field
type DMPolicyType = Static<typeof ZTMChatConfigSchema>["dmPolicy"];
export type DMPolicy = NonNullable<DMPolicyType>;

// GroupPolicy type inferred from schema's groupPolicy field
type GroupPolicyType = Static<typeof ZTMChatConfigSchema>["groupPolicy"];
export type GroupPolicy = NonNullable<GroupPolicyType>;

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
