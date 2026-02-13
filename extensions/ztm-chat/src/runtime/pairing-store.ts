// Persistent pairing state store
// Tracks pending pairing requests so they survive gateway restarts
// and can be cleaned up automatically after expiration

import * as fs from "fs";
import * as path from "path";
import { defaultLogger, type Logger } from "../utils/logger.js";
import { FileSystem, nodeFs } from "./store.js";

export type { FileSystem };

/**
 * Pairing state data structure
 * accountId -> peer -> ISO timestamp string
 */
export interface PairingStateData {
  accounts: Record<string, Record<string, string>>;
}

/**
 * PairingStateStore interface - abstract interface for persistence operations
 */
export interface PairingStateStore {
  /**
   * Load pending pairings for an account
   * @param accountId - The account identifier
   * @returns Map of peer -> creation Date
   */
  loadPendingPairings(accountId: string): Map<string, Date>;

  /**
   * Save a pending pairing
   * @param accountId - The account identifier
   * @param peer - The peer username
   * @param date - Creation date (defaults to now)
   */
  savePendingPairing(accountId: string, peer: string, date?: Date): void;

  /**
   * Delete a pending pairing
   * @param accountId - The account identifier
   * @param peer - The peer username
   */
  deletePendingPairing(accountId: string, peer: string): void;

  cleanupExpiredPairings(accountId: string, maxAgeMs?: number): number;

  /**
   * Flush any pending writes immediately
   */
  flush(): void;

  /**
   * Dispose of resources - call on plugin unload
   */
  dispose(): void;
}

/**
 * Implementation of PairingStateStore
 */
export class PairingStateStoreImpl implements PairingStateStore {
  private statePath: string;
  private data: PairingStateData;
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly fs: FileSystem;
  private readonly logger: Logger;
  private readonly stateDir: string;

  // Maximum number of pending pairings per account (prevents unbounded growth)
  private readonly MAX_PAIRINGS_PER_ACCOUNT = 1000;

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
      this.statePath = process.env.ZTM_STATE_PATH.replace(
        /state\.json$/,
        "pairings.json"
      );
    } else {
      this.statePath = path.join(
        process.env.HOME || "",
        ".openclaw",
        "ztm",
        "pairings.json",
      );
    }
    this.stateDir = path.dirname(this.statePath);

    // Ensure the config directory exists on startup to prevent write errors later
    if (!this.fs.existsSync(this.stateDir)) {
      this.fs.mkdirSync(this.stateDir, { recursive: true });
    }
    this.data = { accounts: {} };
    this.load();
  }

  private load(): void {
    try {
      if (this.fs.existsSync(this.statePath)) {
        const content = this.fs.readFileSync(this.statePath, "utf-8");
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === "object" && parsed.accounts) {
          this.data = parsed as PairingStateData;
          this.logger.debug(`Loaded pairing state from ${this.statePath}`);
        }
      }
    } catch {
      // Ignore read/parse errors — start fresh
      this.logger.warn("Failed to load pairing state, starting fresh");
      this.data = { accounts: {} };
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
      if (!this.fs.existsSync(this.stateDir)) {
        this.fs.mkdirSync(this.stateDir, { recursive: true });
      }
      this.fs.writeFileSync(this.statePath, JSON.stringify(this.data, null, 2));
      this.dirty = false;
      this.logger.debug(`Saved pairing state to ${this.statePath}`);
    } catch {
      this.logger.warn("Failed to persist pairing state");
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

  /**
   * Load pending pairings for an account
   */
  loadPendingPairings(accountId: string): Map<string, Date> {
    const pairings = new Map<string, Date>();
    const accountData = this.data.accounts[accountId];
    
    if (accountData) {
      for (const [peer, dateStr] of Object.entries(accountData)) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          pairings.set(peer, date);
        }
      }
    }
    
    return pairings;
  }

  /**
   * Save a pending pairing
   */
  savePendingPairing(accountId: string, peer: string, date: Date = new Date()): void {
    if (!this.data.accounts[accountId]) {
      this.data.accounts[accountId] = {};
    }
    
    this.data.accounts[accountId][peer] = date.toISOString();
    
    // Clean up if limits are exceeded
    this.cleanupIfNeeded(accountId);
    
    this.scheduleSave();
    this.logger.debug(`[${accountId}] Saved pending pairing for ${peer}`);
  }

  /**
   * Delete a pending pairing
   */
  deletePendingPairing(accountId: string, peer: string): void {
    const accountData = this.data.accounts[accountId];
    if (accountData && accountData[peer]) {
      delete accountData[peer];
      this.dirty = true;
      this.scheduleSave();
      this.logger.debug(`[${accountId}] Deleted pending pairing for ${peer}`);
    }
  }

  /**
   * Clean up expired pairings for an account
   * @returns Number of expired pairings removed
   */
  cleanupExpiredPairings(
    accountId: string,
    maxAgeMs: number = 60 * 60 * 1000 // 1 hour default
  ): number {
    const accountData = this.data.accounts[accountId];
    if (!accountData) return 0;

    const now = Date.now();
    let removedCount = 0;

    for (const [peer, dateStr] of Object.entries(accountData)) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime()) && now - date.getTime() > maxAgeMs) {
        delete accountData[peer];
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.dirty = true;
      this.scheduleSave();
      this.logger.info(
        `[${accountId}] Cleaned up ${removedCount} expired pairing(s)`
      );
    }

    return removedCount;
  }

  /**
   * Clean up if limits are exceeded (called after adding a pairing)
   */
  private cleanupIfNeeded(accountId: string): void {
    const accountData = this.data.accounts[accountId];
    if (!accountData) return;

    const entries = Object.entries(accountData);
    if (entries.length > this.MAX_PAIRINGS_PER_ACCOUNT) {
      // Keep the most recent pairings (sort by date descending)
      const sorted = entries
        .map(([peer, dateStr]) => ({ peer, date: new Date(dateStr) }))
        .filter(({ date }) => !isNaN(date.getTime()))
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, this.MAX_PAIRINGS_PER_ACCOUNT);

      this.data.accounts[accountId] = Object.fromEntries(
        sorted.map(({ peer, date }) => [peer, date.toISOString()])
      );

      this.dirty = true;
      this.logger.warn(
        `[${accountId}] Pairing limit exceeded, kept ${this.MAX_PAIRINGS_PER_ACCOUNT} most recent`
      );
    }
  }

  /**
   * Dispose of resources - call on plugin unload to prevent memory leaks
   */
  dispose(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.save();
  }
}

/**
 * Factory function to create PairingStateStore instances
 * Allows dependency injection for testing
 */
export function createPairingStateStore(
  statePath?: string,
  fsImpl?: FileSystem,
  loggerImpl?: Logger
): PairingStateStore {
  return new PairingStateStoreImpl(statePath, fsImpl, loggerImpl);
}

// Default instance for backward compatibility
let defaultInstance: PairingStateStore | null = null;

/**
 * Get or create the default PairingStateStore instance
 */
export function getPairingStateStore(): PairingStateStore {
  if (!defaultInstance) {
    defaultInstance = createPairingStateStore();
  }
  return defaultInstance;
}

// Export dispose function for plugin cleanup
export function disposePairingStateStore(): void {
  if (defaultInstance) {
    defaultInstance.dispose();
    defaultInstance = null;
  }
}
