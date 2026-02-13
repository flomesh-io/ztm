// Persistent message state store
// Tracks per-account, per-peer watermarks so that already-processed messages
// are skipped across gateway restarts.

import * as fs from "fs";
import * as path from "path";
import { defaultLogger, type Logger } from "../utils/logger.js";

/**
 * FileSystem interface for dependency injection (enables testing without real I/O)
 */
export interface FileSystem {
  existsSync(path: string): boolean;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  readFileSync(path: string, encoding: string): string;
  writeFileSync(path: string, data: string): void;
}

/**
 * Default Node.js file system implementation
 */
export const nodeFs: FileSystem = {
  existsSync: fs.existsSync,
  mkdirSync: fs.mkdirSync,
  readFileSync: (p, enc) => fs.readFileSync(p, enc as BufferEncoding),
  writeFileSync: (p, d) => fs.writeFileSync(p, d),
};

export interface FileMetadata {
  time: number;
  size: number;
}

export interface MessageStateData {
  // Per-account → per-peer → last processed message timestamp
  accounts: Record<string, Record<string, number>>;
  // Per-account → last seen file metadata (time + size for watchChanges seeding)
  fileMetadata: Record<string, Record<string, FileMetadata>>;
}

/**
 * MessageStateStore interface - abstract interface for persistence operations
 */
export interface MessageStateStore {
  getWatermark(accountId: string, peer: string): number;
  getGlobalWatermark(accountId: string): number;
  setWatermark(accountId: string, peer: string, time: number): void;
  getFileMetadata(accountId: string): Record<string, FileMetadata>;
  setFileMetadata(accountId: string, filePath: string, metadata: FileMetadata): void;
  setFileMetadataBulk(accountId: string, metadata: Record<string, FileMetadata>): void;
  flush(): void;
  dispose(): void;
}

/**
 * Implementation of MessageStateStore
 */
export class MessageStateStoreImpl implements MessageStateStore {
  private statePath: string;
  private data: MessageStateData;
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly fs: FileSystem;
  private readonly logger: Logger;
  private readonly stateDir: string;

  // Maximum number of peers to track per account (prevents unbounded state growth)
  private readonly MAX_PEERS_PER_ACCOUNT = 1000;
  // Maximum number of file paths to track per account
  private readonly MAX_FILES_PER_ACCOUNT = 1000;

  constructor(
    statePath?: string,
    fsImpl?: FileSystem,
    loggerImpl?: Logger
  ) {
    this.fs = fsImpl ?? nodeFs;
    this.logger = loggerImpl ?? defaultLogger;

    // Allow overriding the state path (useful for testing)
    // Priority: constructor param > ZTM_STATE_PATH env var > default path
    if (statePath) {
      this.statePath = statePath;
    } else if (process.env.ZTM_STATE_PATH) {
      this.statePath = process.env.ZTM_STATE_PATH;
    } else {
      this.statePath = path.join(
        process.env.HOME || "",
        ".openclaw",
        "ztm",
        "state.json",
      );
    }
    this.stateDir = path.dirname(this.statePath);

    // Ensure the config directory exists on startup to prevent write errors later
    if (!this.fs.existsSync(this.stateDir)) {
      this.fs.mkdirSync(this.stateDir, { recursive: true });
    }
    this.data = { accounts: {}, fileMetadata: {} };
    this.load();
  }

  private load(): void {
    try {
      if (!this.fs.existsSync(this.statePath)) {
        return;
      }

      const content = this.fs.readFileSync(this.statePath, "utf-8");
      const parsed = JSON.parse(content);

      if (!parsed || typeof parsed !== "object") {
        return;
      }

      const fileMetadata = this.migrateFileMetadata(parsed);
      this.data = {
        accounts: parsed.accounts ?? {},
        fileMetadata,
      };
    } catch {
      // Ignore read/parse errors — start fresh
      this.logger.warn("Failed to load message state, starting fresh");
    }
  }

  private migrateFileMetadata(parsed: Record<string, unknown>): Record<string, Record<string, FileMetadata>> {
    const fileMetadata: Record<string, Record<string, FileMetadata>> = {};

    if (parsed.fileMetadata) {
      // New format
      Object.assign(fileMetadata, parsed.fileMetadata);
    } else if (parsed.fileTimes) {
      // Old format: migrate time to metadata with size 0
      for (const [accountId, files] of Object.entries(parsed.fileTimes as Record<string, Record<string, number>>)) {
        fileMetadata[accountId] = {};
        for (const [p, time] of Object.entries(files)) {
          fileMetadata[accountId][p] = { time, size: 0 };
        }
      }
    }

    return fileMetadata;
  }

