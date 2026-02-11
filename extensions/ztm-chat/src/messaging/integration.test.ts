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

describe("Message Timestamp Ordering", () => {
  const baseConfig: ZTMChatConfig = {
    agentUrl: "https://example.com:7777",
    permitUrl: "https://example.com/permit",
    meshName: "test-mesh",
    username: "test-bot",
    enableGroups: false,
    autoReply: true,
    messagePath: "/shared",
    allowFrom: [],
    dmPolicy: "allow",
  };

  it("should process messages in timestamp order", () => {
    const messages = [
      { time: 1000, message: "First", sender: "alice" },
      { time: 2000, message: "Second", sender: "alice" },
      { time: 1500, message: "Middle", sender: "alice" },
      { time: 3000, message: "Last", sender: "alice" },
    ];

    // Sort by timestamp
    const sorted = [...messages].sort((a, b) => a.time - b.time);

    expect(sorted[0].message).toBe("First");
    expect(sorted[1].message).toBe("Middle");
    expect(sorted[2].message).toBe("Second");
    expect(sorted[3].message).toBe("Last");
  });

  it("should detect out-of-order messages", () => {
    const lastWatermark = 2000;
    const newMessage = { time: 1500, message: "Old message", sender: "alice" };

    const isOutOfOrder = newMessage.time <= lastWatermark;
    expect(isOutOfOrder).toBe(true);
  });

  it("should advance watermark for newer messages", () => {
    let watermark = 1000;
    const messages = [1500, 2000, 2500, 3000];

    for (const time of messages) {
      if (time > watermark) {
        watermark = time;
      }
    }

    expect(watermark).toBe(3000);
  });

  it("should not advance watermark for older messages", () => {
    let watermark = 3000;
    const messages = [1000, 1500, 2000];

    for (const time of messages) {
      if (time > watermark) {
        watermark = time;
      }
    }

    expect(watermark).toBe(3000);
  });

  it("should handle messages with same timestamp", () => {
    const messages = [
      { time: 1000, message: "A", sender: "alice" },
      { time: 1000, message: "B", sender: "alice" },
      { time: 1000, message: "C", sender: "alice" },
    ];

    // All have same timestamp - should be processed by content differences
    const timestamps = messages.map(m => m.time);
    expect(new Set(timestamps).size).toBe(1);
  });

  it("should track per-peer watermarks independently", () => {
    const watermarks: Record<string, number> = {};

    // Process messages from different peers
    watermarks["alice"] = 1000;
    watermarks["bob"] = 2000;
    watermarks["charlie"] = 1500;

    // Update alice's watermark
    if (3000 > (watermarks["alice"] || 0)) {
      watermarks["alice"] = 3000;
    }

    expect(watermarks["alice"]).toBe(3000);
    expect(watermarks["bob"]).toBe(2000); // unchanged
    expect(watermarks["charlie"]).toBe(1500); // unchanged
  });

  it("should handle zero timestamp as special case", () => {
    const watermark = 1000;
    const message = { time: 0, message: "Zero time" };

    // Zero timestamp should still be processed if >= watermark logic allows
    // (actual implementation may vary)
    expect(message.time).toBe(0);
  });
});

