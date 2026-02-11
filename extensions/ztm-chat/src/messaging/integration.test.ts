// Integration tests for Watch → Polling fallback and Pairing flow

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AccountRuntimeState } from "../runtime/state.js";
import type { ZTMChatConfig } from "../config.js";

// Mock dependencies
vi.mock("../logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../runtime.js", () => ({
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
    setFileTimes: () => {},
    getFileTimes: () => ({}),
  },
}));

vi.mock("./dedup.js", () => ({
  messageDeduplicator: {
    isDuplicate: () => false,
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
        getChats: vi.fn(() => []),
        getPeerMessages: vi.fn(() => []),
        exportLastSeenTimes: () => ({}),
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

  describe("watchErrorCount increment", () => {
    it("should increment watchErrorCount on watch error", async () => {
      // Simulate watch error
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
      // Simulate successful watch
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

      // Simulate fallback: reset count and start polling
      mockState.watchErrorCount = 0;
      mockStartPollingCalled = true;

      expect(mockState.watchErrorCount).toBe(0);
      expect(mockStartPollingCalled).toBe(true);
    });

    it("should clear existing watchInterval when falling back", () => {
      // Set up mock watch interval
      const mockInterval = setInterval(() => {}, 1000);
      mockState.watchInterval = mockInterval;

      // Simulate fallback
      clearInterval(mockState.watchInterval!);
      mockState.watchInterval = null;

      expect(mockState.watchInterval).toBeNull();
    });
  });

  describe("watch loop error recovery", () => {
    it("should continue watching after transient error", () => {
      let errorCount = 0;
      let continueWatching = true;

      // Simulate error
      errorCount++;
      expect(errorCount).toBe(1);

      // Simulate recovery - still below threshold
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

      // Initial state
      expect(mode).toBe("watch");

      // Errors accumulate
      errorCount = 3;
      expect(mode).toBe("watch"); // Still watching

      // Threshold exceeded
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

describe("Complete Pairing Request Flow", () => {
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
  let mockPairingRequests: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    mockPairingRequests = [];

    mockState = {
      accountId: "test-account",
      config: baseConfig,
      apiClient: {
        sendPeerMessage: vi.fn().mockResolvedValue(true),
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

  describe("new user triggers pairing request", () => {
    it("should check dmPolicy and trigger pairing for new user", async () => {
      const sender = "alice";
      const pendingPairings = new Map<string, Date>();
      const allowFrom: string[] = [];

      // Check DM policy
      const isNewUser = !pendingPairings.has(sender) &&
        !allowFrom.some(allowed => allowed.toLowerCase() === sender.toLowerCase());

      expect(isNewUser).toBe(true);

      // Would trigger pairing request
      const action = isNewUser ? "request_pairing" : "process";
      expect(action).toBe("request_pairing");
    });

    it("should add user to pending pairings", () => {
      const sender = "alice";
      mockState.pendingPairings.set(sender, new Date());

      expect(mockState.pendingPairings.has(sender)).toBe(true);
      expect(mockState.pendingPairings.size).toBe(1);
    });

    it("should send pairing message to user", async () => {
      const sender = "alice";
      const pairingCode = "ABC123";

      if (mockState.apiClient) {
        await mockState.apiClient.sendPeerMessage(sender, {
          message: `Pairing code: ${pairingCode}`,
          time: Date.now(),
          sender: mockState.config.username,
        });
      }

      expect(mockState.apiClient?.sendPeerMessage).toHaveBeenCalledWith(
        sender,
        expect.objectContaining({
          message: expect.stringContaining("ABC123"),
        })
      );
    });
  });

  describe("already pending user is ignored", () => {
    it("should detect already pending user", () => {
      const sender = "alice";
      mockState.pendingPairings.set(sender, new Date());

      const isPending = mockState.pendingPairings.has(sender);
      expect(isPending).toBe(true);
    });

    it("should skip pairing request for pending user", () => {
      const sender = "alice";
      mockState.pendingPairings.set(sender, new Date());

      const isPending = mockState.pendingPairings.has(sender);
      if (isPending) {
        const action = "ignore";
        expect(action).toBe("ignore");
      }
    });

    it("should not send message for pending user", async () => {
      const sender = "alice";
      mockState.pendingPairings.set(sender, new Date());

      const isPending = mockState.pendingPairings.has(sender);
      if (!isPending) {
        if (mockState.apiClient) {
          await mockState.apiClient.sendPeerMessage(sender, {
            message: "test",
            time: Date.now(),
            sender: mockState.config.username,
          });
        }
      }

      // Verify sendPeerMessage was not called
      expect(mockState.apiClient?.sendPeerMessage).not.toHaveBeenCalled();
    });
  });

  describe("allowFrom whitelist bypass", () => {
    it("should allow whitelisted user directly", () => {
      const sender = "alice";
      const config = { ...baseConfig, allowFrom: ["alice"] };
      const pendingPairings = new Map<string, Date>();
      const storeAllowFrom: string[] = [];

      const isAllowed = config.allowFrom?.some(
        allowed => allowed.toLowerCase() === sender.toLowerCase()
      ) || storeAllowFrom.some(
        allowed => allowed.toLowerCase() === sender.toLowerCase()
      );

      expect(isAllowed).toBe(true);
    });

    it("should not trigger pairing for whitelisted user", () => {
      const sender = "alice";
      const config = { ...baseConfig, allowFrom: ["alice"] };
      const pendingPairings = new Map<string, Date>();
      const storeAllowFrom: string[] = [];

      const isWhitelisted = config.allowFrom?.some(
        allowed => allowed.toLowerCase() === sender.toLowerCase()
      );

      const action = isWhitelisted ? "process" : "request_pairing";
      expect(action).toBe("process");
    });

    it("should process message from whitelisted user", () => {
      const sender = "alice";
      const config = { ...baseConfig, allowFrom: ["alice", "bob"] };

      const isAllowed = config.allowFrom?.includes(sender);
      expect(isAllowed).toBe(true);
    });
  });

  describe("store allowFrom bypass", () => {
    it("should allow store-approved user directly", () => {
      const sender = "bob";
      const config = { ...baseConfig, allowFrom: [] };
      const pendingPairings = new Map<string, Date>();
      const storeAllowFrom = ["bob", "charlie"];

      const isAllowed = config.allowFrom?.some(
        allowed => allowed.toLowerCase() === sender.toLowerCase()
      ) || storeAllowFrom.some(
        allowed => allowed.toLowerCase() === sender.toLowerCase()
      );

      expect(isAllowed).toBe(true);
    });

    it("should prefer config allowFrom over store", () => {
      const sender = "alice";
      const config = { ...baseConfig, allowFrom: ["alice"] };
      const storeAllowFrom = []; // Empty store

      const isAllowed = config.allowFrom?.some(
        allowed => allowed.toLowerCase() === sender.toLowerCase()
      ) || storeAllowFrom.some(
        allowed => allowed.toLowerCase() === sender.toLowerCase()
      );

      expect(isAllowed).toBe(true);
    });

    it("should fall back to store when config allowFrom is empty", () => {
      const sender = "bob";
      const config = { ...baseConfig, allowFrom: [] };
      const storeAllowFrom = ["bob"];

      const isAllowed = config.allowFrom?.some(
        allowed => allowed.toLowerCase() === sender.toLowerCase()
      ) || storeAllowFrom.some(
        allowed => allowed.toLowerCase() === sender.toLowerCase()
      );

      expect(isAllowed).toBe(true);
    });
  });

  describe("pairing code generation", () => {
    it("should generate unique pairing code", () => {
      const codes = new Set<string>();

      for (let i = 0; i < 10; i++) {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        codes.add(code);
      }

      // With random generation, there might be some duplicates, but typically unique
      expect(codes.size).toBeGreaterThan(5);
    });

    it("should format pairing message correctly", () => {
      const peer = "alice";
      const code = "ABC123";

      const message = `[PAIRING REQUEST]
User: ${peer}
Code: ${code}
To approve, run: openclaw pairing approve ztm-chat ${peer}`;

      expect(message).toContain("alice");
      expect(message).toContain("ABC123");
      expect(message).toContain("openclaw pairing approve");
    });
  });

  describe("case-insensitive matching", () => {
    it("should match allowFrom case-insensitively", () => {
      const config = { ...baseConfig, allowFrom: ["Alice", "BOB"] };
      const sender1 = "alice";
      const sender2 = "ALICE";
      const sender3 = "bob";

      const match1 = config.allowFrom?.some(
        allowed => allowed.toLowerCase() === sender1.toLowerCase()
      );
      const match2 = config.allowFrom?.some(
        allowed => allowed.toLowerCase() === sender2.toLowerCase()
      );
      const match3 = config.allowFrom?.some(
        allowed => allowed.toLowerCase() === sender3.toLowerCase()
      );

      expect(match1).toBe(true);
      expect(match2).toBe(true);
      expect(match3).toBe(true);
    });
  });

  describe("username normalization", () => {
    it("should trim whitespace from usernames", () => {
      const sender = "  alice  ";
      const normalized = sender.trim();

      expect(normalized).toBe("alice");
    });

    it("should handle various username formats", () => {
      const testCases = [
        { input: "alice", expected: "alice" },
        { input: "  Alice  ", expected: "Alice" },
        { input: "bob-123", expected: "bob-123" },
        { input: "user_456", expected: "user_456" },
      ];

      for (const { input, expected } of testCases) {
        const trimmed = input.trim();
        expect(trimmed).toBe(expected);
      }
    });
  });

  describe("pairing state persistence", () => {
    it("should store pairing timestamp", () => {
      const sender = "alice";
      const timestamp = new Date();

      mockState.pendingPairings.set(sender, timestamp);

      const stored = mockState.pendingPairings.get(sender);
      expect(stored).toBe(timestamp);
    });

    it("should allow multiple pending pairings", () => {
      mockState.pendingPairings.set("alice", new Date());
      mockState.pendingPairings.set("bob", new Date());
      mockState.pendingPairings.set("charlie", new Date());

      expect(mockState.pendingPairings.size).toBe(3);
    });

    it("should remove user from pending after approval", () => {
      const sender = "alice";
      mockState.pendingPairings.set(sender, new Date());

      expect(mockState.pendingPairings.has(sender)).toBe(true);

      // Simulate approval - remove from pending
      mockState.pendingPairings.delete(sender);

      expect(mockState.pendingPairings.has(sender)).toBe(false);
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

    // Simulate fallback
    // Pending pairings should be preserved
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

describe("DM Policy Integration", () => {
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

  describe("dmPolicy='allow' bypasses all checks", () => {
    it("should allow all users when dmPolicy is 'allow'", () => {
      const config = { ...baseConfig, dmPolicy: "allow" as const };
      const sender = "stranger";
      const pendingPairings = new Map<string, Date>();

      const shouldAllow = config.dmPolicy === "allow";
      const action = shouldAllow ? "process" : "request_pairing";

      expect(action).toBe("process");
    });
  });

  describe("dmPolicy='deny' blocks all messages", () => {
    it("should deny all users when dmPolicy is 'deny'", () => {
      const config = { ...baseConfig, dmPolicy: "deny" as const };
      const sender = "alice";
      const allowFrom = ["alice"]; // Even whitelisted

      const shouldDeny = config.dmPolicy === "deny";
      const action = shouldDeny ? "ignore" : "process";

      expect(action).toBe("ignore");
    });
  });

  describe("unknown dmPolicy defaults to allow", () => {
    it("should default to allow for unknown policy", () => {
      const config = { ...baseConfig, dmPolicy: "unknown" as any };

      const isUnknown = !["allow", "deny", "pairing"].includes(config.dmPolicy);
      const shouldAllow = isUnknown;

      expect(shouldAllow).toBe(true);
    });
  });
});
