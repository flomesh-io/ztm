// Unit tests for Outbound message functions

import { describe, it, expect, beforeEach, vi } from "vitest";
import { sendZTMMessage, generateMessageId } from "./outbound.js";
import { testConfig, testAccountId } from "../test-utils/fixtures.js";
import { mockSuccess } from "../test-utils/mocks.js";
import { success, isSuccess } from "../types/common.js";
import { ZtmSendError } from "../types/errors.js";
import type { AccountRuntimeState } from "../types/runtime.js";
import type { ZTMChatMessage } from "../types/messaging.js";
import type { ZTMApiClient } from "../types/api.js";

// Create a fresh state for each test
function createMockState(): AccountRuntimeState {
  return {
    accountId: testAccountId,
    config: testConfig,
    apiClient: null,
    connected: true,
    meshConnected: true,
    lastError: null,
    lastStartAt: null,
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

// Helper to create a failure Result for ZtmSendError
function createSendFailure(peer: string, message: string) {
  return {
    ok: false,
    error: new ZtmSendError({
      peer,
      messageTime: Date.now(),
      cause: new Error(message),
    }),
  };
}

describe("Outbound message functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mock("../utils/logger.js", () => ({
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    }));
  });

  describe("generateMessageId", () => {
    it("should generate unique IDs", () => {
      const id1 = generateMessageId();
      const id2 = generateMessageId();

      expect(id1).not.toBe(id2);
    });

    it("should start with 'ztm-' prefix", () => {
      const id = generateMessageId();
      expect(id).toMatch(/^ztm-/);
    });

    it("should contain timestamp", () => {
      const before = Date.now();
      const id = generateMessageId();
      const after = Date.now();

      const match = id.match(/^ztm-(\d+)-/);
      expect(match).not.toBeNull();

      const timestamp = parseInt(match![1], 10);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it("should use default format 'ztm-{timestamp}-{random}'", () => {
      const id = generateMessageId();
      expect(id).toMatch(/^ztm-\d+-[a-z0-9]{7}$/);
    });

    it("should be URL-safe", () => {
      const id = generateMessageId();
      expect(id).toMatch(/^[\w-]+$/);
    });
  });

  describe("sendZTMMessage", () => {
    it("should send message successfully", async () => {
      const state = createMockState();
      const mockSendPeerMessage = mockSuccess(true);
      state.apiClient = { sendPeerMessage: mockSendPeerMessage } as unknown as typeof state.apiClient;

      const result = await sendZTMMessage(state, "alice", "Hello, world!");

      expect(isSuccess(result)).toBe(true);
      expect(mockSendPeerMessage).toHaveBeenCalledWith("alice", {
        time: expect.any(Number),
        message: "Hello, world!",
        sender: "test-bot",
      });
      expect(state.lastOutboundAt).toBeInstanceOf(Date);
      expect(state.lastError).toBeNull();
    });

    it("should return failure when apiClient is null", async () => {
      const state = createMockState();
      state.apiClient = null;

      const result = await sendZTMMessage(state, "alice", "Hello!");

      expect(isSuccess(result)).toBe(false);
      expect(state.lastError).toContain("Runtime not initialized");
    });

    it("should return failure when config is null", async () => {
      const state = createMockState();
      state.config = null as unknown as typeof state.config;

      const result = await sendZTMMessage(state, "alice", "Hello!");

      expect(isSuccess(result)).toBe(false);
      expect(state.lastError).toContain("Runtime not initialized");
    });

    it("should handle send failure", async () => {
      const state = createMockState();
      const mockSendPeerMessage = vi.fn().mockResolvedValue(createSendFailure("alice", "Message not delivered"));
      state.apiClient = { sendPeerMessage: mockSendPeerMessage } as unknown as ZTMApiClient;

      const result = await sendZTMMessage(state, "alice", "Hello!");

      // API call succeeded but operation failed - returns failure Result
      expect(isSuccess(result)).toBe(false);
      expect(state.lastOutboundAt).toBeNull();
    });

    it("should handle send error", async () => {
      const state = createMockState();
      const mockSendPeerMessage = vi.fn().mockResolvedValue(createSendFailure("alice", "Network error"));
      state.apiClient = { sendPeerMessage: mockSendPeerMessage } as unknown as ZTMApiClient;

      const result = await sendZTMMessage(state, "alice", "Hello!");

      expect(isSuccess(result)).toBe(false);
      expect(state.lastError).toContain("Network error");
    });

    it("should handle empty message", async () => {
      const state = createMockState();
      const mockSendPeerMessage = mockSuccess(true);
      state.apiClient = { sendPeerMessage: mockSendPeerMessage } as unknown as typeof state.apiClient;

      const result = await sendZTMMessage(state, "alice", "");

      expect(isSuccess(result)).toBe(true);
      expect(mockSendPeerMessage).toHaveBeenCalledWith("alice", {
        time: expect.any(Number),
        message: "",
        sender: "test-bot",
      });
    });

    it("should handle special characters", async () => {
      const state = createMockState();
      const specialMessage = "Hello! 🌍 世界\nNew line\tTab";
      const mockSendPeerMessage = mockSuccess(true);
      state.apiClient = { sendPeerMessage: mockSendPeerMessage } as unknown as typeof state.apiClient;

      const result = await sendZTMMessage(state, "alice", specialMessage);

      expect(isSuccess(result)).toBe(true);
    });
  });
});
