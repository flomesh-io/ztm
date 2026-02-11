// Persistent message state store
// Tracks per-account, per-peer watermarks so that already-processed messages
// are skipped across gateway restarts.

import * as fs from "fs";
import * as path from "path";
import { logger } from "../logger.js";

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

export class MessageStateStore {
  private statePath: string;
  private data: MessageStateData;
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  // Maximum number of peers to track per account (prevents unbounded state growth)
  private readonly MAX_PEERS_PER_ACCOUNT = 1000;
  // Maximum number of file paths to track per account
  private readonly MAX_FILES_PER_ACCOUNT = 1000;

  constructor() {
    this.statePath = path.join(
      process.env.HOME || "",
      ".openclaw",
      "ztm",
      "state.json",
    );
    // Ensure the config directory exists on startup to prevent write errors later
    const configDir = path.dirname(this.statePath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    this.data = { accounts: {}, fileMetadata: {} };
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.statePath)) {
        const content = fs.readFileSync(this.statePath, "utf-8");
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === "object") {
          // Migrate from old fileTimes format (Record<string, number>) to new fileMetadata format
          const fileMetadata: Record<string, Record<string, FileMetadata>> = {};
          if (parsed.fileMetadata) {
            // New format
            Object.assign(fileMetadata, parsed.fileMetadata);
          } else if (parsed.fileTimes) {
            // Old format: migrate time to metadata with size 0
            for (const [accountId, files] of Object.entries(parsed.fileTimes as Record<string, Record<string, number>>)) {
              fileMetadata[accountId] = {};
              for (const [path, time] of Object.entries(files)) {
                fileMetadata[accountId][path] = { time, size: 0 };
              }
            }
          }

          this.data = {
            accounts: parsed.accounts ?? {},
            fileMetadata,
          };
        }
      }
    } catch {
      // Ignore read/parse errors — start fresh
      logger.warn("Failed to load message state, starting fresh");
    }
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
      const dir = path.dirname(this.statePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.statePath, JSON.stringify(this.data, null, 2));
      this.dirty = false;
    } catch {
      logger.warn("Failed to persist message state");
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

  /** @deprecated Use getFileMetadata instead */
  getFileTimes(accountId: string): Record<string, number> {
    const metadata = this.data.fileMetadata[accountId] ?? {};
    const times: Record<string, number> = {};
    for (const [path, meta] of Object.entries(metadata)) {
      times[path] = meta.time;
    }
    return times;
  }

  /** @deprecated Use setFileMetadata instead */
  setFileTime(accountId: string, filePath: string, time: number): void {
    this.setFileMetadata(accountId, filePath, { time, size: 0 });
  }

  /** @deprecated Use setFileMetadataBulk instead */
  setFileTimes(accountId: string, times: Record<string, number>): void {
    const metadata: Record<string, FileMetadata> = {};
    for (const [path, time] of Object.entries(times)) {
      metadata[path] = { time, size: 0 };
    }
    this.setFileMetadataBulk(accountId, metadata);
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

// Global state store instance
export const messageStateStore = new MessageStateStore();

// Export dispose function for plugin cleanup
export function disposeMessageStateStore(): void {
  messageStateStore.dispose();
}
