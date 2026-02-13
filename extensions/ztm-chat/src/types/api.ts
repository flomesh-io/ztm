// ZTM Chat API Types
// Types for ZTM Agent API communication

import type { Result } from "./common.js";
import type {
  ZtmApiError,
  ZtmTimeoutError,
  ZtmSendError,
  ZtmReadError,
  ZtmWriteError,
  ZtmDiscoveryError,
  ZtmParseError,
  ZtmError,
} from "./errors.js";

// ═════════════════════════════════════════════════════════════════════════════
// Core ZTM Types
// ═════════════════════════════════════════════════════════════════════════════

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

// ═════════════════════════════════════════════════════════════════════════════
// ZTM API Client Interface - Using Result<T, E> for consistent error handling
// ═════════════════════════════════════════════════════════════════════════════

/**
 * ZTM API Client interface with Result-based error handling.
 *
 * All operations return Result<T, E> types for consistent error handling:
 * - Success: { ok: true, value: T }
 * - Failure: { ok: false, error: E }
 *
 * This replaces previous patterns of:
 * - Promise<boolean> (lost error details)
 * - Promise<T | null> (couldn't distinguish "not found" from "error")
 * - Silent failures (returning empty arrays)
 */
export interface ZTMApiClient {
  // ═══════════════════════════════════════════════════════════════════════════
  // Mesh Operations - Return Result types with ZtmApiError
  // ═══════════════════════════════════════════════════════════════════════════

  /** Get current mesh information */
  getMeshInfo(): Promise<Result<ZTMMeshInfo, ZtmApiError>>;

  // ═══════════════════════════════════════════════════════════════════════════
  // User/Peer Discovery - Return Result types with ZtmDiscoveryError
  // ═══════════════════════════════════════════════════════════════════════════

  /** Discover available users in the mesh. Returns Result with discovered users or discovery error. */
  discoverUsers(): Promise<Result<ZTMUserInfo[], ZtmDiscoveryError>>;

  /** Discover available peers. Returns Result with discovered peers or discovery error. */
  discoverPeers(): Promise<Result<ZTMPeer[], ZtmDiscoveryError>>;

  // ═══════════════════════════════════════════════════════════════════════════
  // Chat Operations - Return Result types with ZtmSendError / ZtmReadError
  // ═══════════════════════════════════════════════════════════════════════════

  /** Get all chats. Returns Result with chats list or error. */
  getChats(): Promise<Result<ZTMChat[], ZtmReadError>>;

  /** Get messages from a specific peer. Returns Result with messages or read error. */
  getPeerMessages(
    peer: string,
    since?: number,
    before?: number
  ): Promise<Result<ZTMMessage[], ZtmReadError>>;

  /** Send a message to a peer. Returns Result with success=true or ZtmSendError on failure. */
  sendPeerMessage(peer: string, message: ZTMMessage): Promise<Result<boolean, ZtmSendError>>;

  // ═════════════════════════════════════════════════════════════════════════════
  // Group Operations
  // ═════════════════════════════════════════════════════════════════════════════

  /** Get available groups. Returns Result with groups list or error. */
  getGroups(): Promise<Result<ZTMChat[], ZtmError>>;

  /** Get messages from a group. Returns Result with messages or read error. */
  getGroupMessages(
    creator: string,
    group: string
  ): Promise<Result<ZTMMessage[], ZtmReadError>>;

  /** Send a message to a group. Returns Result with success or error. */
  sendGroupMessage(
    creator: string,
    group: string,
    message: ZTMMessage
  ): Promise<Result<boolean, ZtmSendError>>;

  // ═══════════════════════════════════════════════════════════════════════════
  // File Operations - Return Result types with appropriate errors
  // ═══════════════════════════════════════════════════════════════════════════

  /** Add a file to storage. Returns Result with file ID or error. */
  addFile(
    data: ArrayBuffer
  ): Promise<Result<string, ZtmWriteError>>;

  /** Get a file from storage. Returns Result with file data or error. */
  getFile(
    owner: string,
    hash: string
  ): Promise<Result<ArrayBuffer, ZtmReadError>>;

  // ═══════════════════════════════════════════════════════════════════════════
  // Watch Mechanism - Return Result types
  // ═══════════════════════════════════════════════════════════════════════════

  /** Read a file from mesh storage. Returns Result with parsed content or error. */
  readFile<T = unknown>(filePath: string): Promise<Result<T, ZtmApiError | ZtmTimeoutError>>;

  /** Watch for changes in storage with given prefix. Returns Result with changed paths or error. */
  watchChanges(prefix: string): Promise<Result<string[], ZtmReadError>>;

  /** Seed file metadata from persisted state (call before first watchChanges) */
  seedFileMetadata(metadata: Record<string, { time: number; size: number }>): void;

  /** Export current file metadata for persistence */
  exportFileMetadata(): Record<string, { time: number; size: number }>;

  /** Discover active peers by scanning shared storage. Returns Result with users or discovery error. */
  listUsers(): Promise<Result<ZTMUserInfo[], ZtmDiscoveryError>>;
}
