// Unit tests for Permit management functions

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { requestPermit, savePermitData, handlePairingRequest } from "./permit.js";
import type { AccountRuntimeState } from "../runtime/state.js";
import { testConfig } from "../test-utils/fixtures.js";
import { createMockLoggerFns } from "../test-utils/mocks.js";

// Mock dependencies
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

// Mock runtime - using functions that return promises
let mockPairingResult = { code: "ABC123", created: true };
let mockAllowFromResult: string[] = [];
let mockPairingReplyMessage = "Pairing reply message";
let mockBuildPairingReplyThrows = false;

const mockUpsertPairingRequest = vi.fn(() => Promise.resolve(mockPairingResult));

vi.mock("../runtime/index.js", () => ({
  getZTMRuntime: vi.fn(() => ({
    channel: {
      pairing: {
        upsertPairingRequest: mockUpsertPairingRequest,
        readAllowFromStore: () => Promise.resolve(mockAllowFromResult),
        buildPairingReply: () => {
          if (mockBuildPairingReplyThrows) {
            throw new Error("Not implemented");
          }
          return mockPairingReplyMessage;
        },
      },
    },
  })),
}));

// Mock fetch - use vi.fn that returns real Response objects
const mockFetch = vi.fn();
const originalFetch = global.fetch;
global.fetch = mockFetch;

// Mock fs - using variables to control behavior
let mockFsExists = true;
let mockFsWriteError: Error | null = null;
let mockFsMkdirError: Error | null = null;
let fsWriteCalls: any[] = [];
let fsMkdirCalls: any[] = [];

const mockExistsSync = () => mockFsExists;
const mockMkdirSync = (...args: any[]) => {
  fsMkdirCalls.push(args);
  if (mockFsMkdirError) throw mockFsMkdirError;
};
const mockWriteFileSync = (...args: any[]) => {
  fsWriteCalls.push(args);
  if (mockFsWriteError) throw mockFsWriteError;
};

vi.mock("fs", () => ({
  existsSync: () => mockExistsSync(),
  mkdirSync: (...args: any[]) => mockMkdirSync(...args),
  writeFileSync: (...args: any[]) => mockWriteFileSync(...args),
}));

vi.mock("../runtime/pairing-store.js", () => ({
  getPairingStateStore: vi.fn(() => ({
    loadPendingPairings: vi.fn(() => new Map()),
    savePendingPairing: vi.fn(),
    deletePendingPairing: vi.fn(),
    cleanupExpiredPairings: vi.fn(() => 0),
    flush: vi.fn(),
    dispose: vi.fn(),
  })),
  disposePairingStateStore: vi.fn(),
}));

