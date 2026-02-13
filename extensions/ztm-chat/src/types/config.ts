// ZTM Chat Configuration Types
// Single source of truth: types are inferred from config/schema.ts
// DO NOT redefine types here - import from config/schema.ts instead

// Re-export all types from schema for backward compatibility
export type {
  ZTMChatConfig,
  DMPolicy,
  ExtendedZTMChatConfig,
  Static,
  ZTMChatConfigSchema,
  ZTMChatConfigValidation,
  ConfigValidationError,
  ValidationErrorReason,
} from "../config/schema.js";
