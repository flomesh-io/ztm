// ZTM Chat Messaging Module
// Barrel export for all messaging-related functionality

// Message processing
export * from './processor.js';

// Message watching and polling
export * from './watcher.js';

// Message callback dispatching
export * from './dispatcher.js';

// Outbound messaging
export * from './outbound.js';

// Polling watcher (fallback mechanism)
export * from './polling.js';

// Type exports
export type { ZTMChatMessage, MessageCheckResult, RawZTMMessage } from '../types/messaging.js';
