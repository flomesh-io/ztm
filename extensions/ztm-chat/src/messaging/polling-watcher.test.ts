// Unit tests for Polling Watcher

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { startPollingWatcher } from "./polling.js";
import { testConfig, testAccountId } from "../test-utils/fixtures.js";
import { mockSuccess } from "../test-utils/mocks.js";
import { success } from "../types/common.js";
import type { ZTMChat } from "../api/ztm-api.js";
import { ZtmReadError } from "../types/errors.js";
import type { AccountRuntimeState } from "../types/runtime.js";
import type { ZTMApiClient } from "../types/api.js";
import type { ZTMChatMessage } from "../types/messaging.js";

type ExtendedConfig = typeof testConfig & { pollingInterval?: number; [key: string]: unknown };

let createdIntervals: ReturnType<typeof setInterval>[] = [];
const originalSetInterval = global.setInterval;

interface MockChatOptions {
  peer: string;
  message: string;
  time: number;
  latest?: { time: number; message: string; sender: string } | null;
}

function createMockChat(
  peerOrOptions: string | MockChatOptions,
  message?: string,
  time?: number
): ZTMChat {
  const options: MockChatOptions = typeof peerOrOptions === "string"
    ? { peer: peerOrOptions, message: message!, time: time! }
    : peerOrOptions;

  const { peer, latest } = options;
  return {
    peer,
    time: options.time,
    updated: options.time,
    latest: latest ?? {
      time: options.time,
      message: options.message,
      sender: peer,
    },
  };
}

function createChatsFailure(): { ok: false; error: ZtmReadError } {
  return {
    ok: false,
    error: new ZtmReadError({
      peer: "test",
      operation: "list",
      cause: new Error("Network error"),
    }),
  };
}

