// ZTM Chat API Types
// Types for ZTM Agent API communication

// ZTM Message interface - matches ZTM Agent API format
export interface ZTMMessage {
  time: number;
  message: string;
  sender: string;
}

// ZTM Peer interface
export interface ZTMPeer {
  username: string;
  endpoint?: string;
}

// ZTM User Info interface
export interface ZTMUserInfo {
  username: string;
  endpoint?: string;
}

// ZTM Mesh Info interface - matches /api/meshes/{name} response
export interface ZTMMeshInfo {
  name: string;
  connected: boolean;
  endpoints: number;
  errors?: Array<{ time: string; message: string }>;
}

// ZTM Chat interface - matches /apps/ztm/chat/api/chats response
export interface ZTMChat {
  peer?: string;
  creator?: string;
  group?: string;
  name?: string;
  members?: string[];
  time: number;
  updated: number;
  latest: ZTMMessage;
}

// ZTM API Client interface
export interface ZTMApiClient {
  // Mesh operations
  getMeshInfo(): Promise<ZTMMeshInfo>;

  // User/Peer discovery
  discoverUsers(): Promise<ZTMUserInfo[]>;
  discoverPeers(): Promise<ZTMPeer[]>;

  // Chat operations (direct storage-based implementation)
  getChats(): Promise<ZTMChat[]>;
  getPeerMessages(peer: string, since?: number, before?: number): Promise<ZTMMessage[] | null>;
  sendPeerMessage(peer: string, message: ZTMMessage): Promise<boolean>;

  // Group operations (future)
  getGroups(): Promise<ZTMChat[]>;
  getGroupMessages(creator: string, group: string): Promise<ZTMMessage[] | null>;

  // File operations
  addFile(data: ArrayBuffer): Promise<string | null>;
  getFile(owner: string, hash: string): Promise<ArrayBuffer | null>;

  // Watch mechanism for real-time updates
  watchChanges(prefix: string): Promise<string[]>;

  /** Seed file metadata from persisted state (call before first watchChanges) */
  seedFileMetadata(metadata: Record<string, { time: number; size: number }>): void;

  /** Export current file metadata for persistence */
  exportFileMetadata(): Record<string, { time: number; size: number }>;

  /** @deprecated Use seedFileMetadata instead */
  seedLastSeenTimes(times: Record<string, number>): void;

  /** @deprecated Use exportFileMetadata instead */
  exportLastSeenTimes(): Record<string, number>;

  // Direct storage API methods (MVP implementation)
  /** Send message using direct storage API */
  sendMessageViaStorage(peer: string, message: ZTMMessage): Promise<boolean>;
  /** Receive messages using direct storage API */
  receiveMessagesViaStorage(peer: string): Promise<ZTMMessage[] | null>;
  /** Discover active peers by scanning shared storage */
  discoverUsersViaStorage(): Promise<ZTMUserInfo[]>;
}
