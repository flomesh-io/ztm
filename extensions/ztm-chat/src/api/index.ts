// ZTM Chat API Module
// Barrel export for all API-related functionality

// Re-export from main ztm-api.ts for backward compatibility
export * from '../ztm-api.js';

// Type exports
export type {
  ZTMMessage,
  ZTMPeer,
  ZTMUserInfo,
  ZTMMeshInfo,
  ZTMChat,
  ZTMApiClient
} from '../types/api.js';
