// ZTM Chat Channel Module
// Barrel export for all channel-related functionality

// Re-export types
export type {
  ResolvedZTMChatAccount,
} from './config.js';

// Re-export channel plugin
export {
  ztmChatPlugin,
} from './plugin.js';

// Re-export config utilities
export {
  listZTMChatAccountIds,
  resolveZTMChatAccount,
  getEffectiveChannelConfig,
  buildChannelConfigSchemaWithHints,
} from './config.js';

// Re-export gateway utilities
export {
  buildMessageCallback,
  startAccountGateway,
  logoutAccountGateway,
} from './gateway.js';

// Re-export state utilities
export {
  buildAccountSnapshot,
} from './state.js';

// Re-export dispose function for plugin cleanup
export { disposeMessageStateStore } from '../runtime/store.js';