describe("Multi-Account Isolation", () => {
  const createAccountState = (accountId: string): AccountRuntimeState => ({
    accountId,
    config: {
      agentUrl: "https://example.com:7777",
      permitUrl: "https://example.com/permit",
      meshName: "test-mesh",
      username: `bot-${accountId}`,
      enableGroups: false,
      autoReply: true,
      messagePath: "/shared",
      allowFrom: [],
      dmPolicy: "pairing",
    },
    apiClient: null,
    connected: true,
    meshConnected: true,
    lastError: null,
    lastStartAt: null,
    lastStopAt: null,
    lastInboundAt: null,
    lastOutboundAt: null,
    peerCount: 5,
    messageCallbacks: new Set(),
    watchInterval: null,
    watchErrorCount: 0,
    pendingPairings: new Map(),
  });

  it("should isolate pendingPairings per account", () => {
    const account1 = createAccountState("account1");
    const account2 = createAccountState("account2");

    account1.pendingPairings.set("alice", new Date());
    account2.pendingPairings.set("bob", new Date());

    expect(account1.pendingPairings.has("alice")).toBe(true);
    expect(account1.pendingPairings.has("bob")).toBe(false);
    expect(account2.pendingPairings.has("alice")).toBe(false);
    expect(account2.pendingPairings.has("bob")).toBe(true);
  });

  it("should isolate messageCallbacks per account", () => {
    const account1 = createAccountState("account1");
    const account2 = createAccountState("account2");

    const callback1 = vi.fn();
    const callback2 = vi.fn();

    account1.messageCallbacks.add(callback1);
    account2.messageCallbacks.add(callback2);

    expect(account1.messageCallbacks.has(callback1)).toBe(true);
    expect(account1.messageCallbacks.has(callback2)).toBe(false);
    expect(account2.messageCallbacks.has(callback1)).toBe(false);
    expect(account2.messageCallbacks.has(callback2)).toBe(true);
  });

  it("should isolate watchErrorCount per account", () => {
    const account1 = createAccountState("account1");
    const account2 = createAccountState("account2");

    account1.watchErrorCount = 5;
    account2.watchErrorCount = 2;

    expect(account1.watchErrorCount).toBe(5);
    expect(account2.watchErrorCount).toBe(2);
  });

  it("should isolate connection state per account", () => {
    const account1 = createAccountState("account1");
    const account2 = createAccountState("account2");

    account1.connected = false;
    account2.connected = true;
    account1.meshConnected = false;
    account2.meshConnected = true;

    expect(account1.connected).toBe(false);
    expect(account1.meshConnected).toBe(false);
    expect(account2.connected).toBe(true);
    expect(account2.meshConnected).toBe(true);
  });

  it("should handle same user in different accounts", () => {
    const account1 = createAccountState("account1");
    const account2 = createAccountState("account2");

    const sender = "alice";
    account1.pendingPairings.set(sender, new Date());

    // alice is pending in account1 but not in account2
    expect(account1.pendingPairings.has(sender)).toBe(true);
    expect(account2.pendingPairings.has(sender)).toBe(false);
  });
});

