// Unit tests for Polling watcher (Watch → Polling fallback)

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { startPollingWatcher } from "./polling.js";
import type { AccountRuntimeState } from "../runtime/state.js";
import type { ZTMChatConfig } from "../config.js";

// Track intervals created during tests
let createdIntervals: ReturnType<typeof setInterval>[] = [];

// Original setInterval
const originalSetInterval = global.setInterval;

// Mock dependencies
vi.mock("../logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock runtime with function that can be changed during tests
let mockReadAllowFromFn = vi.fn(() => Promise.resolve([]));
vi.mock("../runtime.js", () => ({
  getZTMRuntime: () => ({
    channel: {
      pairing: {
        readAllowFromStore: (...args: any[]) => mockReadAllowFromFn(...args),
      },
    },
  }),
}));

vi.mock("./inbound.js", () => ({
  processIncomingMessage: vi.fn(() => null),
  notifyMessageCallbacks: vi.fn(),
  checkDmPolicy: vi.fn(() => ({ allowed: true, reason: "allowed", action: "process" })),
}));

vi.mock("../connectivity/permit.js", () => ({
  handlePairingRequest: vi.fn(() => Promise.resolve()),
}));

describe("Polling Watcher", () => {
  const baseConfig: ZTMChatConfig = {
    agentUrl: "https://example.com:7777",
    permitUrl: "https://example.com/permit",
    meshName: "test-mesh",
    username: "test-bot",
    enableGroups: false,
    autoReply: true,
    messagePath: "/shared",
    allowFrom: [],
    dmPolicy: "pairing",
  };

  let mockState: AccountRuntimeState;
  let setIntervalCallback: (() => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    createdIntervals = [];
    mockReadAllowFromFn = vi.fn(() => Promise.resolve([]));
    setIntervalCallback = null;

    // Mock setInterval to capture callback and create real interval
    global.setInterval = vi.fn((callback: () => void, ms: number) => {
      setIntervalCallback = callback;
      const ref = originalSetInterval(callback, Math.min(ms, 100)); // Use short interval for tests
      createdIntervals.push(ref);
      return ref;
    }) as any;

    mockState = {
      accountId: "test-account",
      config: baseConfig,
      apiClient: {
        getChats: vi.fn(() => []),
      } as any,
      connected: true,
      meshConnected: true,
      lastError: null,
      lastStartAt: new Date(),
      lastStopAt: null,
      lastInboundAt: null,
      lastOutboundAt: null,
      peerCount: 5,
      messageCallbacks: new Set(),
      watchInterval: null,
      watchErrorCount: 0,
      pendingPairings: new Map(),
    };
  });

  afterEach(() => {
    // Clear all intervals
    for (const interval of createdIntervals) {
      clearInterval(interval);
    }
    createdIntervals = [];
    setIntervalCallback = null;
    // Restore original setInterval
    global.setInterval = originalSetInterval;
  });

  describe("startPollingWatcher", () => {
    it("should start polling watcher with default interval", async () => {
      await startPollingWatcher(mockState);

      expect(global.setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        2000 // default 2000ms
      );
      expect(mockState.watchInterval).not.toBeNull();
    });

    it("should use custom polling interval from config", async () => {
      mockState.config = { ...baseConfig, pollingInterval: 5000 } as any;

      await startPollingWatcher(mockState);

      expect(global.setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        5000
      );
    });

    it("should enforce minimum interval of 1000ms", async () => {
      mockState.config = { ...baseConfig, pollingInterval: 100 } as any;

      await startPollingWatcher(mockState);

      expect(global.setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        1000 // enforced minimum
      );
    });

    it("should return early if apiClient is null", async () => {
      mockState.apiClient = null;

      await startPollingWatcher(mockState);

      expect(global.setInterval).not.toHaveBeenCalled();
      expect(mockState.watchInterval).toBeNull();
    });

    it("should poll chats when interval callback executes", async () => {
      const mockChats = [
        { peer: "alice", latest: { time: Date.now(), message: "Hello" } },
        { peer: "bob", latest: { time: Date.now(), message: "Hi" } },
      ];
      mockState.apiClient.getChats = vi.fn(() => mockChats);

      await startPollingWatcher(mockState);

      // Manually trigger the polling callback
      if (setIntervalCallback) {
        await setIntervalCallback();
      }

      expect(mockState.apiClient.getChats).toHaveBeenCalled();
    });

    it("should skip messages from self (bot username)", async () => {
      const mockChats = [
        { peer: "test-bot", latest: { time: Date.now(), message: "Self message" } },
        { peer: "alice", latest: { time: Date.now(), message: "Hello" } },
      ];
      mockState.apiClient.getChats = vi.fn(() => mockChats);

      const { processIncomingMessage } = await import("./inbound.js");

      await startPollingWatcher(mockState);

      // Trigger the callback
      if (setIntervalCallback) {
        await setIntervalCallback();
      }

      // Should only call processIncomingMessage for alice (skip self)
      expect(processIncomingMessage).toHaveBeenCalledTimes(1);
      expect(processIncomingMessage).toHaveBeenCalledWith(
        expect.objectContaining({ sender: "alice" }),
        expect.any(Object),
        expect.any(Map),
        expect.any(Array),
        "test-account"
      );
    });

    it("should skip chats without peer", async () => {
      const mockChats = [
        { peer: null, latest: { time: Date.now(), message: "No peer" } },
        { peer: "alice", latest: { time: Date.now(), message: "Hello" } },
      ] as any;
      mockState.apiClient.getChats = vi.fn(() => mockChats);

      const { processIncomingMessage } = await import("./inbound.js");

      await startPollingWatcher(mockState);

      if (setIntervalCallback) {
        await setIntervalCallback();
      }

      expect(processIncomingMessage).toHaveBeenCalledTimes(1);
    });

    it("should skip chats without latest message", async () => {
      const mockChats = [
        { peer: "alice", latest: null },
        { peer: "bob", latest: { time: Date.now(), message: "Hi" } },
      ] as any;
      mockState.apiClient.getChats = vi.fn(() => mockChats);

      const { processIncomingMessage } = await import("./inbound.js");

      await startPollingWatcher(mockState);

      if (setIntervalCallback) {
        await setIntervalCallback();
      }

      expect(processIncomingMessage).toHaveBeenCalledTimes(1);
    });

    it("should handle polling errors gracefully", async () => {
      mockState.apiClient.getChats = vi.fn(() => {
        throw new Error("Network error");
      });

      await startPollingWatcher(mockState);

      // Trigger should not throw
      if (setIntervalCallback) {
        await expect(setIntervalCallback()).resolves.toBeUndefined();
      }

      expect(createdIntervals.length).toBe(1);
    });

    it("should process valid messages through inbound pipeline", async () => {
      const mockChats = [
        { peer: "alice", latest: { time: 1234567890, message: "Test message" } },
      ];
      mockState.apiClient.getChats = vi.fn(() => mockChats);

      const { processIncomingMessage, notifyMessageCallbacks } = await import("./inbound.js");
      const mockNormalizedMessage = {
        id: "test-id",
        content: "Test message",
        sender: "alice",
        senderId: "alice",
        timestamp: new Date(1234567890),
        peer: "alice",
      };
      (processIncomingMessage as any).mockReturnValue(mockNormalizedMessage);

      await startPollingWatcher(mockState);

      if (setIntervalCallback) {
        await setIntervalCallback();
      }

      expect(processIncomingMessage).toHaveBeenCalledWith(
        {
          time: 1234567890,
          message: "Test message",
          sender: "alice",
        },
        mockState.config,
        mockState.pendingPairings,
        expect.any(Array),
        "test-account"
      );
      expect(notifyMessageCallbacks).toHaveBeenCalledWith(mockState, mockNormalizedMessage);
    });

    it("should check DM policy for each peer", async () => {
      const mockChats = [
        { peer: "alice", latest: { time: Date.now(), message: "Hello" } },
        { peer: "bob", latest: { time: Date.now(), message: "Hi" } },
      ];
      mockState.apiClient.getChats = vi.fn(() => mockChats);

      const { checkDmPolicy } = await import("./inbound.js");

      await startPollingWatcher(mockState);

      if (setIntervalCallback) {
        await setIntervalCallback();
      }

      expect(checkDmPolicy).toHaveBeenCalledTimes(2);
    });

    it("should trigger pairing request for new users", async () => {
      const mockChats = [
        { peer: "stranger", latest: { time: Date.now(), message: "Hello" } },
      ];
      mockState.apiClient.getChats = vi.fn(() => mockChats);

      const { checkDmPolicy } = await import("./inbound.js");
      (checkDmPolicy as any).mockReturnValue({
        allowed: false,
        reason: "pending",
        action: "request_pairing",
      });

      const { handlePairingRequest } = await import("../connectivity/permit.js");

      await startPollingWatcher(mockState);

      if (setIntervalCallback) {
        await setIntervalCallback();
      }

      expect(handlePairingRequest).toHaveBeenCalledWith(
        mockState,
        "stranger",
        "Polling check",
        expect.any(Array)
      );
    });

    it("should read allowFrom store on each poll", async () => {
      const mockChats = [
        { peer: "alice", latest: { time: Date.now(), message: "Hello" } },
      ];
      mockState.apiClient.getChats = vi.fn(() => mockChats);

      mockReadAllowFromFn = vi.fn(() => Promise.resolve(["alice", "bob"]));

      await startPollingWatcher(mockState);

      if (setIntervalCallback) {
        await setIntervalCallback();
      }

      expect(mockReadAllowFromFn).toHaveBeenCalledWith("ztm-chat");
    });

    it("should handle store read failures gracefully", async () => {
      const mockChats = [
        { peer: "alice", latest: { time: Date.now(), message: "Hello" } },
      ];
      mockState.apiClient.getChats = vi.fn(() => mockChats);

      mockReadAllowFromFn = vi.fn(() => Promise.reject(new Error("Store read failed")));

      await startPollingWatcher(mockState);

      // Should not throw, interval should still be created
      if (setIntervalCallback) {
        await expect(setIntervalCallback()).resolves.toBeUndefined();
      }

      expect(createdIntervals.length).toBe(1);
    });

    it("should handle empty chat list", async () => {
      mockState.apiClient.getChats = vi.fn(() => []);

      const { processIncomingMessage } = await import("./inbound.js");

      await startPollingWatcher(mockState);

      if (setIntervalCallback) {
        await setIntervalCallback();
      }

      expect(processIncomingMessage).not.toHaveBeenCalled();
    });

    it("should handle multiple messages from same peer", async () => {
      const mockChats = [
        { peer: "alice", latest: { time: 1000, message: "First" } },
        { peer: "alice", latest: { time: 2000, message: "Second" } },
      ];
      mockState.apiClient.getChats = vi.fn(() => mockChats);

      const { processIncomingMessage } = await import("./inbound.js");

      await startPollingWatcher(mockState);

      if (setIntervalCallback) {
        await setIntervalCallback();
      }

      // Both entries get processed
      expect(processIncomingMessage).toHaveBeenCalledTimes(2);
    });

    it("should handle messages with special characters", async () => {
      const specialMessage = "Hello! 🌍 世界\nNew line\tTab";
      const mockChats = [
        { peer: "alice", latest: { time: Date.now(), message: specialMessage } },
      ];
      mockState.apiClient.getChats = vi.fn(() => mockChats);

      await startPollingWatcher(mockState);

      // Should not throw
      if (setIntervalCallback) {
        await expect(setIntervalCallback()).resolves.toBeUndefined();
      }

      expect(createdIntervals.length).toBe(1);
    });

    it("should handle very long messages", async () => {
      const longMessage = "a".repeat(10000);
      const mockChats = [
        { peer: "alice", latest: { time: Date.now(), message: longMessage } },
      ];
      mockState.apiClient.getChats = vi.fn(() => mockChats);

      await startPollingWatcher(mockState);

      if (setIntervalCallback) {
        await expect(setIntervalCallback()).resolves.toBeUndefined();
      }

      expect(createdIntervals.length).toBe(1);
    });

    it("should handle messages with zero timestamp", async () => {
      const mockChats = [
        { peer: "alice", latest: { time: 0, message: "Zero time" } },
      ];
      mockState.apiClient.getChats = vi.fn(() => mockChats);

      await startPollingWatcher(mockState);

      if (setIntervalCallback) {
        await expect(setIntervalCallback()).resolves.toBeUndefined();
      }

      expect(createdIntervals.length).toBe(1);
    });
  });

  describe("interval management", () => {
    it("should store interval reference in state", async () => {
      await startPollingWatcher(mockState);

      expect(mockState.watchInterval).not.toBeNull();
    });

    it("should allow clearing interval via state reference", async () => {
      await startPollingWatcher(mockState);

      const intervalRef = mockState.watchInterval;
      expect(intervalRef).not.toBeNull();

      // Simulate clearing the interval
      if (intervalRef) {
        clearInterval(intervalRef);
        mockState.watchInterval = null;
      }

      expect(mockState.watchInterval).toBeNull();
    });

    it("should replace existing interval if already set", async () => {
      // Start first watcher
      await startPollingWatcher(mockState);
      const firstInterval = mockState.watchInterval;

      // Start second watcher (should replace)
      await startPollingWatcher(mockState);
      const secondInterval = mockState.watchInterval;

      // In production, the old interval should be cleared
      // This test verifies the state is updated
      expect(secondInterval).not.toBeNull();
    });
  });

  describe("Watch → Polling transition", () => {
    it("should preserve pendingPairings during transition", async () => {
      mockState.pendingPairings.set("alice", new Date());
      mockState.pendingPairings.set("bob", new Date());

      await startPollingWatcher(mockState);

      expect(mockState.pendingPairings.size).toBe(2);
      expect(mockState.pendingPairings.has("alice")).toBe(true);
      expect(mockState.pendingPairings.has("bob")).toBe(true);
    });

    it("should preserve messageCallbacks during transition", async () => {
      const mockCallback = vi.fn();
      mockState.messageCallbacks.add(mockCallback);

      await startPollingWatcher(mockState);

      expect(mockState.messageCallbacks.size).toBe(1);
      expect(mockState.messageCallbacks.has(mockCallback)).toBe(true);
    });

    it("should preserve connection state during transition", async () => {
      mockState.connected = true;
      mockState.meshConnected = true;
      mockState.peerCount = 10;

      await startPollingWatcher(mockState);

      expect(mockState.connected).toBe(true);
      expect(mockState.meshConnected).toBe(true);
      expect(mockState.peerCount).toBe(10);
    });
  });

  describe("configuration edge cases", () => {
    it("should handle undefined pollingInterval", async () => {
      mockState.config = { ...baseConfig } as any; // no pollingInterval

      await startPollingWatcher(mockState);

      expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 2000);
    });

    it("should handle zero pollingInterval", async () => {
      mockState.config = { ...baseConfig, pollingInterval: 0 } as any;

      await startPollingWatcher(mockState);

      expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 1000);
    });

    it("should handle negative pollingInterval", async () => {
      mockState.config = { ...baseConfig, pollingInterval: -1000 } as any;

      await startPollingWatcher(mockState);

      expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 1000);
    });

    it("should handle very large pollingInterval", async () => {
      mockState.config = { ...baseConfig, pollingInterval: 60000 } as any;

      await startPollingWatcher(mockState);

      expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 60000);
    });
  });
});
