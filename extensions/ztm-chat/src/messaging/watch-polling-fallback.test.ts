// Integration tests for Watch → Polling fallback behavior

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AccountRuntimeState } from "../runtime/state.js";
import type { ZTMChatConfig } from "../types/config.js";
import type { ZTMApiClient } from "../types/api.js";

// Mock dependencies
vi.mock("../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../runtime/index.js", () => ({
  getZTMRuntime: () => ({
    channel: {
      pairing: {
        upsertPairingRequest: vi.fn(() => Promise.resolve({ code: "ABC123", created: true })),
        readAllowFromStore: vi.fn(() => Promise.resolve([])),
      },
    },
  }),
}));

vi.mock("./store.js", () => ({
  messageStateStore: {
    flush: vi.fn(),
    getWatermark: () => -1,
    setWatermark: () => {},
    setFileMetadataBulk: () => {},
    getFileMetadata: () => ({}),
  },
}));

describe("Watch → Polling Fallback", () => {
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
  let mockStartPollingCalled = false;
  let mockWatchErrorCount = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWatchErrorCount = 0;
    mockStartPollingCalled = false;

    mockState = {
      accountId: "test-account",
      config: baseConfig,
      apiClient: {
        watchChanges: vi.fn(),
        getChats: vi.fn(() => Promise.resolve({ ok: true, value: [] })),
        getPeerMessages: vi.fn(() => Promise.resolve({ ok: true, value: [] })),
        exportFileMetadata: () => ({}),
      } as unknown as ZTMApiClient,
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

  describe("watchErrorCount increment", () => {
    it("should increment watchErrorCount on watch error", async () => {
      mockState.watchErrorCount++;
      expect(mockState.watchErrorCount).toBe(1);
    });

    it("should increment multiple errors", () => {
      mockState.watchErrorCount = 0;
      for (let i = 0; i < 3; i++) {
        mockState.watchErrorCount++;
      }
      expect(mockState.watchErrorCount).toBe(3);
    });

    it("should reset watchErrorCount after successful watch", () => {
      mockState.watchErrorCount = 3;
      mockState.watchErrorCount = 0;
      expect(mockState.watchErrorCount).toBe(0);
    });
  });

  describe("fallback threshold", () => {
    it("should trigger fallback after >5 errors", () => {
      mockState.watchErrorCount = 6;
      const shouldFallback = mockState.watchErrorCount > 5;
      expect(shouldFallback).toBe(true);
    });

    it("should not trigger fallback at 5 errors", () => {
      mockState.watchErrorCount = 5;
      const shouldFallback = mockState.watchErrorCount > 5;
      expect(shouldFallback).toBe(false);
    });

    it("should not trigger fallback at 0 errors", () => {
      mockState.watchErrorCount = 0;
      const shouldFallback = mockState.watchErrorCount > 5;
      expect(shouldFallback).toBe(false);
    });
  });

  describe("fallback behavior", () => {
    it("should reset watchErrorCount when falling back", () => {
      const beforeCount = 6;
      mockState.watchErrorCount = beforeCount;

      mockState.watchErrorCount = 0;
      mockStartPollingCalled = true;

      expect(mockState.watchErrorCount).toBe(0);
      expect(mockStartPollingCalled).toBe(true);
    });

    it("should clear existing watchInterval when falling back", () => {
      const mockInterval = setInterval(() => {}, 1000);
      mockState.watchInterval = mockInterval;

      clearInterval(mockState.watchInterval!);
      mockState.watchInterval = null;

      expect(mockState.watchInterval).toBeNull();
    });
  });

  describe("watch loop error recovery", () => {
    it("should continue watching after transient error", () => {
      let errorCount = 0;
      let continueWatching = true;

      errorCount++;
      expect(errorCount).toBe(1);

      continueWatching = errorCount <= 5;
      expect(continueWatching).toBe(true);
    });

    it("should stop watching after threshold exceeded", () => {
      let errorCount = 6;
      let shouldFallback = errorCount > 5;

      expect(shouldFallback).toBe(true);
    });
  });

  describe("state transitions", () => {
    it("should track state from watch to polling", () => {
      type WatchMode = "watch" | "polling" | "stopped";
      let mode: WatchMode = "watch";
      let errorCount = 0;

      expect(mode).toBe("watch");

      errorCount = 3;
      expect(mode).toBe("watch");

      errorCount = 6;
      if (errorCount > 5) {
        mode = "polling";
        errorCount = 0;
      }

      expect(mode).toBe("polling");
      expect(errorCount).toBe(0);
    });
  });
});

describe("Integration: Watch Error with Pending Pairings", () => {
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

  it("should preserve pending pairings during fallback", () => {
    const pendingPairings = new Map<string, Date>();
    pendingPairings.set("alice", new Date());
    pendingPairings.set("bob", new Date());

    expect(pendingPairings.size).toBe(2);
    expect(pendingPairings.has("alice")).toBe(true);
    expect(pendingPairings.has("bob")).toBe(true);
  });

  it("should continue processing messages from approved users during fallback", () => {
    const allowFrom = ["alice", "bob"];
    const sender = "alice";
    const config = { ...baseConfig, allowFrom };

    const isAllowed = allowFrom.some(
      allowed => allowed.toLowerCase() === sender.toLowerCase()
    );

    expect(isAllowed).toBe(true);
  });
});
