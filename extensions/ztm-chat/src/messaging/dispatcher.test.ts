// Unit tests for Message Dispatcher

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  notifyMessageCallbacks,
  getCallbackStats,
  hasCallbacks,
  clearCallbacks,
} from "./dispatcher.js";
import { testAccountId } from "../test-utils/fixtures.js";
import type { ZTMChatMessage } from "../types/messaging.js";
import type { AccountRuntimeState } from "../types/runtime.js";

// Mock dependencies
vi.mock("../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../runtime/store.js", () => ({
  getMessageStateStore: vi.fn(() => ({
    getWatermark: vi.fn(() => -1),
    getGlobalWatermark: vi.fn(() => 0),
    setWatermark: vi.fn(),
    getFileMetadata: vi.fn(() => ({})),
    setFileMetadata: vi.fn(),
    setFileMetadataBulk: vi.fn(),
    flush: vi.fn(),
    dispose: vi.fn(),
  })),
  disposeMessageStateStore: vi.fn(),
}));

describe("Message Dispatcher", () => {
  let mockState: ReturnType<typeof createMockState>;

  function createMockState(): AccountRuntimeState {
    return {
      accountId: testAccountId,
      config: {} as any,
      apiClient: null,
      connected: false,
      meshConnected: false,
      lastError: null,
      lastStartAt: null,
      lastStopAt: null,
      lastInboundAt: null,
      lastOutboundAt: null,
      peerCount: 0,
      messageCallbacks: new Set<(message: ZTMChatMessage) => void>(),
      watchInterval: null,
      watchErrorCount: 0,
      pendingPairings: new Map(),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockState = createMockState();
  });

  describe("notifyMessageCallbacks", () => {
    it("should update lastInboundAt timestamp", () => {
      const before = mockState.lastInboundAt;
      const message: ZTMChatMessage = {
        id: "123",
        content: "Test",
        sender: "alice",
        senderId: "alice",
        timestamp: new Date(),
        peer: "alice",
      };

      notifyMessageCallbacks(mockState, message);

      expect(mockState.lastInboundAt).not.toBe(before);
      expect(mockState.lastInboundAt).toBeInstanceOf(Date);
    });

    it("should call all registered callbacks", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      mockState.messageCallbacks = new Set([callback1, callback2]);

      const message: ZTMChatMessage = {
        id: "123",
        content: "Test",
        sender: "alice",
        senderId: "alice",
        timestamp: new Date(),
        peer: "alice",
      };

      notifyMessageCallbacks(mockState, message);

      expect(callback1).toHaveBeenCalledWith(message);
      expect(callback2).toHaveBeenCalledWith(message);
    });

    it("should continue calling other callbacks if one throws", () => {
      const errorCallback = vi.fn(() => {
        throw new Error("Callback error");
      });
      const successCallback = vi.fn();
      mockState.messageCallbacks = new Set([errorCallback, successCallback]);

      const message: ZTMChatMessage = {
        id: "123",
        content: "Test",
        sender: "alice",
        senderId: "alice",
        timestamp: new Date(),
        peer: "alice",
      };

      expect(() => {
        notifyMessageCallbacks(mockState, message);
      }).not.toThrow();

      expect(successCallback).toHaveBeenCalled();
    });

    it("should update watermark after successful callbacks", async () => {
      const { getMessageStateStore } = await import("../runtime/store.js");
      const mockStore = {
        getWatermark: vi.fn(() => -1),
        getGlobalWatermark: vi.fn(() => 0),
        setWatermark: vi.fn(),
        getFileMetadata: vi.fn(() => ({})),
        setFileMetadata: vi.fn(),
        setFileMetadataBulk: vi.fn(),
        flush: vi.fn(),
        dispose: vi.fn(),
      };

      // Set the mock to return our test store
      vi.mocked(getMessageStateStore).mockReturnValue(mockStore);

      const callback = vi.fn();
      mockState.messageCallbacks = new Set([callback]);

      const message: ZTMChatMessage = {
        id: "123",
        content: "Test",
        sender: "alice",
        senderId: "alice",
        timestamp: new Date(1234567890),
        peer: "alice",
      };

      notifyMessageCallbacks(mockState, message);

      // Verify that setWatermark was called on the store
      expect(mockStore.setWatermark).toHaveBeenCalledWith(
        testAccountId,
        "alice",
        1234567890
      );
    });
  });

  describe("getCallbackStats", () => {
    it("should return correct stats", () => {
      mockState.messageCallbacks = new Set([vi.fn(), vi.fn()]);

      const stats = getCallbackStats(mockState);

      expect(stats.total).toBe(2);
      expect(stats.active).toBe(2);
    });

    it("should return zero for no callbacks", () => {
      const stats = getCallbackStats(mockState);

      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
    });
  });

  describe("hasCallbacks", () => {
    it("should return true when callbacks exist", () => {
      mockState.messageCallbacks = new Set([vi.fn()]);

      expect(hasCallbacks(mockState)).toBe(true);
    });

    it("should return false when no callbacks", () => {
      expect(hasCallbacks(mockState)).toBe(false);
    });
  });

  describe("clearCallbacks", () => {
    it("should remove all callbacks", () => {
      const callback = vi.fn();
      mockState.messageCallbacks = new Set([callback]);

      clearCallbacks(mockState);

      expect(mockState.messageCallbacks.size).toBe(0);
    });

    it("should log cleared callback count", async () => {
      mockState.messageCallbacks = new Set([vi.fn(), vi.fn()]);
      const { logger } = await import("../utils/logger.js");

      clearCallbacks(mockState);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Cleared 2 callback(s)")
      );
    });
  });
});
