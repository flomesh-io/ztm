// Persistent message state store
// Tracks per-account, per-peer watermarks so that already-processed messages
// are skipped across gateway restarts.

import * as fs from "fs";
import * as path from "path";
import { logger } from "../logger.js";

export interface MessageStateData {
  // Per-account → per-peer → last processed message timestamp
  accounts: Record<string, Record<string, number>>;
  // Per-account → last seen file times (for watchChanges seeding)
  fileTimes: Record<string, Record<string, number>>;
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
    this.data = { accounts: {}, fileTimes: {} };
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.statePath)) {
        const content = fs.readFileSync(this.statePath, "utf-8");
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === "object") {
          this.data = {
            accounts: parsed.accounts ?? {},
            fileTimes: parsed.fileTimes ?? {},
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

    // Also cleanup fileTimes if needed
    const fileTimes = this.data.fileTimes[accountId];
    if (fileTimes && Object.keys(fileTimes).length > this.MAX_FILES_PER_ACCOUNT) {
      // Keep the most recently seen files (sorted by timestamp descending)
      const sorted = Object.entries(fileTimes)
        .sort(([, t1], [, t2]) => t2 - t1)
        .slice(0, this.MAX_FILES_PER_ACCOUNT);
      this.data.fileTimes[accountId] = Object.fromEntries(sorted);
      this.dirty = true;
    }
  }

  /** Get all persisted file times for an account (used to seed lastSeenTimes) */
  getFileTimes(accountId: string): Record<string, number> {
    return this.data.fileTimes[accountId] ?? {};
  }

  /** Update a file's last-seen time */
  setFileTime(accountId: string, filePath: string, time: number): void {
    if (!this.data.fileTimes[accountId]) {
      this.data.fileTimes[accountId] = {};
    }
    this.data.fileTimes[accountId][filePath] = time;
    this.scheduleSave();
  }

  /** Bulk-set file times (e.g. after initial scan) */
  setFileTimes(accountId: string, times: Record<string, number>): void {
    if (!this.data.fileTimes[accountId]) {
      this.data.fileTimes[accountId] = {};
    }
    for (const [fp, t] of Object.entries(times)) {
      this.data.fileTimes[accountId][fp] = t;
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

// Global state store instance
export const messageStateStore = new MessageStateStore();

// Export dispose function for plugin cleanup
export function disposeMessageStateStore(): void {
  messageStateStore.dispose();
}
