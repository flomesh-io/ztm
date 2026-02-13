// Integration tests for Group Chat functionality
// Tests for group message watching and processing

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock logger before any imports
vi.mock("../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  defaultLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
import type { ZTMChatConfig } from "../types/config.js";
import type { ZTMMessage } from "../types/api.js";
import {
  createTestClient,
  createMockFetch,
  type MockLogger,
} from "../api/test-utils.js";

describe("Group Chat API Tests", () => {
  const testConfig: ZTMChatConfig = {
    agentUrl: "https://agent.example.com:7777",
    meshName: "test-mesh",
    permitUrl: "https://portal.example.com:7779/permit",
    username: "test-bot",
    enableGroups: true,
    autoReply: true,
    messagePath: "/shared",
    dmPolicy: "pairing",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getGroupMessages", () => {
    it("should fetch messages from a group successfully", async () => {
      const now = Date.now();
      const { fetch, mockResponse } = createMockFetch();
      mockResponse([
        { time: now - 2000, message: "First message", sender: "alice" },
        { time: now - 1000, message: "Second message", sender: "bob" },
        { time: now, message: "Latest message", sender: "charlie" },
      ]);

      const client = createTestClient(testConfig, { fetch });
      const result = await client.getGroupMessages("alice", "mygroup");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value?.length).toBe(3);
        expect(result.value?.[0]?.message).toBe("First message");
        expect(result.value?.[2]?.message).toBe("Latest message");
      }
    });

    it("should handle API error when getting group messages", async () => {
      const { fetch, mockError } = createMockFetch();
      mockError(new Error("Group not found"));

      const client = createTestClient(testConfig, { fetch });
      const result = await client.getGroupMessages("alice", "nonexistent");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error?.message).toContain("Group not found");
      }
    });

    it("should normalize message with {text: ...} format", async () => {
      const now = Date.now();
      const { fetch, mockResponse } = createMockFetch();
      mockResponse([
        { time: now, message: { text: "Structured message" }, sender: "bob" },
      ]);

      const client = createTestClient(testConfig, { fetch });
      const result = await client.getGroupMessages("alice", "mygroup");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value?.[0]?.message).toBe("Structured message");
      }
    });

    it("should normalize null message to empty string", async () => {
      const now = Date.now();
      const { fetch, mockResponse } = createMockFetch();
      mockResponse([
        { time: now, message: null, sender: "bob" },
      ]);

      const client = createTestClient(testConfig, { fetch });
      const result = await client.getGroupMessages("alice", "mygroup");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value?.[0]?.message).toBe("");
      }
    });

    it("should encode creator and group names in URL", async () => {
      const { fetch, mockResponse, calls } = createMockFetch();
      mockResponse([]);

      const client = createTestClient(testConfig, { fetch });
      await client.getGroupMessages("Alice Smith", "My Group!");

      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0].url).toContain(encodeURIComponent("Alice Smith"));
      expect(calls[0].url).toContain(encodeURIComponent("My Group!"));
    });
  });

  describe("sendGroupMessage", () => {
    it("should send message to group successfully", async () => {
      const { fetch, mockResponse } = createMockFetch();
      mockResponse({ success: true });

      const client = createTestClient(testConfig, { fetch });

      const message: ZTMMessage = {
        time: Date.now(),
        message: "Hello group!",
        sender: "test-bot",
      };

      const result = await client.sendGroupMessage("alice", "mygroup", message);

      expect(result.ok).toBe(true);
    });

    it("should handle send error", async () => {
      const { fetch, mockError } = createMockFetch();
      mockError(new Error("Network error"));

      const client = createTestClient(testConfig, { fetch });

      const message: ZTMMessage = {
        time: Date.now(),
        message: "Hello group!",
        sender: "test-bot",
      };

      const result = await client.sendGroupMessage("alice", "mygroup", message);

      expect(result.ok).toBe(false);
    });

    it("should encode creator and group in URL", async () => {
      const { fetch, mockResponse, calls } = createMockFetch();
      mockResponse({ success: true });

      const client = createTestClient(testConfig, { fetch });

      const message: ZTMMessage = {
        time: Date.now(),
        message: "Test",
        sender: "test-bot",
      };

      await client.sendGroupMessage("Alice Smith", "My Group!", message);

      expect(calls.length).toBe(1);
      expect(calls[0].url).toContain(encodeURIComponent("Alice Smith"));
      expect(calls[0].url).toContain(encodeURIComponent("My Group!"));
    });
  });

});
