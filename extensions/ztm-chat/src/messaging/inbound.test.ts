// Unit tests for Inbound message processing

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  processIncomingMessage,
  checkDmPolicy,
  notifyMessageCallbacks,
  type ZTMChatMessage,
  type MessageCheckResult,
} from "./inbound.js";
import type { ZTMChatConfig } from "../config.js";
import type { AccountRuntimeState } from "../runtime/state.js";

// Mock dependencies
vi.mock("../logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("./dedup.js", () => ({
  messageDeduplicator: {
    isDuplicate: vi.fn(() => false),
  },
}));

// Mock store with function calls captured
let mockGetWatermarkCalls: any[] = [];
let mockSetWatermarkCalls: any[] = [];

vi.mock("../runtime/store.js", () => ({
  messageStateStore: {
    getWatermark: (...args: any[]) => {
      mockGetWatermarkCalls.push(args);
      return -1; // Default to -1 to allow messages through
    },
    setWatermark: (...args: any[]) => {
      mockSetWatermarkCalls.push(args);
    },
  },
}));

describe("Inbound message processing", () => {
  const baseConfig: ZTMChatConfig = {
    agentUrl: "https://example.com:7777",
    permitUrl: "https://example.com/permit",
    meshName: "test-mesh",
    username: "test-bot",
    enableGroups: false,
    autoReply: true,
    messagePath: "/shared",
    allowFrom: undefined,
    dmPolicy: "pairing",
  };

  const mockState: AccountRuntimeState = {
    accountId: "test-account",
    config: baseConfig,
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockState.pendingPairings.clear();
    mockState.messageCallbacks.clear();
    mockGetWatermarkCalls = [];
    mockSetWatermarkCalls = [];
  });

  describe("checkDmPolicy", () => {
    describe("with dmPolicy='allow'", () => {
      it("should allow all messages", () => {
        const config = { ...baseConfig, dmPolicy: "allow" as const };
        const result = checkDmPolicy("alice", config, new Map(), []);

        expect(result).toEqual({
          allowed: true,
          reason: "allowed",
          action: "process",
        });
      });

      it("should allow messages from unknown senders", () => {
        const config = { ...baseConfig, dmPolicy: "allow" as const };
        const result = checkDmPolicy("stranger", config, new Map(), []);

        expect(result.allowed).toBe(true);
      });
    });

    describe("with dmPolicy='deny'", () => {
      it("should deny all messages", () => {
        const config = { ...baseConfig, dmPolicy: "deny" as const };
        const result = checkDmPolicy("alice", config, new Map(), []);

        expect(result).toEqual({
          allowed: false,
          reason: "denied",
          action: "ignore",
        });
      });
    });

    describe("with dmPolicy='pairing'", () => {
      it("should request pairing for new senders", () => {
        const config = { ...baseConfig, dmPolicy: "pairing" as const };
        const result = checkDmPolicy("alice", config, new Map(), []);

        expect(result).toEqual({
          allowed: false,
          reason: "pending",
          action: "request_pairing",
        });
      });

      it("should ignore already pending senders", () => {
        const config = { ...baseConfig, dmPolicy: "pairing" as const };
        const pendingPairings = new Map([["alice", new Date()]]);
        const result = checkDmPolicy("alice", config, pendingPairings, []);

        expect(result).toEqual({
          allowed: false,
          reason: "pending",
          action: "ignore",
        });
      });

      it("should allow whitelisted senders", () => {
        const config = { ...baseConfig, dmPolicy: "pairing" as const, allowFrom: ["alice"] };
        const result = checkDmPolicy("alice", config, new Map(), []);

        expect(result).toEqual({
          allowed: true,
          reason: "whitelisted",
          action: "process",
        });
      });

      it("should allow store-approved senders", () => {
        const config = { ...baseConfig, dmPolicy: "pairing" as const };
        const storeAllowFrom = ["alice"];
        const result = checkDmPolicy("alice", config, new Map(), storeAllowFrom);

        expect(result).toEqual({
          allowed: true,
          reason: "whitelisted",
          action: "process",
        });
      });

      it("should be case-insensitive for allowFrom matching", () => {
        const config = { ...baseConfig, dmPolicy: "pairing" as const, allowFrom: ["Alice"] };
        const result = checkDmPolicy("ALICE", config, new Map(), []);

        expect(result.allowed).toBe(true);
      });

      it("should trim whitespace from sender names", () => {
        const config = { ...baseConfig, dmPolicy: "pairing" as const, allowFrom: ["alice"] };
        const result = checkDmPolicy("  alice  ", config, new Map(), []);

        expect(result.allowed).toBe(true);
      });
    });

    describe("with unknown dmPolicy", () => {
      it("should default to allow", () => {
        const config = { ...baseConfig, dmPolicy: "unknown" as any };
        const result = checkDmPolicy("alice", config, new Map(), []);

        expect(result).toEqual({
          allowed: true,
          reason: "allowed",
          action: "process",
        });
      });
    });
  });

  describe("processIncomingMessage", () => {
    const baseMessage = {
      time: Date.now(),
      message: "Hello, world!",
      sender: "alice",
    };

    it("should normalize valid messages", () => {
      const config = { ...baseConfig, dmPolicy: "allow" as const };
      const result = processIncomingMessage(baseMessage, config, new Map(), [], "test-account");

      expect(result).not.toBeNull();
      expect(result?.id).toBe(`${baseMessage.time}-alice`);
      expect(result?.content).toBe("Hello, world!");
      expect(result?.sender).toBe("alice");
      expect(result?.senderId).toBe("alice");
      expect(result?.peer).toBe("alice");
      expect(result?.timestamp).toBeInstanceOf(Date);
    });

    it("should skip empty messages", () => {
      const config = { ...baseConfig, dmPolicy: "allow" as const };
      const result = processIncomingMessage(
        { ...baseMessage, message: "" },
        config,
        new Map(),
        [],
        "test-account"
      );

      expect(result).toBeNull();
    });

    it("should skip whitespace-only messages", () => {
      const config = { ...baseConfig, dmPolicy: "allow" as const };
      const result = processIncomingMessage(
        { ...baseMessage, message: "   " },
        config,
        new Map(),
        [],
        "test-account"
      );

      expect(result).toBeNull();
    });

    it("should skip already-processed messages based on watermark", async () => {
      // Override the mock to return a high watermark
      const { messageStateStore } = await import("../runtime/store.js");
      const originalGetWatermark = messageStateStore.getWatermark.bind(messageStateStore);
      messageStateStore.getWatermark = () => Date.now() + 1000;

      const config = { ...baseConfig, dmPolicy: "allow" as const };
      const result = processIncomingMessage(baseMessage, config, new Map(), [], "test-account");

      expect(result).toBeNull();

      // Restore original
      messageStateStore.getWatermark = originalGetWatermark;
    });

    it("should skip duplicate messages", async () => {
      const { messageDeduplicator } = await import("./dedup.js");
      const originalIsDuplicate = messageDeduplicator.isDuplicate.bind(messageDeduplicator);
      messageDeduplicator.isDuplicate = () => true;

      const config = { ...baseConfig, dmPolicy: "allow" as const };
      const result = processIncomingMessage(baseMessage, config, new Map(), [], "test-account");

      expect(result).toBeNull();

      // Restore original
      messageDeduplicator.isDuplicate = originalIsDuplicate;
    });

    it("should respect dmPolicy='deny'", () => {
      const config = { ...baseConfig, dmPolicy: "deny" as const };
      const result = processIncomingMessage(baseMessage, config, new Map(), [], "test-account");

      expect(result).toBeNull();
    });

    it("should trigger pairing request for dmPolicy='pairing'", () => {
      const config = { ...baseConfig, dmPolicy: "pairing" as const };
      const result = processIncomingMessage(baseMessage, config, new Map(), [], "test-account");

      expect(result).toBeNull();
    });

    it("should allow whitelisted senders in pairing mode", () => {
      const config = { ...baseConfig, dmPolicy: "pairing" as const, allowFrom: ["alice"] };
      const result = processIncomingMessage(baseMessage, config, new Map(), [], "test-account");

      expect(result).not.toBeNull();
      expect(result?.sender).toBe("alice");
    });

    it("should handle messages with newlines", () => {
      const config = { ...baseConfig, dmPolicy: "allow" as const };
      const result = processIncomingMessage(
        { ...baseMessage, message: "Hello\nWorld\n" },
        config,
        new Map(),
        [],
        "test-account"
      );

      expect(result).not.toBeNull();
      expect(result?.content).toBe("Hello\nWorld\n");
    });

    it("should handle messages with special characters", () => {
      const config = { ...baseConfig, dmPolicy: "allow" as const };
      const result = processIncomingMessage(
        { ...baseMessage, message: "Hello! 🌍 世界" },
        config,
        new Map(),
        [],
        "test-account"
      );

      expect(result).not.toBeNull();
      expect(result?.content).toBe("Hello! 🌍 世界");
    });

    it("should handle very long messages", () => {
      const config = { ...baseConfig, dmPolicy: "allow" as const };
      const longMessage = "a".repeat(10000);
      const result = processIncomingMessage(
        { ...baseMessage, message: longMessage },
        config,
        new Map(),
        [],
        "test-account"
      );

      expect(result).not.toBeNull();
      expect(result?.content).toBe(longMessage);
    });

    it("should handle zero timestamp", () => {
      const config = { ...baseConfig, dmPolicy: "allow" as const };
      const result = processIncomingMessage(
        { ...baseMessage, time: 0 },
        config,
        new Map(),
        [],
        "test-account"
      );

      expect(result).not.toBeNull();
    });
  });

  describe("notifyMessageCallbacks", () => {
    it("should call all registered callbacks", () => {
      const mockCallback1 = vi.fn();
      const mockCallback2 = vi.fn();
      mockState.messageCallbacks.add(mockCallback1);
      mockState.messageCallbacks.add(mockCallback2);

      const message: ZTMChatMessage = {
        id: "test-id",
        content: "test message",
        sender: "alice",
        senderId: "alice",
        timestamp: new Date(),
        peer: "alice",
      };

      notifyMessageCallbacks(mockState, message);

      expect(mockCallback1).toHaveBeenCalledWith(message);
      expect(mockCallback2).toHaveBeenCalledWith(message);
    });

    it("should update lastInboundAt timestamp", () => {
      const before = new Date();
      mockState.messageCallbacks.add(vi.fn());

      const message: ZTMChatMessage = {
        id: "test-id",
        content: "test message",
        sender: "alice",
        senderId: "alice",
        timestamp: new Date(),
        peer: "alice",
      };

      notifyMessageCallbacks(mockState, message);

      expect(mockState.lastInboundAt).toBeDefined();
      expect(mockState.lastInboundAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it("should set watermark in message state store", () => {
      mockState.messageCallbacks.add(vi.fn());

      const message: ZTMChatMessage = {
        id: "test-id",
        content: "test message",
        sender: "alice",
        senderId: "alice",
        timestamp: new Date(1234567890),
        peer: "alice",
      };

      notifyMessageCallbacks(mockState, message);

      // Check that watermark was set using call tracking
      expect(mockSetWatermarkCalls.length).toBeGreaterThan(0);
      const lastCall = mockSetWatermarkCalls[mockSetWatermarkCalls.length - 1];
      expect(lastCall).toEqual(["test-account", "alice", 1234567890]);
    });

    it("should handle callback errors gracefully", () => {
      const errorCallback = vi.fn(() => {
        throw new Error("Callback error");
      });
      const successCallback = vi.fn();

      mockState.messageCallbacks.add(errorCallback);
      mockState.messageCallbacks.add(successCallback);

      const message: ZTMChatMessage = {
        id: "test-id",
        content: "test message",
        sender: "alice",
        senderId: "alice",
        timestamp: new Date(),
        peer: "alice",
      };

      // Should not throw, should still call other callbacks
      expect(() => notifyMessageCallbacks(mockState, message)).not.toThrow();
      expect(errorCallback).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalled();
    });

    it("should handle empty callback set", () => {
      const message: ZTMChatMessage = {
        id: "test-id",
        content: "test message",
        sender: "alice",
        senderId: "alice",
        timestamp: new Date(),
        peer: "alice",
      };

      expect(() => notifyMessageCallbacks(mockState, message)).not.toThrow();
    });
  });

  describe("ZTMChatMessage type", () => {
    it("should have all required fields", () => {
      const message: ZTMChatMessage = {
        id: "test-id",
        content: "test",
        sender: "alice",
        senderId: "alice",
        timestamp: new Date(),
        peer: "alice",
        thread: "thread-123",
      };

      expect(message.id).toBe("test-id");
      expect(message.content).toBe("test");
      expect(message.sender).toBe("alice");
      expect(message.senderId).toBe("alice");
      expect(message.peer).toBe("alice");
      expect(message.thread).toBe("thread-123");
    });

    it("should have optional thread field", () => {
      const message: ZTMChatMessage = {
        id: "test-id",
        content: "test",
        sender: "alice",
        senderId: "alice",
        timestamp: new Date(),
        peer: "alice",
      };

      expect(message.thread).toBeUndefined();
    });
  });

  describe("MessageCheckResult type", () => {
    it("should represent allowed messages", () => {
      const result: MessageCheckResult = {
        allowed: true,
        reason: "allowed",
        action: "process",
      };

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("allowed");
      expect(result.action).toBe("process");
    });

    it("should represent denied messages", () => {
      const result: MessageCheckResult = {
        allowed: false,
        reason: "denied",
        action: "ignore",
      };

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("denied");
      expect(result.action).toBe("ignore");
    });

    it("should represent pending pairing requests", () => {
      const result: MessageCheckResult = {
        allowed: false,
        reason: "pending",
        action: "request_pairing",
      };

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("pending");
      expect(result.action).toBe("request_pairing");
    });
  });
});
