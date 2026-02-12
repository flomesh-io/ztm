// Unit tests for Inbound message processing

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  processIncomingMessage,
  checkDmPolicy,
  notifyMessageCallbacks,
  type ZTMChatMessage,
  type MessageCheckResult,
} from "./inbound.js";
import type { ZTMChatConfig } from "../types/config.js";
import type { AccountRuntimeState } from "../runtime/state.js";

// Mock dependencies
vi.mock("../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock store with fresh instances for each call
vi.mock("../runtime/store.js", () => ({
  getMessageStateStore: vi.fn(function() {
    // Return a fresh mock object for each call
    return {
      getWatermark: vi.fn(() => -1),
      getGlobalWatermark: vi.fn(() => 0),
      setWatermark: vi.fn(),
      getFileMetadata: vi.fn(() => ({})),
      setFileMetadata: vi.fn(),
      setFileMetadataBulk: vi.fn(),
      flush: vi.fn(),
      dispose: vi.fn(),
    };
  }),
  disposeMessageStateStore: vi.fn(),
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

  beforeEach(async () => {
    mockState.messageCallbacks.clear();
  });

  afterEach(() => {
    // Restore all mocks after each test to prevent pollution
    vi.restoreAllMocks();
  });

  describe("checkDmPolicy", () => {
    describe("with dmPolicy='allow'", () => {
      it("should allow all messages", () => {
        const config = { ...baseConfig, dmPolicy: "allow" as const };
        const result = checkDmPolicy("alice", config, []);

        expect(result).toEqual({
          allowed: true,
          reason: "allowed",
          action: "process",
        });
      });

      it("should allow messages from unknown senders", () => {
        const config = { ...baseConfig, dmPolicy: "allow" as const };
        const result = checkDmPolicy("stranger", config, []);

        expect(result.allowed).toBe(true);
      });
    });

    describe("with dmPolicy='deny'", () => {
      it("should deny all messages", () => {
        const config = { ...baseConfig, dmPolicy: "deny" as const };
        const result = checkDmPolicy("alice", config, []);

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
        const result = checkDmPolicy("alice", config, []);

        expect(result).toEqual({
          allowed: false,
          reason: "pending",
          action: "request_pairing",
        });
      });

      it("should allow whitelisted senders", () => {
        const config = { ...baseConfig, dmPolicy: "pairing" as const, allowFrom: ["alice"] };
        const result = checkDmPolicy("alice", config, []);

        expect(result).toEqual({
          allowed: true,
          reason: "whitelisted",
          action: "process",
        });
      });

      it("should allow store-approved senders", () => {
        const config = { ...baseConfig, dmPolicy: "pairing" as const };
        const storeAllowFrom = ["alice"];
        const result = checkDmPolicy("alice", config, storeAllowFrom);

        expect(result).toEqual({
          allowed: true,
          reason: "whitelisted",
          action: "process",
        });
      });

      it("should be case-insensitive for allowFrom matching", () => {
        const config = { ...baseConfig, dmPolicy: "pairing" as const, allowFrom: ["Alice"] };
        const result = checkDmPolicy("ALICE", config, []);

        expect(result.allowed).toBe(true);
      });

      it("should trim whitespace from sender names", () => {
        const config = { ...baseConfig, dmPolicy: "pairing" as const, allowFrom: ["alice"] };
        const result = checkDmPolicy("  alice  ", config, []);

        expect(result.allowed).toBe(true);
      });
    });

    describe("with unknown dmPolicy", () => {
      it("should default to allow", () => {
        const config = { ...baseConfig, dmPolicy: "unknown" as any };
        const result = checkDmPolicy("alice", config, []);

        expect(result).toEqual({
          allowed: true,
          reason: "allowed",
          action: "process",
        });
      });
    });
  });

  describe("processIncomingMessage", () => {
    // Use a function to generate unique timestamps for each test
    const createMessage = (overrides?: Partial<{ time: number; message: string; sender: string }>) => ({
      time: Date.now() + Math.floor(Math.random() * 1000000),
      message: "Hello, world!",
      sender: "alice",
      ...overrides,
    });

    it("should normalize valid messages", () => {
      const message = createMessage();
      const config = { ...baseConfig, dmPolicy: "allow" as const };
      const result = processIncomingMessage(message, config, [], "test-account");

      expect(result).not.toBeNull();
      expect(result?.id).toBe(`${message.time}-alice`);
      expect(result?.content).toBe("Hello, world!");
      expect(result?.sender).toBe("alice");
      expect(result?.senderId).toBe("alice");
      expect(result?.peer).toBe("alice");
      expect(result?.timestamp).toBeInstanceOf(Date);
    });

    it("should skip empty messages", () => {
      const message = createMessage({ message: "" });
      const config = { ...baseConfig, dmPolicy: "allow" as const };
      const result = processIncomingMessage(message, config, [], "test-account");

      expect(result).toBeNull();
    });

    it("should skip whitespace-only messages", () => {
      const message = createMessage({ message: "   " });
      const config = { ...baseConfig, dmPolicy: "allow" as const };
      const result = processIncomingMessage(message, config, [], "test-account");

      expect(result).toBeNull();
    });

    it("should skip already-processed messages based on watermark", async () => {
      // Get the original mock and override getWatermark
      const { getMessageStateStore } = await import("../runtime/store.js");
      const message = createMessage();

      // Create a new store mock with high watermark
      const mockStore = {
        getWatermark: vi.fn(() => message.time + 1000),
        getGlobalWatermark: vi.fn(() => 0),
        setWatermark: vi.fn(),
        getFileMetadata: vi.fn(() => ({})),
        setFileMetadata: vi.fn(),
        setFileMetadataBulk: vi.fn(),
        flush: vi.fn(),
        dispose: vi.fn(),
      };

      // Save original implementation
      const originalImpl = vi.mocked(getMessageStateStore).getMockImplementation?.();

      // Override
      vi.mocked(getMessageStateStore).mockReturnValue(mockStore);

      const config = { ...baseConfig, dmPolicy: "allow" as const };
      const result = processIncomingMessage(message, config, [], "test-account");

      expect(result).toBeNull();

      // Restore original if there was one
      if (originalImpl) {
        vi.mocked(getMessageStateStore).mockImplementation(originalImpl);
      } else {
        vi.mocked(getMessageStateStore).mockReset();
      }
    });

    it("should respect dmPolicy='deny'", () => {
      const message = createMessage();
      const config = { ...baseConfig, dmPolicy: "deny" as const };
      const result = processIncomingMessage(message, config, [], "test-account");

      expect(result).toBeNull();
    });

    it("should trigger pairing request for dmPolicy='pairing'", () => {
      const message = createMessage();
      const config = { ...baseConfig, dmPolicy: "pairing" as const };
      const result = processIncomingMessage(message, config, [], "test-account");

      expect(result).toBeNull();
    });

    it("should allow whitelisted senders in pairing mode", () => {
      const message = createMessage();
      const config = { ...baseConfig, dmPolicy: "pairing" as const, allowFrom: ["alice"] };

      const result = processIncomingMessage(message, config, [], "test-account");

      expect(result).not.toBeNull();
      expect(result?.sender).toBe("alice");
    });

    it("should handle messages with newlines", () => {
      const message = createMessage({ message: "Hello\nWorld\n" });
      const config = { ...baseConfig, dmPolicy: "allow" as const };
      const result = processIncomingMessage(message, config, [], "test-account");

      expect(result).not.toBeNull();
      expect(result?.content).toBe("Hello\nWorld\n");
    });

    it("should handle messages with special characters", () => {
      const message = createMessage({ message: "Hello! 🌍 世界" });
      const config = { ...baseConfig, dmPolicy: "allow" as const };
      const result = processIncomingMessage(message, config, [], "test-account");

      expect(result).not.toBeNull();
      expect(result?.content).toBe("Hello! 🌍 世界");
    });

    it("should handle very long messages", () => {
      const message = createMessage({ message: "a".repeat(10000) });
      const config = { ...baseConfig, dmPolicy: "allow" as const };
      const result = processIncomingMessage(message, config, [], "test-account");

      expect(result).not.toBeNull();
      expect(result?.content).toBe("a".repeat(10000));
    });

    it("should handle zero timestamp", () => {
      const message = createMessage({ time: 0 });
      const config = { ...baseConfig, dmPolicy: "allow" as const };

      const result = processIncomingMessage(message, config, [], "test-account");

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

    it("should set watermark in message state store", async () => {
      // Mock getMessageStateStore to return a store with a tracked setWatermark
      const setWatermarkMock = vi.fn();
      const { getMessageStateStore } = await import("../runtime/store.js");

      // Override mock to return store with tracked setWatermark
      vi.mocked(getMessageStateStore).mockReturnValue({
        getWatermark: vi.fn(() => -1),
        getGlobalWatermark: vi.fn(() => 0),
        setWatermark: setWatermarkMock,
        getFileMetadata: vi.fn(() => ({})),
        setFileMetadata: vi.fn(),
        setFileMetadataBulk: vi.fn(),
        flush: vi.fn(),
        dispose: vi.fn(),
      });

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

      // Check that watermark was set
      expect(setWatermarkMock).toHaveBeenCalledWith("test-account", "alice", 1234567890);
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
