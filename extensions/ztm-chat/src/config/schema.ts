// ZTM Chat Configuration Schema
// TypeBox schema definition for UI hints and validation

import { Type, type TSchema } from "@sinclair/typebox";
import type { DMPolicy } from "../types/config.js";

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
  apiTimeout: Type.Optional(Type.Number({
    description: "API request timeout in milliseconds",
    minimum: 1000,
    maximum: 300000,
    default: 30000,
  })),
});

// Export the schema for UI hints
export function getConfigSchema(): TSchema {
  return ZTMChatConfigSchema;
}
