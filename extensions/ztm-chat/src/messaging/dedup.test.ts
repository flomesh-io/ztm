// Unit tests for MessageDeduplicator

import { describe, it, expect, beforeEach } from "vitest";
import { messageDeduplicator } from "./dedup.js";

describe("MessageDeduplicator", () => {
  beforeEach(() => {
    // Clear the cache before each test
    messageDeduplicator.clear();
  });

  describe("isDuplicate", () => {
    it("should return false for first-time messages", () => {
      const result = messageDeduplicator.isDuplicate("alice", 1234567890);
      expect(result).toBe(false);
    });

    it("should return true for duplicate messages", () => {
      messageDeduplicator.isDuplicate("alice", 1234567890);
      const result = messageDeduplicator.isDuplicate("alice", 1234567890);
      expect(result).toBe(true);
    });

    it("should treat messages with different senders as unique", () => {
      messageDeduplicator.isDuplicate("alice", 1234567890);
      const result = messageDeduplicator.isDuplicate("bob", 1234567890);
      expect(result).toBe(false);
    });

    it("should treat messages with different timestamps as unique", () => {
      messageDeduplicator.isDuplicate("alice", 1234567890);
      const result = messageDeduplicator.isDuplicate("alice", 1234567891);
      expect(result).toBe(false);
    });

    it("should handle zero timestamp", () => {
      const result = messageDeduplicator.isDuplicate("alice", 0);
      expect(result).toBe(false);
    });

    it("should handle negative timestamp", () => {
      const result = messageDeduplicator.isDuplicate("alice", -1000);
      expect(result).toBe(false);
    });
  });

  describe("markSeen", () => {
    it("should mark a message as seen without checking", () => {
      messageDeduplicator.markSeen("alice", 1234567890);
      const result = messageDeduplicator.isDuplicate("alice", 1234567890);
      expect(result).toBe(true);
    });

    it("should allow marking multiple messages", () => {
      messageDeduplicator.markSeen("alice", 1);
      messageDeduplicator.markSeen("bob", 2);
      messageDeduplicator.markSeen("charlie", 3);

      expect(messageDeduplicator.size()).toBe(3);
    });
  });

  describe("clear", () => {
    it("should clear all entries", () => {
      messageDeduplicator.isDuplicate("alice", 1);
      messageDeduplicator.isDuplicate("bob", 2);
      expect(messageDeduplicator.size()).toBe(2);

      messageDeduplicator.clear();
      expect(messageDeduplicator.size()).toBe(0);

      // After clear, should not detect duplicates
      const result = messageDeduplicator.isDuplicate("alice", 1);
      expect(result).toBe(false);
    });
  });

  describe("size", () => {
    it("should return 0 for empty cache", () => {
      expect(messageDeduplicator.size()).toBe(0);
    });

    it("should return correct count after adding entries", () => {
      messageDeduplicator.isDuplicate("alice", 1);
      expect(messageDeduplicator.size()).toBe(1);

      messageDeduplicator.isDuplicate("bob", 2);
      expect(messageDeduplicator.size()).toBe(2);

      // Duplicate doesn't increase size
      messageDeduplicator.isDuplicate("alice", 1);
      expect(messageDeduplicator.size()).toBe(2);
    });
  });

  describe("trim mechanism", () => {
    it("should trim cache when size exceeds max", () => {
      // The deduplicator has a max size, adding many entries should trigger trimming
      const maxSize = 10000;
      for (let i = 0; i < maxSize + 100; i++) {
        messageDeduplicator.isDuplicate(`user${i}`, Date.now() + i);
      }

      // Size should be managed (not exceed maxSize significantly)
      const finalSize = messageDeduplicator.size();
      expect(finalSize).toBeLessThanOrEqual(maxSize);
    });
  });

  describe("edge cases", () => {
    it("should handle null/undefined sender gracefully", () => {
      expect(() => messageDeduplicator.isDuplicate(null as any, 0)).not.toThrow();
    });

    it("should handle very long sender names", () => {
      const longSender = "a".repeat(1000);
      const result = messageDeduplicator.isDuplicate(longSender, 1234567890);
      expect(result).toBe(false);
    });
  });
});
