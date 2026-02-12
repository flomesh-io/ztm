// Inbound message processing for ZTM Chat
// Compatibility layer - re-exports functionality from specialized modules
//
// @deprecated Import directly from specialized modules:
// - Message processing: messaging/processor.ts
// - Message watching: messaging/watcher.ts
// - Callback dispatching: messaging/dispatcher.ts

// Re-export all functionality from specialized modules
export * from './processor.js';
export * from './watcher.js';
export * from './dispatcher.js';

// Re-export DM policy functions for backward compatibility
export { checkDmPolicy, isUserWhitelisted, normalizeUsername, isPairingMode } from '../core/dm-policy.js';

// Re-export types for backward compatibility
export type { ZTMChatMessage, MessageCheckResult } from '../types/messaging.js';