  private scheduleSave(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    // Debounce writes to avoid excessive I/O during burst processing
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.save();
    }, 1000);
  }

  private save(): void {
    if (!this.dirty) return;
    try {
      if (!this.fs.existsSync(this.stateDir)) {
        this.fs.mkdirSync(this.stateDir, { recursive: true });
      }
      this.fs.writeFileSync(this.statePath, JSON.stringify(this.data, null, 2));
      this.dirty = false;
    } catch {
      this.logger.warn("Failed to persist message state");
    }
  }

  /** Flush any pending writes immediately (call on shutdown) */
  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.save();
  }

  /** Get the last-processed message timestamp for a peer under an account */
  getWatermark(accountId: string, peer: string): number {
    return this.data.accounts[accountId]?.[peer] ?? 0;
  }

  /** Get the global watermark (max across all peers) for an account */
  getGlobalWatermark(accountId: string): number {
    const peers = this.data.accounts[accountId];
    if (!peers) return 0;
    return Math.max(0, ...Object.values(peers));
  }

  /** Update the watermark for a peer (only advances forward) */
  setWatermark(accountId: string, peer: string, time: number): void {
    const current = this.getWatermark(accountId, peer);
    if (time <= current) return;
    if (!this.data.accounts[accountId]) {
      this.data.accounts[accountId] = {};
    }
    this.data.accounts[accountId][peer] = time;
    this.cleanupIfNeeded(accountId);
    this.scheduleSave();
  }

  /** Clean up old entries if limits are exceeded (called after watermark updates) */
  private cleanupIfNeeded(accountId: string): void {
    const peers = this.data.accounts[accountId];
    if (peers && Object.keys(peers).length > this.MAX_PEERS_PER_ACCOUNT) {
      // Keep the most recently active peers (sorted by timestamp descending)
      const sorted = Object.entries(peers)
        .sort(([, t1], [, t2]) => t2 - t1)
        .slice(0, this.MAX_PEERS_PER_ACCOUNT);
      this.data.accounts[accountId] = Object.fromEntries(sorted);
      this.dirty = true;
    }

    // Also cleanup fileMetadata if needed
    const fileMetadata = this.data.fileMetadata[accountId];
    if (fileMetadata && Object.keys(fileMetadata).length > this.MAX_FILES_PER_ACCOUNT) {
      // Keep the most recently seen files (sorted by timestamp descending)
      const sorted = Object.entries(fileMetadata)
        .sort(([, m1], [, m2]) => m2.time - m1.time)
        .slice(0, this.MAX_FILES_PER_ACCOUNT);
      this.data.fileMetadata[accountId] = Object.fromEntries(sorted);
      this.dirty = true;
    }
  }

  /** Get all persisted file metadata for an account (used to seed lastSeenTimes) */
  getFileMetadata(accountId: string): Record<string, FileMetadata> {
    return this.data.fileMetadata[accountId] ?? {};
  }

  /** Update a file's metadata */
  setFileMetadata(accountId: string, filePath: string, metadata: FileMetadata): void {
    if (!this.data.fileMetadata[accountId]) {
      this.data.fileMetadata[accountId] = {};
    }
    this.data.fileMetadata[accountId][filePath] = metadata;
    this.scheduleSave();
  }

  /** Bulk-set file metadata (e.g. after initial scan) */
  setFileMetadataBulk(accountId: string, metadata: Record<string, FileMetadata>): void {
    if (!this.data.fileMetadata[accountId]) {
      this.data.fileMetadata[accountId] = {};
    }
    for (const [fp, m] of Object.entries(metadata)) {
      this.data.fileMetadata[accountId][fp] = m;
    }
    this.scheduleSave();
  }

  /** Dispose of resources - call on plugin unload to prevent memory leaks */
  dispose(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.save();
  }
}

/**
 * Factory function to create MessageStateStore instances
 * Allows dependency injection for testing
 */
export function createMessageStateStore(
  statePath?: string,
  fsImpl?: FileSystem,
  loggerImpl?: Logger
): MessageStateStore {
  return new MessageStateStoreImpl(statePath, fsImpl, loggerImpl);
}

// Default instance for backward compatibility
let defaultInstance: MessageStateStore | null = null;

/**
 * Get or create the default MessageStateStore instance
 */
export function getMessageStateStore(): MessageStateStore {
  if (!defaultInstance) {
    defaultInstance = createMessageStateStore();
  }
  return defaultInstance;
}

// Export dispose function for plugin cleanup
export function disposeMessageStateStore(): void {
  if (defaultInstance) {
    defaultInstance.dispose();
    defaultInstance = null;
  }
}
