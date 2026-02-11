// ZTM Chat Configuration
// Compatibility layer - re-exports functionality from specialized config modules
//
// @deprecated Import directly from specialized modules:
// - Schema: config/schema.ts
// - Validation: config/validation.ts
// - Defaults: config/defaults.ts

// Re-export all functionality from specialized modules
export * from './config/index.js';

// Re-export TypeBox types for backward compatibility
export type { Static } from "@sinclair/typebox";
