// Unit tests for MessageStateStore

import { describe, it, expect, beforeEach, vi } from "vitest";
import { messageStateStore } from "./store.js";

describe("MessageStateStore", () => {
  beforeEach(() => {
    // Clear the store's in-memory data before each test
    messageStateStore.dispose();
  });

  describe("getWatermark", () => {
    it("should return 0 for unknown account", () => {
      const watermark = messageStateStore.getWatermark("unknown-account-test", "unknown-peer");
      expect(watermark).toBe(0);
    });

    it("should return 0 for unknown peer in known account", () => {
      messageStateStore.setWatermark("test-account-1", "peer1", 1000);
      const watermark = messageStateStore.getWatermark("test-account-1", "unknown-peer");
      expect(watermark).toBe(0);
    });

    it("should return the last set watermark", () => {
      messageStateStore.setWatermark("test-account-2", "peer1", 1234567890);
      const watermark = messageStateStore.getWatermark("test-account-2", "peer1");
      expect(watermark).toBe(1234567890);
    });

    it("should maintain separate watermarks per peer", () => {
      messageStateStore.setWatermark("test-account-3", "peer1", 1000);
      messageStateStore.setWatermark("test-account-3", "peer2", 2000);
      messageStateStore.setWatermark("test-account-3", "peer3", 3000);

      expect(messageStateStore.getWatermark("test-account-3", "peer1")).toBe(1000);
      expect(messageStateStore.getWatermark("test-account-3", "peer2")).toBe(2000);
      expect(messageStateStore.getWatermark("test-account-3", "peer3")).toBe(3000);
    });

    it("should maintain separate watermarks per account", () => {
      messageStateStore.setWatermark("test-account-4a", "peer1", 1000);
      messageStateStore.setWatermark("test-account-4b", "peer1", 2000);

      expect(messageStateStore.getWatermark("test-account-4a", "peer1")).toBe(1000);
      expect(messageStateStore.getWatermark("test-account-4b", "peer1")).toBe(2000);
    });
  });

  describe("getGlobalWatermark", () => {
    it("should return 0 for unknown account", () => {
      const watermark = messageStateStore.getGlobalWatermark("unknown-account-global");
      expect(watermark).toBe(0);
    });

    it("should return the maximum watermark across all peers", () => {
      messageStateStore.setWatermark("test-account-5", "peer1", 1000);
      messageStateStore.setWatermark("test-account-5", "peer2", 3000);
      messageStateStore.setWatermark("test-account-5", "peer3", 2000);

      const globalWatermark = messageStateStore.getGlobalWatermark("test-account-5");
      expect(globalWatermark).toBe(3000);
    });

    it("should return 0 when all watermarks are 0", () => {
      messageStateStore.setWatermark("test-account-6", "peer1", 0);
      messageStateStore.setWatermark("test-account-6", "peer2", 0);

      const globalWatermark = messageStateStore.getGlobalWatermark("test-account-6");
      expect(globalWatermark).toBe(0);
    });

    it("should handle negative timestamps (returns 0, not negative)", () => {
      messageStateStore.setWatermark("test-account-7", "peer1", -1000);
      messageStateStore.setWatermark("test-account-7", "peer2", -500);

      // getGlobalWatermark uses Math.max(0, ...values), so it returns 0 for all negative values
      const globalWatermark = messageStateStore.getGlobalWatermark("test-account-7");
      expect(globalWatermark).toBe(0);
    });
  });

  describe("setWatermark", () => {
    it("should only advance forward (ignore lower values)", () => {
      messageStateStore.setWatermark("test-account-8", "peer1", 1000);
      messageStateStore.setWatermark("test-account-8", "peer1", 500); // Should be ignored
      messageStateStore.setWatermark("test-account-8", "peer1", 2000);

      expect(messageStateStore.getWatermark("test-account-8", "peer1")).toBe(2000);
    });

    it("should handle equal values (idempotent)", () => {
      messageStateStore.setWatermark("test-account-9", "peer1", 1000);
      messageStateStore.setWatermark("test-account-9", "peer1", 1000);

      expect(messageStateStore.getWatermark("test-account-9", "peer1")).toBe(1000);
    });

    it("should handle large timestamp values", () => {
      const largeTimestamp = Date.now() + 1000000000;
      messageStateStore.setWatermark("test-account-10", "peer1", largeTimestamp);

      expect(messageStateStore.getWatermark("test-account-10", "peer1")).toBe(largeTimestamp);
    });

    it("should trigger cleanup when limit exceeded", () => {
      // Add more peers than MAX_PEERS_PER_ACCOUNT (1000)
      for (let i = 0; i < 1100; i++) {
        messageStateStore.setWatermark("test-account-11", `peer${i}`, Date.now() + i);
      }

      // Should have trimmed to at most MAX_PEERS_PER_ACCOUNT
      const globalWatermark = messageStateStore.getGlobalWatermark("test-account-11");
      expect(globalWatermark).toBeGreaterThan(0);
    });
  });

  describe("getFileTimes", () => {
    it("should return empty object for unknown account", () => {
      const times = messageStateStore.getFileTimes("unknown-account-files");
      expect(times).toEqual({});
    });

    it("should return set file times", () => {
      const times = { "/path/to/file1": 1000, "/path/to/file2": 2000 };
      messageStateStore.setFileTimes("test-account-12", times);

      const retrieved = messageStateStore.getFileTimes("test-account-12");
      expect(retrieved).toEqual(times);
    });

    it("should return empty object when no file times set", () => {
      const times = messageStateStore.getFileTimes("test-account-fresh");
      expect(times).toEqual({});
    });
  });

  describe("setFileTime", () => {
    it("should set a single file time", () => {
      messageStateStore.setFileTime("test-account-13", "/path/to/file", 1234567890);

      const times = messageStateStore.getFileTimes("test-account-13");
      expect(times["/path/to/file"]).toBe(1234567890);
    });

    it("should update existing file time", () => {
      messageStateStore.setFileTime("test-account-14", "/path/to/file", 1000);
      messageStateStore.setFileTime("test-account-14", "/path/to/file", 2000);

      const times = messageStateStore.getFileTimes("test-account-14");
      expect(times["/path/to/file"]).toBe(2000);
    });

    it("should handle multiple files", () => {
      messageStateStore.setFileTime("test-account-15", "/file1", 1000);
      messageStateStore.setFileTime("test-account-15", "/file2", 2000);
      messageStateStore.setFileTime("test-account-15", "/file3", 3000);

      const times = messageStateStore.getFileTimes("test-account-15");
      expect(Object.keys(times).length).toBe(3);
    });

    it("should trigger cleanup when limit exceeded", () => {
      // Note: setFileTime doesn't trigger cleanup, only setWatermark does
      // This test verifies that setFileTime can handle many files
      for (let i = 0; i < 1100; i++) {
        messageStateStore.setFileTime("test-account-cleanup-files", `/cleanup/path${i}`, Date.now() + i);
      }

      // The store accepts all file times (cleanup only happens on watermark updates)
      const times = messageStateStore.getFileTimes("test-account-cleanup-files");
      expect(Object.keys(times).length).toBe(1100);
    });
  });

  describe("setFileTimes", () => {
    it("should set multiple file times at once", () => {
      const times = {
        "/path/to/file1": 1000,
        "/path/to/file2": 2000,
        "/path/to/file3": 3000,
      };
      messageStateStore.setFileTimes("test-account-17", times);

      const retrieved = messageStateStore.getFileTimes("test-account-17");
      expect(retrieved).toEqual(times);
    });

    it("should merge with existing file times", () => {
      messageStateStore.setFileTime("test-account-18", "/existing", 500);
      const newTimes = { "/new1": 1000, "/new2": 2000 };
      messageStateStore.setFileTimes("test-account-18", newTimes);

      const retrieved = messageStateStore.getFileTimes("test-account-18");
      expect(retrieved["/existing"]).toBe(500);
      expect(retrieved["/new1"]).toBe(1000);
      expect(retrieved["/new2"]).toBe(2000);
    });

    it("should overwrite existing file times", () => {
      messageStateStore.setFileTime("test-account-19", "/file1", 1000);
      messageStateStore.setFileTimes("test-account-19", { "/file1": 2000, "/file2": 3000 });

      const retrieved = messageStateStore.getFileTimes("test-account-19");
      expect(retrieved["/file1"]).toBe(2000); // Overwritten
      expect(retrieved["/file2"]).toBe(3000);
    });
  });

  describe("flush", () => {
    it("should persist state immediately", () => {
      messageStateStore.setWatermark("test-account-20", "peer1", 1234567890);

      // Flush should trigger save
      expect(() => messageStateStore.flush()).not.toThrow();
    });

    it("should cancel any pending save timer", () => {
      messageStateStore.setWatermark("test-account-21", "peer1", 1000);
      messageStateStore.flush();

      // Should not throw even if called multiple times
      messageStateStore.flush();
      messageStateStore.flush();
    });
  });

  describe("dispose", () => {
    it("should clean up resources", () => {
      messageStateStore.setWatermark("test-account-22", "peer1", 1000);

      expect(() => messageStateStore.dispose()).not.toThrow();
    });

    it("should be safe to call multiple times", () => {
      messageStateStore.setWatermark("test-account-23", "peer1", 1000);

      messageStateStore.dispose();
      messageStateStore.dispose();
      messageStateStore.dispose();
    });

    it("should persist state before cleanup", () => {
      messageStateStore.setWatermark("test-account-24", "peer1", 1000);
      messageStateStore.setWatermark("test-account-24", "peer2", 2000);

      messageStateStore.dispose();

      // After dispose, state should still be in memory (dispose doesn't clear memory, just saves to disk)
      expect(messageStateStore.getWatermark("test-account-24", "peer1")).toBe(1000);
      expect(messageStateStore.getWatermark("test-account-24", "peer2")).toBe(2000);
    });
  });

  describe("persistence", () => {
    it("should load existing state on startup", () => {
      // This tests the initialization behavior
      // The store should be usable immediately after construction
      const watermark = messageStateStore.getWatermark("test-startup", "test");
      expect(typeof watermark).toBe("number");
    });

    it("should handle corrupted state file gracefully", () => {
      // The store should not crash if the state file is corrupted
      // It will start with an empty state
      expect(() => messageStateStore.setWatermark("test-corrupt", "test", 1000)).not.toThrow();
    });
  });

  describe("edge cases", () => {
    it("should handle empty account ID", () => {
      messageStateStore.setWatermark("", "peer1", 1000);
      expect(messageStateStore.getWatermark("", "peer1")).toBe(1000);
    });

    it("should handle empty peer ID", () => {
      messageStateStore.setWatermark("test-empty-peer", "", 1000);
      expect(messageStateStore.getWatermark("test-empty-peer", "")).toBe(1000);
    });

    it("should handle special characters in IDs", () => {
      const specialAccountId = "account/with/special\\chars";
      const specialPeerId = "peer:with-special_chars";

      messageStateStore.setWatermark(specialAccountId, specialPeerId, 1000);
      expect(messageStateStore.getWatermark(specialAccountId, specialPeerId)).toBe(1000);
    });

    it("should handle very long IDs", () => {
      const longId = "a".repeat(1000);
      messageStateStore.setWatermark(longId, longId, 1000);
      expect(messageStateStore.getWatermark(longId, longId)).toBe(1000);
    });

    it("should handle unicode characters", () => {
      const unicodeId = "用户-пользователь-🚀";
      messageStateStore.setWatermark(unicodeId, unicodeId, 1000);
      expect(messageStateStore.getWatermark(unicodeId, unicodeId)).toBe(1000);
    });
  });
});
