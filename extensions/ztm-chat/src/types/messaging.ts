// ZTM Chat Messaging Types
// Message processing and handling types

// Local type for ZTM chat messages (normalized)
export interface ZTMChatMessage {
  id: string;
  content: string;
  sender: string;
  senderId: string;
  timestamp: Date;
  peer: string;
  thread?: string;
  isGroup?: boolean;
  groupName?: string;
  groupCreator?: string;
}

// Message processing result
export interface MessageCheckResult {
  allowed: boolean;
  reason?: "allowed" | "denied" | "pending" | "whitelisted";
  action?: "process" | "ignore" | "request_pairing";
}

// Raw ZTM message format (from API)
export interface RawZTMMessage {
  time: number;
  message: string;
  sender: string;
}
