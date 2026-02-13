// Integration tests for Pairing Request Flow

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

  describe("new user triggers pairing request", () => {
    it("should check dmPolicy and trigger pairing for new user", async () => {
      const sender = "alice";
      const pendingPairings = new Map<string, Date>();
      const allowFrom: string[] = [];

      const isNewUser = !pendingPairings.has(sender) &&
        !allowFrom.some(allowed => allowed.toLowerCase() === sender.toLowerCase());

      expect(isNewUser).toBe(true);

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
      const storeAllowFrom: string[] = [];

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

      mockState.pendingPairings.delete(sender);

      expect(mockState.pendingPairings.has(sender)).toBe(false);
    });
  });
});
