// Message deduplication with Map key only

import { logger } from "../utils/logger.js";

export class MessageDeduplicator {
  private cache: Set<string>;
  private maxSize: number;
  private trimRatio: number;

  constructor(maxSize: number = 10000, trimRatio: number = 0.5) {
    this.cache = new Set();
    this.maxSize = maxSize;
    this.trimRatio = trimRatio;
  }

  private generateKey(sender: string, time: number): string {
    return `${sender}-${time}`;
  }

  isDuplicate(sender: string, time: number): boolean {
    const key = this.generateKey(sender, time);

    if (this.cache.has(key)) {
      return true;
    }

    // Add new entry
    this.cache.add(key);
    this.trimIfNeeded();
    return false;
  }

  /** Mark a message as seen without checking (used to seed from persisted state) */
  markSeen(sender: string, time: number): void {
    const key = this.generateKey(sender, time);
    this.cache.add(key);
    this.trimIfNeeded();
  }

  private trimIfNeeded(): void {
    if (this.cache.size <= this.maxSize) return;

    const targetSize = Math.floor(this.maxSize * (1 - this.trimRatio));
    const entries = Array.from(this.cache.values());

    // Remove oldest entries (Set maintains insertion order)
    for (let i = 0; i < entries.length - targetSize; i++) {
      this.cache.delete(entries[i]);
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