vi.mock("../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

let mockReadAllowFromFn: (...args: unknown[]) => Promise<string[]> = vi.fn(() => Promise.resolve([]));
vi.mock("../runtime/index.js", () => ({
  getZTMRuntime: () => ({
    channel: {
      pairing: {
        readAllowFromStore: ((...args: unknown[]) => mockReadAllowFromFn(...args)) as (
          domain: string,
          username: string,
          defaultList: string[]
        ) => Promise<string[]>,
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
  const baseConfig = { ...testConfig, allowFrom: [] as string[], dmPolicy: "pairing" as const };

  let mockState: ReturnType<typeof createMockState>;
  let setIntervalCallback: (() => void) | null = null;

  function createMockState(): AccountRuntimeState {
    return {
      accountId: testAccountId,
      config: baseConfig,
      apiClient: {
        getChats: mockSuccess([]),
      } as unknown as ZTMApiClient,
      connected: true,
      meshConnected: true,
      lastError: null,
      lastStartAt: new Date(),
      lastStopAt: null,
      lastInboundAt: null,
      lastOutboundAt: null,
      peerCount: 5,
      messageCallbacks: new Set<(message: ZTMChatMessage) => void>(),
      watchInterval: null,
      watchErrorCount: 0,
      pendingPairings: new Map(),
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    createdIntervals = [];
    mockReadAllowFromFn = vi.fn(() => Promise.resolve([]));
    setIntervalCallback = null;

    global.setInterval = vi.fn((callback: () => void, ms: number) => {
      setIntervalCallback = callback;
      const ref = originalSetInterval(callback, ms);
      createdIntervals.push(ref);
      return ref;
    }) as unknown as typeof setInterval;

    mockState = createMockState();
  });

  afterEach(() => {
    vi.useRealTimers();
    for (const interval of createdIntervals) {
      clearInterval(interval);
    }
    createdIntervals = [];
    setIntervalCallback = null;
    global.setInterval = originalSetInterval;
  });

  describe("startPollingWatcher", () => {
    it("should start polling watcher with default interval", async () => {
      await startPollingWatcher(mockState);

      expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 2000);
      expect(mockState.watchInterval).not.toBeNull();
    });

    it("should use custom polling interval from config", async () => {
      mockState.config = { ...baseConfig, pollingInterval: 5000 } as ExtendedConfig;

      await startPollingWatcher(mockState);

      expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 5000);
    });

    it("should enforce minimum interval of 1000ms", async () => {
      mockState.config = { ...baseConfig, pollingInterval: 100 } as ExtendedConfig;

      await startPollingWatcher(mockState);

      expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 1000);
    });

    it("should return early if apiClient is null", async () => {
      mockState.apiClient = null;

      await startPollingWatcher(mockState);

      expect(global.setInterval).not.toHaveBeenCalled();
      expect(mockState.watchInterval).toBeNull();
    });

    it("should poll chats when interval callback executes", async () => {
      const now = Date.now();
      const mockChats = [
        createMockChat("alice", "Hello", now),
        createMockChat("bob", "Hi", now),
      ];
      mockState.apiClient!.getChats = vi.fn(() => Promise.resolve(success(mockChats)));

      await startPollingWatcher(mockState);

      if (setIntervalCallback) {
        await setIntervalCallback();
      }

      expect(mockState.apiClient!.getChats).toHaveBeenCalled();
    });

    it("should skip messages from self (bot username)", async () => {
      const now = Date.now();
      const mockChats = [
        createMockChat("test-bot", "Self message", now),
        createMockChat("alice", "Hello", now),
      ];
      mockState.apiClient!.getChats = vi.fn(() => Promise.resolve(success(mockChats)));

      const { processIncomingMessage } = await import("./inbound.js");

      await startPollingWatcher(mockState);

      if (setIntervalCallback) {
        await setIntervalCallback();
      }

      expect(processIncomingMessage).toHaveBeenCalledTimes(1);
      expect(processIncomingMessage).toHaveBeenCalledWith(
        expect.objectContaining({ sender: "alice" }),
        expect.any(Object),
        expect.any(Array),
        "test-account"
      );
    });

    it("should skip chats without peer", async () => {
      const now = Date.now();
      const mockChats = [
        {
          peer: null as unknown as string,
          time: now,
          updated: now,
          latest: { time: now, message: "No peer", sender: "unknown" },
        },
        createMockChat({ peer: "alice", message: "Hello", time: now }),
      ];
      mockState.apiClient!.getChats = vi.fn(() => Promise.resolve(success(mockChats as ZTMChat[])));

      const { processIncomingMessage } = await import("./inbound.js");

      await startPollingWatcher(mockState);

      if (setIntervalCallback) {
        await setIntervalCallback();
      }

      expect(processIncomingMessage).toHaveBeenCalledTimes(1);
    });

    it("should skip chats without latest message", async () => {
      const now = Date.now();
      const mockChats = [
        {
          peer: "alice",
          time: now,
          updated: now,
          latest: null,
        },
        createMockChat({ peer: "bob", message: "Hi", time: now }),
      ];
      mockState.apiClient!.getChats = vi.fn(() => Promise.resolve(success(mockChats as ZTMChat[])));

      const { processIncomingMessage } = await import("./inbound.js");

      await startPollingWatcher(mockState);

      if (setIntervalCallback) {
        await setIntervalCallback();
      }

      expect(processIncomingMessage).toHaveBeenCalledTimes(1);
    });

    it("should handle polling errors gracefully", async () => {
      mockState.apiClient!.getChats = vi.fn(() => Promise.resolve(createChatsFailure()));

      await startPollingWatcher(mockState);

      if (setIntervalCallback) {
        await setIntervalCallback();
      }

      expect(createdIntervals.length).toBe(1);
    });

    it("should process valid messages through inbound pipeline", async () => {
      const now = Date.now();
      const mockChats = [
        createMockChat("alice", "Test message", 1234567890),
      ];
      mockState.apiClient!.getChats = vi.fn(() => Promise.resolve(success(mockChats)));

      const inboundModule = await import("./inbound.js");
      const mockNormalizedMessage = {
        id: "test-id",
        content: "Test message",
        sender: "alice",
        senderId: "alice",
        timestamp: new Date(1234567890),
        peer: "alice",
      };
      vi.mocked(inboundModule.processIncomingMessage).mockReturnValue(mockNormalizedMessage);

      await startPollingWatcher(mockState);

      if (setIntervalCallback) {
        await setIntervalCallback();
      }

      expect(inboundModule.processIncomingMessage).toHaveBeenCalledWith(
        { time: 1234567890, message: "Test message", sender: "alice" },
        mockState.config,
        expect.any(Array),
        "test-account"
      );
      expect(inboundModule.notifyMessageCallbacks).toHaveBeenCalledWith(mockState, mockNormalizedMessage);
    });

    it("should check DM policy for each peer", async () => {
      const now = Date.now();
      const mockChats = [
        createMockChat("alice", "Hello", now),
        createMockChat("bob", "Hi", now),
      ];
      mockState.apiClient!.getChats = vi.fn(() => Promise.resolve(success(mockChats)));

      const inboundModule = await import("./inbound.js");

      await startPollingWatcher(mockState);

      if (setIntervalCallback) {
        await setIntervalCallback();
      }

      expect(inboundModule.checkDmPolicy).toHaveBeenCalledTimes(2);
    });

    it("should trigger pairing request for new users", async () => {
      const now = Date.now();
      const mockChats = [
        createMockChat("stranger", "Hello", now),
      ];
      mockState.apiClient!.getChats = vi.fn(() => Promise.resolve(success(mockChats)));

      const inboundModule = await import("./inbound.js");
      vi.mocked(inboundModule.checkDmPolicy).mockReturnValue({
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
      const now = Date.now();
      const mockChats = [
        createMockChat("alice", "Hello", now),
      ];
      mockState.apiClient!.getChats = vi.fn(() => Promise.resolve(success(mockChats)));

      mockReadAllowFromFn = vi.fn(() => Promise.resolve(["alice", "bob"]));

      await startPollingWatcher(mockState);

      if (setIntervalCallback) {
        await setIntervalCallback();
      }

      expect(mockReadAllowFromFn).toHaveBeenCalledWith("ztm-chat");
    });

    it("should handle store read failures gracefully", async () => {
      const now = Date.now();
      const mockChats = [
        createMockChat("alice", "Hello", now),
      ];
      mockState.apiClient!.getChats = vi.fn(() => Promise.resolve(success(mockChats)));

      mockReadAllowFromFn = vi.fn(() => Promise.reject(new Error("Store read failed")));

      await startPollingWatcher(mockState);

      if (setIntervalCallback) {
        await expect(setIntervalCallback()).resolves.toBeUndefined();
      }

      expect(createdIntervals.length).toBe(1);
    });

    it("should handle empty chat list", async () => {
      mockState.apiClient!.getChats = vi.fn(() => Promise.resolve(success<ZTMChat[], ZtmReadError>([])));

      const { processIncomingMessage } = await import("./inbound.js");

      await startPollingWatcher(mockState);

      if (setIntervalCallback) {
        await setIntervalCallback();
      }

      expect(processIncomingMessage).not.toHaveBeenCalled();
    });

    it("should handle multiple messages from same peer", async () => {
      const mockChats = [
        createMockChat("alice", "First", 1000),
        createMockChat("alice", "Second", 2000),
      ];
      mockState.apiClient!.getChats = vi.fn(() => Promise.resolve(success(mockChats)));

      const { processIncomingMessage } = await import("./inbound.js");

      await startPollingWatcher(mockState);

      if (setIntervalCallback) {
        await setIntervalCallback();
      }

      expect(processIncomingMessage).toHaveBeenCalledTimes(2);
    });

    it("should handle messages with special characters", async () => {
      const specialMessage = "Hello! 🌍 世界\nNew line\tTab";
      const now = Date.now();
      const mockChats = [
        createMockChat("alice", specialMessage, now),
      ];
      mockState.apiClient!.getChats = vi.fn(() => Promise.resolve(success(mockChats)));

      await startPollingWatcher(mockState);

      if (setIntervalCallback) {
        await expect(setIntervalCallback()).resolves.toBeUndefined();
      }

      expect(createdIntervals.length).toBe(1);
    });

    it("should handle very long messages", async () => {
      const longMessage = "a".repeat(10000);
      const now = Date.now();
      const mockChats = [
        createMockChat("alice", longMessage, now),
      ];
      mockState.apiClient!.getChats = vi.fn(() => Promise.resolve(success(mockChats)));

      await startPollingWatcher(mockState);

      if (setIntervalCallback) {
        await expect(setIntervalCallback()).resolves.toBeUndefined();
      }

      expect(createdIntervals.length).toBe(1);
    });

    it("should handle messages with zero timestamp", async () => {
      const mockChats = [
        createMockChat("alice", "Zero time", 0),
      ];
      mockState.apiClient!.getChats = vi.fn(() => Promise.resolve(success(mockChats)));

      await startPollingWatcher(mockState);

      if (setIntervalCallback) {
        await expect(setIntervalCallback()).resolves.toBeUndefined();
      }

      expect(createdIntervals.length).toBe(1);
    });
  });
});
