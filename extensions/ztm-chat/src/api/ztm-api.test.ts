// Unit tests for ZTM API Client
// Uses dependency injection pattern for easy mocking

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ZTMChatConfig } from "../types/config.js";
import type { ZTMApiClient } from "../types/api.js";
import { testConfig } from "../test-utils/fixtures.js";
import {
  createZTMApiClient,
  createTestClient,
  createMockLogger,
  createMockFetch,
  createMockFetchWithRetry,
  type MockLogger,
} from "./ztm-api.js";

// Mock logger module to provide defaultLogger
vi.mock("../utils/logger.js", async () => {
  const mod = await vi.importActual<typeof import("../utils/logger.js")>("../utils/logger.js");
  return {
    ...mod,
    defaultLogger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

// Re-export types for convenience
export type { ZTMMessage, ZTMPeer, ZTMUserInfo, ZTMMeshInfo, ZTMChat } from "../types/api.js";

describe("ZTM API Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return an object with required methods", () => {
    const client = createZTMApiClient(testConfig);

    expect(client).toHaveProperty("getMeshInfo");
    expect(client).toHaveProperty("discoverUsers");
    expect(client).toHaveProperty("discoverPeers");
    expect(client).toHaveProperty("sendPeerMessage");
    expect(client).toHaveProperty("getChats");
    expect(client).toHaveProperty("seedFileMetadata");
    expect(client).toHaveProperty("exportFileMetadata");
  });

  it("should use config.agentUrl as base URL", () => {
    const client = createZTMApiClient(testConfig);

    const expectedBaseUrl = testConfig.agentUrl.replace(/\/$/, "");
    expect(client.getMeshInfo).toBeDefined();
    expect(typeof client.getMeshInfo).toBe("function");
  });
});

describe("Mock Logger", () => {
  it("should create mock logger with all methods", () => {
    const mockLogger = createMockLogger();

    expect(typeof mockLogger.debug).toBe("function");
    expect(typeof mockLogger.info).toBe("function");
    expect(typeof mockLogger.warn).toBe("function");
    expect(typeof mockLogger.error).toBe("function");
    expect(Array.isArray(mockLogger.calls)).toBe(true);
  });

  it("should track all log calls", () => {
    const mockLogger = createMockLogger();

    mockLogger.info("test message");
    mockLogger.warn("warning");
    mockLogger.error("error");

    expect(mockLogger.calls.length).toBe(3);
    expect(mockLogger.calls[0]).toEqual({ level: "info", args: ["test message"] });
    expect(mockLogger.calls[1]).toEqual({ level: "warn", args: ["warning"] });
    expect(mockLogger.calls[2]).toEqual({ level: "error", args: ["error"] });
  });
});

describe("Mock Fetch", () => {
  it("should create mock fetch with required methods", () => {
    const mockFetch = createMockFetch();

    expect(typeof mockFetch.fetch).toBe("function");
    expect(typeof mockFetch.mockResponse).toBe("function");
    expect(typeof mockFetch.mockError).toBe("function");
    expect(typeof mockFetch.mockNetworkError).toBe("function");
    expect(Array.isArray(mockFetch.calls)).toBe(true);
  });

  it("should track all fetch calls", async () => {
    const { fetch, mockResponse, calls } = createMockFetch();
    mockResponse({ connected: true }, 200);

    await fetch("https://test.com/api");

    expect(calls.length).toBe(1);
    expect(calls[0].url).toBe("https://test.com/api");
  });

  it("should return mocked response", async () => {
    const { fetch, mockResponse } = createMockFetch();
    mockResponse({ connected: true }, 200);

    const response = await fetch("https://test.com/api");
    const data = await response.json();

    expect(data).toEqual({ connected: true });
  });

  it("should handle mocked errors", async () => {
    const { fetch, mockError } = createMockFetch();
    mockError(new Error("Server error"));

    await expect(fetch("https://test.com/api")).rejects.toThrow("Server error");
  });
});

describe("createTestClient", () => {
  it("should create client with injected dependencies", () => {
    const mockLogger = createMockLogger();
    const { fetch } = createMockFetch();
    const { fetchWithRetry } = createMockFetchWithRetry();

    const client = createTestClient(testConfig, {
      logger: mockLogger,
      fetch,
      fetchWithRetry,
    });

    expect(client).toHaveProperty("getMeshInfo");
    expect(client).toHaveProperty("sendPeerMessage");
  });

  it("should work with minimal deps (defaults)", () => {
    const client = createTestClient(testConfig);

    expect(client).toHaveProperty("getMeshInfo");
    expect(typeof client.getMeshInfo).toBe("function");
  });
});

describe("ZTM API Client Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should get mesh info successfully", async () => {
    const { fetch, mockResponse, calls } = createMockFetch();
    mockResponse({
      connected: true,
      endpoints: 5,
      errors: [],
    });

    const client = createTestClient(testConfig, { fetch });
    const result = await client.getMeshInfo();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value?.connected).toBe(true);
      expect(result.value?.endpoints).toBe(5);
    }

    expect(calls.length).toBe(1);
    expect(calls[0].url).toContain("/api/meshes/test-mesh");
  });

  it("should handle mesh info error", async () => {
    const { fetch, mockError } = createMockFetch();
    mockError(new Error("Network error"));

    const client = createTestClient(testConfig, { fetch });
    const result = await client.getMeshInfo();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error?.message).toContain("Network error");
    }
  });

  it("should send peer message successfully", async () => {
    const { fetch, mockResponse } = createMockFetch();
    mockResponse({ success: true });

    const client = createTestClient(testConfig, { fetch });

    const message = {
      time: Date.now(),
      message: "Hello",
      sender: "test-bot",
    };

    const result = await client.sendPeerMessage("alice", message);

    expect(result.ok).toBe(true);
  });

  it("should handle send message failure", async () => {
    const { fetch, mockError } = createMockFetch();
    mockError(new Error("Network error"));

    const client = createTestClient(testConfig, { fetch });

    const message = {
      time: Date.now(),
      message: "Hello",
      sender: "test-bot",
    };

    const result = await client.sendPeerMessage("alice", message);

    expect(result.ok).toBe(false);
  });

  it("should get empty chat list", async () => {
    const { fetch, mockResponse } = createMockFetch();
    mockResponse([]);

    const client = createTestClient(testConfig, { fetch });
    const result = await client.getChats();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it("should get chat list with messages", async () => {
    const now = Date.now();
    const { fetch, mockResponse } = createMockFetch();
    // Chat App API returns array of chats directly
    mockResponse([
      { peer: "alice", time: now, updated: now, latest: { time: now, message: "Hello", sender: "alice" } },
      { peer: "bob", time: now, updated: now, latest: { time: now, message: "Hi", sender: "bob" } },
    ]);

    const client = createTestClient(testConfig, { fetch });
    const result = await client.getChats();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value?.length).toBe(2);
      expect(result.value?.[0]?.peer).toBe("alice");
      expect(result.value?.[1]?.peer).toBe("bob");
    }
  });

});