describe("Permit management functions", () => {
  const mockState: AccountRuntimeState = {
    accountId: "test-account",
    config: { ...testConfig },
    apiClient: {
      sendPeerMessage: vi.fn().mockResolvedValue(true),
    } as any, // Partial mock for testing
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

    // Reset fs mock state
    mockFsExists = true;
    mockFsWriteError = null;
    mockFsMkdirError = null;
    fsWriteCalls = [];
    fsMkdirCalls = [];

    // Reset runtime mock state
    mockPairingResult = { code: "ABC123", created: true };
    mockAllowFromResult = [];
    mockPairingReplyMessage = "Pairing reply message";
    mockBuildPairingReplyThrows = false;

    // Reset apiClient mock and config
    mockState.apiClient = {
      sendPeerMessage: vi.fn().mockResolvedValue(true),
    } as any; // Partial mock for testing
    mockState.config.allowFrom = undefined;

    // Reset fetch mock
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    // Restore original fetch to avoid affecting other test files
    global.fetch = originalFetch;
  });

  describe("requestPermit", () => {
    it("should request permit successfully", async () => {
      const mockPermitData = { token: "permit-token-123" };
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(mockPermitData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
          statusText: "OK",
        })
      );

      const result = await requestPermit(
        "https://example.com/permit",
        "public-key-data",
        "test-user"
      );

      expect(result).toEqual(mockPermitData);
      expect(mockFetch).toHaveBeenCalledWith("https://example.com/permit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          PublicKey: "public-key-data",
          UserName: "test-user",
        }),
      });
    });

    it("should return null on HTTP error", async () => {
      mockFetch.mockResolvedValue(
        new Response("Not Found", {
          status: 404,
          statusText: "Not Found",
        }) as unknown as Response
      );

      const result = await requestPermit(
        "https://example.com/permit",
        "public-key",
        "user"
      );

      expect(result).toBeNull();
    });

    it("should return null on network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await requestPermit(
        "https://example.com/permit",
        "public-key",
        "user"
      );

      expect(result).toBeNull();
    });

    it("should handle non-JSON response", async () => {
      const mockResponse = {
        ok: true,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      } as unknown as Response;
      mockFetch.mockResolvedValue(mockResponse);

      const result = await requestPermit(
        "https://example.com/permit",
        "public-key",
        "user"
      );

      expect(result).toBeNull();
    });

    it("should log success message", async () => {
      const mockPermitData = { token: "test-token" };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => mockPermitData,
      } as unknown as Response);

      await requestPermit("https://example.com/permit", "key", "user");

      const { logger } = await import("../utils/logger.js");
      expect(logger.info).toHaveBeenCalledWith("Permit request successful");
    });

    it("should log error on failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "Server Error",
      } as unknown as Response);

      await requestPermit("https://example.com/permit", "key", "user");

      const { logger } = await import("../utils/logger.js");
      expect(logger.error).toHaveBeenCalled();
    });

    it("should handle various HTTP status codes", async () => {
      const statusCodes = [400, 401, 403, 404, 500, 502, 503];

      for (const status of statusCodes) {
        mockFetch.mockResolvedValue({
          ok: status < 400,
          status,
          statusText: `Error ${status}`,
          text: async () => `Error ${status}`,
        } as unknown as Response);

        const result = await requestPermit(
          "https://example.com/permit",
          "key",
          "user"
        );

        expect(result).toBe(status < 400 ? expect.anything() : null);
      }
    });

    it("should send correct payload structure", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as unknown as Response);

      await requestPermit("https://example.com/permit", "pub-key", "username");

      const bodyArg = mockFetch.mock.calls[0]?.[1]?.body;
      const parsedBody = JSON.parse(bodyArg);
      expect(parsedBody).toEqual({
        PublicKey: "pub-key",
        UserName: "username",
      });
    });

    it("should handle empty permit response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as unknown as Response);

      const result = await requestPermit(
        "https://example.com/permit",
        "key",
        "user"
      );

      expect(result).toEqual({});
    });
  });

  describe("savePermitData", () => {
    const testPermitPath = "/test/path/permit.json";

    it("should save permit data successfully", () => {
      const permitData = { token: "test-token" };

      const result = savePermitData(permitData, testPermitPath);

      expect(result).toBe(true);
      expect(fsWriteCalls.length).toBe(1);
      expect(fsWriteCalls[0]).toEqual([
        testPermitPath,
        JSON.stringify(permitData, null, 2),
      ]);
    });

    it("should create directory if not exists", () => {
      const permitData = { token: "test" };
      mockFsExists = false;

      const result = savePermitData(permitData, testPermitPath);

      expect(result).toBe(true);
      expect(fsMkdirCalls.length).toBe(1);
      expect(fsMkdirCalls[0][0]).toBe(require("path").dirname(testPermitPath));
      expect(fsMkdirCalls[0][1]).toEqual({ recursive: true });
    });

    it("should handle file write error", () => {
      const permitData = { token: "test" };
      mockFsWriteError = new Error("Write failed");

      const result = savePermitData(permitData, testPermitPath);

      expect(result).toBe(false);
    });

    it("should handle directory creation error", () => {
      const permitData = { token: "test" };
      mockFsExists = false;
      mockFsMkdirError = new Error("Mkdir failed");

      const result = savePermitData(permitData, testPermitPath);

      expect(result).toBe(false);
    });

    it("should log success message", async () => {
      const permitData = { token: "test" };
      mockFsExists = true;
      mockFsWriteError = null;

      savePermitData(permitData, testPermitPath);

      const { logger } = await import("../utils/logger.js");
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Permit data saved to")
      );
    });

    it("should log error on failure", async () => {
      const permitData = { token: "test" };
      mockFsWriteError = new Error("Write failed");

      savePermitData(permitData, testPermitPath);

      const { logger } = await import("../utils/logger.js");
      expect(logger.error).toHaveBeenCalled();
    });

    it("should handle complex nested permit data", () => {
      const permitData = {
        token: "test",
        nested: {
          level1: {
            level2: { value: "deep" },
          },
          array: [1, 2, 3],
        },
      };

      savePermitData(permitData, testPermitPath);

      expect(fsWriteCalls[0][1]).toBe(JSON.stringify(permitData, null, 2));
    });

    it("should handle special characters in data", () => {
      const permitData = {
        message: "Test unicode: 你好 🌍",
        special: 'Quotes: " \'',
      };

      const result = savePermitData(permitData, testPermitPath);

      expect(result).toBe(true);
    });

    it("should not create directory when exists", () => {
      const permitData = { token: "test" };
      mockFsExists = true;

      savePermitData(permitData, testPermitPath);

      expect(fsMkdirCalls.length).toBe(0);
    });

    it("should handle deeply nested paths", () => {
      const permitData = { token: "test" };
      mockFsExists = false;
      const deepPath = "/a/b/c/d/e/f/permit.json";

      savePermitData(permitData, deepPath);

      expect(fsMkdirCalls[0][0]).toBe("/a/b/c/d/e/f");
    });
  });

  describe("handlePairingRequest", () => {
    it("should register pairing request and send message", async () => {
      mockUpsertPairingRequest.mockClear();

      await handlePairingRequest(mockState, "alice", "Test context", []);

      expect(mockUpsertPairingRequest).toHaveBeenCalled();
      expect(mockState.apiClient?.sendPeerMessage).toHaveBeenCalled();
    });

    it("should not send message if pairing already exists", async () => {
      mockPairingResult = { code: "OLD123", created: false };
      mockUpsertPairingRequest.mockClear();

      await handlePairingRequest(mockState, "alice", "Test context", []);

      // When pairing already exists (created=false), don't re-send message
      expect(mockState.apiClient?.sendPeerMessage).not.toHaveBeenCalled();
    });

    it("should skip if already approved in allowFrom", async () => {
      mockState.config.allowFrom = ["alice"];

      await handlePairingRequest(mockState, "alice", "Test context", []);

      expect(mockState.apiClient?.sendPeerMessage).not.toHaveBeenCalled();
    });

    it("should skip if in store allowFrom", async () => {
      const storeAllowFrom = ["alice"];

      await handlePairingRequest(mockState, "alice", "Test context", storeAllowFrom);

      expect(mockState.apiClient?.sendPeerMessage).not.toHaveBeenCalled();
    });

    it("should normalize peer name", async () => {
      mockUpsertPairingRequest.mockClear();

      await handlePairingRequest(mockState, "  Alice  ", "Test context", []);

      // Verify OpenClaw's pairing API was called
      expect(mockUpsertPairingRequest).toHaveBeenCalled();
      expect(mockState.apiClient?.sendPeerMessage).toHaveBeenCalled();
    });

    it("should handle registration failure gracefully", async () => {
      // Mock rejection
      vi.doMock("../runtime/index.js", () => ({
        getZTMRuntime: () => ({
          channel: {
            pairing: {
              upsertPairingRequest: () => Promise.reject(new Error("Registration failed")),
              readAllowFromStore: () => Promise.resolve([]),
              buildPairingReply: () => "Fallback message",
            },
          },
        }),
      }));

      // Should not throw
      await expect(
        handlePairingRequest(mockState, "alice", "Test context", [])
      ).resolves.toBeUndefined();
    });

    it("should use pairing code in message", async () => {
      mockPairingResult = { code: "CODE123", created: true };
      mockPairingReplyMessage = "Pairing reply with CODE123";

      await handlePairingRequest(mockState, "alice", "Test context", []);

      const sentMessage = (mockState.apiClient as any).sendPeerMessage.mock.calls[0];
      expect(sentMessage[1].message).toContain("CODE123");
    });

    it("should use fallback message when buildPairingReply fails", async () => {
      mockPairingResult = { code: "CODE123", created: true };
      mockBuildPairingReplyThrows = true;

      await handlePairingRequest(mockState, "alice", "Test context", []);

      const sentMessage = (mockState.apiClient as any).sendPeerMessage.mock.calls[0];
      expect(sentMessage[1].message).toContain("PAIRING");
    });

    it("should handle send failure gracefully", async () => {
      (mockState.apiClient as any).sendPeerMessage.mockRejectedValue(new Error("Send failed"));

      // Should not throw
      await expect(
        handlePairingRequest(mockState, "alice", "Test context", [])
      ).resolves.toBeUndefined();
    });

    it("should return early if no apiClient", async () => {
      // Create a new state with null apiClient
      const stateWithNullClient: AccountRuntimeState = {
        ...mockState,
        apiClient: null,
      };

      await handlePairingRequest(stateWithNullClient, "alice", "Test context", []);
    });

    it("should check store allowFrom with normalized names", async () => {
      const storeAllowFrom = ["  ALICE  ", "BOB"];

      await handlePairingRequest(mockState, "alice", "Test context", storeAllowFrom);

      expect(mockState.apiClient?.sendPeerMessage).not.toHaveBeenCalled();
    });

    it("should check config allowFrom with normalized names", async () => {
      mockState.config.allowFrom = ["  alice  ", "BOB"];

      await handlePairingRequest(mockState, "Alice", "Test context", []);

      expect(mockState.apiClient?.sendPeerMessage).not.toHaveBeenCalled();
    });

    it("should use correct pairing request parameters", async () => {
      mockUpsertPairingRequest.mockClear();

      await handlePairingRequest(mockState, "TestPeer", "context", []);

      expect(mockUpsertPairingRequest).toHaveBeenCalledWith({
        channel: "ztm-chat",
        id: "testpeer",
        meta: { name: "TestPeer" },
      });
    });

    it("should build pairing reply correctly", async () => {
      mockPairingResult = { code: "TESTCODE", created: true };
      mockUpsertPairingRequest.mockClear();

      await handlePairingRequest(mockState, "TestPeer", "context", []);

      expect(mockUpsertPairingRequest).toHaveBeenCalled();
    });

    it("should handle case-insensitive peer matching in allowFrom", async () => {
      mockState.config.allowFrom = ["Alice", "Bob"];

      await handlePairingRequest(mockState, "ALICE", "context", []);

      expect(mockState.apiClient?.sendPeerMessage).not.toHaveBeenCalled();
    });

    it("should send message with proper structure", async () => {
      mockPairingResult = { code: "CODE", created: true };

      await handlePairingRequest(mockState, "Peer", "context", []);

      expect(mockState.apiClient?.sendPeerMessage).toHaveBeenCalledWith(
        "Peer",
        expect.objectContaining({
          time: expect.any(Number),
          message: expect.any(String),
          sender: mockState.config.username,
        })
      );
    });

    it("should handle empty storeAllowFrom array", async () => {
      const emptyStore: string[] = [];

      await handlePairingRequest(mockState, "alice", "context", emptyStore);

      expect(mockState.apiClient?.sendPeerMessage).toHaveBeenCalled();
    });

    it("should handle peer with special characters", async () => {
      const specialPeer = "user_123-test.dev";

      await handlePairingRequest(mockState, specialPeer, "context", []);

      expect(mockUpsertPairingRequest).toHaveBeenCalledWith({
        channel: "ztm-chat",
        id: "user_123-test.dev",
        meta: { name: specialPeer },
      });
    });

    it("should log when pairing already exists", async () => {
      mockPairingResult = { code: "OLD", created: false };
      mockUpsertPairingRequest.mockClear();

      await handlePairingRequest(mockState, "alice", "context", []);

      const { logger } = await import("../utils/logger.js");
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("already exists")
      );
    });

    it("should log successful pairing request", async () => {
      mockPairingResult = { code: "NEW", created: true };
      mockUpsertPairingRequest.mockClear();

      await handlePairingRequest(mockState, "alice", "context", []);

      const { logger } = await import("../utils/logger.js");
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Registered new pairing request")
      );
    });

    it("should handle null apiClient config", async () => {
      const noClientState: AccountRuntimeState = {
        ...mockState,
        apiClient: null,
      };

      await handlePairingRequest(noClientState, "peer", "context", []);

      expect(mockUpsertPairingRequest).not.toHaveBeenCalled();
    });

    it("should not call apiClient when peer already in allowFrom", async () => {
      mockState.config.allowFrom = ["ExistingPeer"];

      await handlePairingRequest(mockState, "ExistingPeer", "context", []);

      expect(mockState.apiClient?.sendPeerMessage).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases and Integration", () => {
    it("should handle concurrent pairing requests", async () => {
      const peers = ["peer1", "peer2", "peer3"];

      await Promise.all(
        peers.map((peer) =>
          handlePairingRequest(mockState, peer, "context", [])
        )
      );

      expect(mockState.apiClient?.sendPeerMessage).toHaveBeenCalledTimes(3);
    });

    it("should handle very long peer names", async () => {
      const longPeer = "a".repeat(1000);

      await handlePairingRequest(mockState, longPeer, "context", []);

      expect(mockUpsertPairingRequest).toHaveBeenCalled();
    });

    it("should handle unicode peer names", async () => {
      const unicodePeer = "用户-пользователь";

      await handlePairingRequest(mockState, unicodePeer, "context", []);

      expect(mockUpsertPairingRequest).toHaveBeenCalled();
    });

    it("should handle empty permit data save", () => {
      const emptyData = {};

      savePermitData(emptyData, "/test/path.json");

      expect(fsWriteCalls[0][1]).toBe(JSON.stringify(emptyData, null, 2));
    });

    it("should handle null values in permit data", () => {
      const dataWithNull = { token: "test", optional: null };

      savePermitData(dataWithNull, "/test/path.json");

      expect(fsWriteCalls[0][1]).toContain("null");
    });

    it("should handle network timeout in permit request", async () => {
      mockFetch.mockRejectedValue(new Error("Request timeout"));

      const result = await requestPermit(
        "https://example.com/permit",
        "key",
        "user"
      );

      expect(result).toBeNull();
    });
  });
});