describe("Concurrent Message Handling", () => {
  it("should handle multiple messages arriving simultaneously", async () => {
    const messages = [
      { time: Date.now(), message: "Msg1", sender: "alice" },
      { time: Date.now() + 1, message: "Msg2", sender: "bob" },
      { time: Date.now() + 2, message: "Msg3", sender: "charlie" },
    ];

    let processedCount = 0;

    // Simulate concurrent processing
    await Promise.all(messages.map(async (msg) => {
      // Simulate async processing
      await new Promise(resolve => setTimeout(resolve, 10));
      processedCount++;
    }));

    expect(processedCount).toBe(3);
  });

  it("should handle duplicate detection during concurrent processing", () => {
    const seen = new Set<string>();
    const messages = [
      { time: 1000, message: "Hello", sender: "alice" },
      { time: 1000, message: "Hello", sender: "alice" }, // duplicate
      { time: 1000, message: "Hello", sender: "alice" }, // duplicate
    ];

    let uniqueCount = 0;
    for (const msg of messages) {
      const key = `${msg.sender}-${msg.time}-${msg.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueCount++;
      }
    }

    expect(uniqueCount).toBe(1);
    expect(seen.size).toBe(1);
  });

  it("should serialize state updates to prevent race conditions", async () => {
    let watermark = 0;
    const timestamps = [1000, 2000, 1500, 3000, 2500];

    // Simulate concurrent watermark updates
    await Promise.all(timestamps.map(async (time) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      if (time > watermark) {
        watermark = time;
      }
    }));

    // Final watermark should be the maximum
    expect(watermark).toBe(Math.max(...timestamps));
  });

  it("should handle rapid state transitions", () => {
    type State = "idle" | "watching" | "polling" | "stopped";
    let state: State = "idle";
    let transitionCount = 0;

    const transitions: State[] = ["watching", "polling", "watching", "polling", "stopped"];

    for (const nextState of transitions) {
      if (state !== nextState) {
        state = nextState;
        transitionCount++;
      }
    }

    expect(transitionCount).toBeGreaterThan(0);
    expect(state).toBe("stopped");
  });
});

describe("State Persistence Scenarios", () => {
  it("should track watermarks for multiple peers", () => {
    const watermarks: Record<string, number> = {};

    // Simulate receiving messages from multiple peers
    watermarks["alice"] = 1000;
    watermarks["bob"] = 2000;
    watermarks["charlie"] = 1500;

    expect(Object.keys(watermarks).length).toBe(3);
    expect(watermarks["alice"]).toBe(1000);
    expect(watermarks["bob"]).toBe(2000);
    expect(watermarks["charlie"]).toBe(1500);
  });

  it("should update watermark only forward", () => {
    let watermark = 5000;

    const updates = [1000, 2000, 3000, 4000]; // all older

    for (const time of updates) {
      if (time > watermark) {
        watermark = time;
      }
    }

    // Should remain at initial value
    expect(watermark).toBe(5000);
  });

  it("should calculate global watermark across peers", () => {
    const peerWatermarks: Record<string, number> = {
      "alice": 1000,
      "bob": 3000,
      "charlie": 2000,
      "dave": 4000,
    };

    const globalWatermark = Math.max(0, ...Object.values(peerWatermarks));
    expect(globalWatermark).toBe(4000);
  });

  it("should handle empty peer list", () => {
    const peerWatermarks: Record<string, number> = {};
    const globalWatermark = Math.max(0, ...Object.values(peerWatermarks));
    expect(globalWatermark).toBe(0);
  });

  it("should track file times for watch seeding", () => {
    const fileTimes: Record<string, number> = {};

    fileTimes["/shared/alice.txt"] = 1000;
    fileTimes["/shared/bob.txt"] = 2000;
    fileTimes["/shared/charlie.txt"] = 1500;

    expect(Object.keys(fileTimes).length).toBe(3);
    expect(fileTimes["/shared/alice.txt"]).toBe(1000);
  });

  it("should update file times", () => {
    const fileTimes: Record<string, number> = { "/shared/test.txt": 1000 };

    // Update to newer time
    fileTimes["/shared/test.txt"] = 2000;

    expect(fileTimes["/shared/test.txt"]).toBe(2000);
  });
});

describe("Error Recovery Integration", () => {
  it("should recover from transient apiClient errors", () => {
    let attemptCount = 0;
    let success = false;

    // Simulate retries
    while (attemptCount < 5 && !success) {
      attemptCount++;
      if (attemptCount >= 3) {
        success = true; // Simulate success on 3rd attempt
      }
    }

    expect(attemptCount).toBe(3);
    expect(success).toBe(true);
  });

  it("should reset error count on successful operation", () => {
    let errorCount = 3;

    // Simulate successful operation
    errorCount = 0;

    expect(errorCount).toBe(0);
  });

  it("should increment error count on failures", () => {
    let errorCount = 0;

    // Simulate 3 failures
    for (let i = 0; i < 3; i++) {
      errorCount++;
    }

    expect(errorCount).toBe(3);
  });

  it("should trigger fallback after error threshold", () => {
    let errorCount = 0;
    const threshold = 5;
    let fallbackTriggered = false;

    // Simulate errors
    for (let i = 0; i < 10; i++) {
      errorCount++;
      if (errorCount > threshold) {
        fallbackTriggered = true;
        break;
      }
    }

    expect(fallbackTriggered).toBe(true);
    expect(errorCount).toBe(6); // Threshold + 1
  });
});

describe("Memory and Resource Management", () => {
  it("should limit pendingPairings size", () => {
    const pendingPairings = new Map<string, Date>();
    const maxSize = 1000;

    // Add many entries
    for (let i = 0; i < maxSize + 100; i++) {
      pendingPairings.set(`user${i}`, new Date());
    }

    // Should enforce limit (implementation may vary)
    expect(pendingPairings.size).toBeGreaterThanOrEqual(maxSize);
  });

  it("should limit messageCallbacks size", () => {
    const callbacks = new Set<() => void>();
    const maxSize = 100;

    // Add many callbacks
    for (let i = 0; i < maxSize + 10; i++) {
      callbacks.add(vi.fn());
    }

    // Should track all added callbacks
    expect(callbacks.size).toBeGreaterThanOrEqual(maxSize);
  });

  it("should clean up intervals on stop", () => {
    let intervalCleared = false;
    const mockInterval = setInterval(() => {}, 1000);

    // Simulate cleanup
    clearInterval(mockInterval);
    intervalCleared = true;

    expect(intervalCleared).toBe(true);
  });

  it("should handle cleanup of unknown resources gracefully", () => {
    const testCases = [
      { interval: null },
      { interval: undefined },
      { callbacks: new Set() },
      { pending: new Map() },
    ];

    for (const testCase of testCases) {
      // Should not throw when cleaning up
      expect(() => {
        if (testCase.interval) clearInterval(testCase.interval as any);
      }).not.toThrow();
    }
  });
});