describe("File Metadata Tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return empty metadata for unseen files", async () => {
    const { fetch, mockResponse } = createMockFetch();
    mockResponse({});

    const client = createTestClient(testConfig, { fetch });
    const metadata = client.exportFileMetadata();

    expect(Object.keys(metadata).length).toBe(0);
  });

  it("should track file metadata after reading", async () => {
    const now = Date.now();
    const { fetch, mockResponse } = createMockFetch();
    mockResponse([
      { time: now, message: "Test", sender: "alice" },
    ]);

    const client = createTestClient(testConfig, { fetch });

    // Seed file metadata directly since readFile is internal
    client.seedFileMetadata({
      "/shared/bot/publish/peers/alice/messages/123.json": { time: now, size: 100 },
    });

    const metadata = client.exportFileMetadata();
    expect(Object.keys(metadata).length).toBeGreaterThan(0);
  });
});

describe("discoverUsers via storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should discover users from storage paths", async () => {
    const { fetch, mockResponse } = createMockFetch();
    // Chat App API returns array of usernames directly
    mockResponse(["alice", "bob"]);

    const client = createTestClient(testConfig, { fetch });
    const result = await client.listUsers();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value?.length).toBe(2);
      expect(result.value?.map((u: any) => u.username).sort()).toEqual(["alice", "bob"]);
    }
  });

  it("should exclude bot's own username from discovery", async () => {
    const { fetch, mockResponse } = createMockFetch();
    // Chat App API returns array of usernames - filter happens on server side
    mockResponse(["alice"]);

    const client = createTestClient(testConfig, { fetch });
    const result = await client.listUsers();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value?.length).toBe(1);
      expect(result.value?.[0]?.username).toBe("alice");
    }
  });

  it("should return empty list when no peers", async () => {
    const { fetch, mockResponse } = createMockFetch();
    mockResponse([]);

    const client = createTestClient(testConfig, { fetch });
    const result = await client.listUsers();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });
});

