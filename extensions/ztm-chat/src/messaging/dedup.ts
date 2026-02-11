// Message deduplication with LRU-like behavior

import { logger } from "../logger.js";

export interface DedupeEntry {
  sender: string;
  time: number;
  contentHash: string;
}

export class MessageDeduplicator {
  private cache: Map<string, DedupeEntry>;
  private maxSize: number;
  private trimRatio: number;
  private lastMemoryCheck = 0;

  constructor(maxSize: number = 10000, trimRatio: number = 0.5) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.trimRatio = trimRatio;
  }

  private generateKey(sender: string, time: number, content: string): string {
    return `${sender}-${time}-${content.substring(0, 32)}`;
  }

  isDuplicate(sender: string, time: number, content: string): boolean {
    const key = this.generateKey(sender, time, content);

    if (this.cache.has(key)) {
      return true;
    }

    // Add new entry
    this.cache.set(key, { sender, time, contentHash: content });
    this.trimIfNeeded();
    this.checkMemoryUsage();
    return false;
  }

  /** Mark a message as seen without checking (used to seed from persisted state) */
  markSeen(sender: string, time: number, content: string): void {
    const key = this.generateKey(sender, time, content);
    this.cache.set(key, { sender, time, contentHash: content });
    this.trimIfNeeded();
  }

  private trimIfNeeded(): void {
    if (this.cache.size <= this.maxSize) return;

    const targetSize = Math.floor(this.maxSize * (1 - this.trimRatio));
    const entries = Array.from(this.cache.entries());

    // Remove oldest entries
    entries.sort((a, b) => {
      // Simple LRU: remove entries that were added earlier
      return 0;
    });

    for (let i = 0; i < entries.length - targetSize; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /** Check memory usage and clear cache if under memory pressure */
  private checkMemoryUsage(): void {
    const now = Date.now();
    // Only check every 10 seconds to avoid overhead
    if (now - this.lastMemoryCheck < 10000) return;
    this.lastMemoryCheck = now;

    const used = process.memoryUsage();
    // Clear cache if heap exceeds 100MB
    if (used.heapUsed > 100 * 1024 * 1024) {
      this.cache.clear();
      logger.warn("[ztm-chat] Cleared deduplication cache due to memory pressure", {
        heapUsed: Math.round(used.heapUsed / 1024 / 1024) + "MB",
        heapTotal: Math.round(used.heapTotal / 1024 / 1024) + "MB",
      });
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global deduplicator instance
export const messageDeduplicator = new MessageDeduplicator();

// Helper to hash message content for deduplication
export function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