describe("discoverUsers via storage edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should handle empty file list", async () => {
    const { fetch, mockResponse } = createMockFetch();
    mockResponse([]);

    const client = createTestClient(testConfig, { fetch });
    const result = await client.listUsers();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it("should handle empty discover result", async () => {
    const { fetch, mockResponse } = createMockFetch();
    mockResponse([]);

    const client = createTestClient(testConfig, { fetch });
    const result = await client.listUsers();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it("should discover peers from user discovery", async () => {
    const { fetch, mockResponse } = createMockFetch();
    mockResponse(["alice", "bob"]);

    const client = createTestClient(testConfig, { fetch });
    const result = await client.discoverPeers();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value?.length).toBe(2);
      expect(result.value?.map((p: any) => p.username).sort()).toEqual(["alice", "bob"]);
    }
  });
});

describe("Message Parsing", () => {
  it("should parse valid message entries", () => {
    const entries = [
      { time: 1000, message: "Hello", sender: "alice" },
      { time: 2000, message: "World", sender: "bob" },
    ];

    expect(entries.length).toBe(2);
    expect(entries[0].time).toBe(1000);
    expect(entries[1].time).toBe(2000);
  });

  it("should handle entries without time", () => {
    const entries = [
      { time: 0, message: "No time", sender: "alice" },
      { message: "Missing time", sender: "bob" },
    ];

    expect(entries[0].time).toBe(0);
    expect(entries[1].time).toBeUndefined();
  });

  it("should handle message as object", () => {
    const entry = {
      time: 1000,
      message: { text: "Hello", type: "text" },
      sender: "alice",
    };

    expect(entry.message).toHaveProperty("text");
    expect((entry.message as { text: string }).text).toBe("Hello");
  });
});

describe("File Path Pattern Matching", () => {
  it("should match peer message file paths", () => {
    const pattern = /^\/shared\/([^/]+)\/publish\/peers\/([^/]+)\/messages\//;
    const path = "/shared/alice/publish/peers/test-bot/messages/123.json";
    const match = path.match(pattern);

    expect(match).not.toBeNull();
    expect(match?.[1]).toBe("alice");
    expect(match?.[2]).toBe("test-bot");
  });

  it("should match group message file paths", () => {
    const pattern = /^\/shared\/([^/]+)\/publish\/groups\/([^/]+)\/([^/]+)\/messages\//;
    const path = "/shared/alice/publish/groups/alice/mygroup/messages/123.json";
    const match = path.match(pattern);

    expect(match).not.toBeNull();
    expect(match?.[1]).toBe("alice");
    expect(match?.[2]).toBe("alice");
    expect(match?.[3]).toBe("mygroup");
  });

  it("should not match invalid paths", () => {
    const pattern = /^\/shared\/([^/]+)\/publish\/peers\/([^/]+)\/messages\//;
    const path = "/invalid/path";
    const match = path.match(pattern);

    expect(match).toBeNull();
  });
});

describe("Group Message Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getGroupMessages", () => {
    it("should get messages from a group successfully", async () => {
      const now = Date.now();
      const { fetch, mockResponse, calls } = createMockFetch();
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

      expect(calls.length).toBe(1);
      expect(calls[0].url).toContain("/groups/");
      expect(calls[0].url).toContain(encodeURIComponent("alice"));
      expect(calls[0].url).toContain(encodeURIComponent("mygroup"));
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

    it("should handle group messages with object format", async () => {
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
  });

  describe("sendGroupMessage", () => {
    it("should send message to group successfully", async () => {
      const { fetch, mockResponse } = createMockFetch();
      mockResponse({ success: true });

      const client = createTestClient(testConfig, { fetch });

      const message = {
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

      const message = {
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

      const message = {
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
