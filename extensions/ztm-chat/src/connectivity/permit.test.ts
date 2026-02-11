// Unit tests for Permit management functions

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { requestPermit, savePermitData, handlePairingRequest } from "./permit.js";
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

// Mock runtime - using functions that return promises
let mockPairingResult = { code: "ABC123", created: true };
let mockAllowFromResult: string[] = [];
let mockPairingReplyMessage = "Pairing reply message";
let mockBuildPairingReplyThrows = false;

vi.mock("../runtime.js", () => ({
  getZTMRuntime: () => ({
    channel: {
      pairing: {
        upsertPairingRequest: () => Promise.resolve(mockPairingResult),
        readAllowFromStore: () => Promise.resolve(mockAllowFromResult),
        buildPairingReply: () => {
          if (mockBuildPairingReplyThrows) {
            throw new Error("Not implemented");
          }
          return mockPairingReplyMessage;
        },
      },
    },
  }),
}));

// Mock fetch - use vi.fn that returns real Response objects
const mockFetch = vi.fn();
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

describe("Permit management functions", () => {
  const mockState: AccountRuntimeState = {
    accountId: "test-account",
    config: {
      agentUrl: "https://example.com:7777",
      permitUrl: "https://example.com/permit",
      meshName: "test-mesh",
      username: "test-bot",
      enableGroups: false,
      autoReply: true,
      messagePath: "/shared",
      allowFrom: undefined,
      dmPolicy: "pairing",
    },
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
  });

  describe("handlePairingRequest", () => {
    it("should register pairing request and send message", async () => {
      await handlePairingRequest(mockState, "alice", "Test context", []);

      expect(mockState.pendingPairings.has("alice")).toBe(true);
      expect(mockState.apiClient?.sendPeerMessage).toHaveBeenCalled();
    });

    it("should not send message if pairing already exists", async () => {
      mockPairingResult = { code: "OLD123", created: false };

      await handlePairingRequest(mockState, "alice", "Test context", []);

      expect(mockState.apiClient?.sendPeerMessage).not.toHaveBeenCalled();
    });

    it("should skip if already pending", async () => {
      mockState.pendingPairings.set("alice", new Date());

      await handlePairingRequest(mockState, "alice", "Test context", []);

      expect(mockState.pendingPairings.has("alice")).toBe(true);
      expect(mockState.apiClient?.sendPeerMessage).not.toHaveBeenCalled();
    });

    it("should skip if in allowFrom config", async () => {
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
      await handlePairingRequest(mockState, "  Alice  ", "Test context", []);

      expect(mockState.pendingPairings.has("alice")).toBe(true);
      expect(mockState.apiClient?.sendPeerMessage).toHaveBeenCalled();
    });

    it("should handle registration failure gracefully", async () => {
      // Mock rejection
      vi.doMock("../runtime.js", () => ({
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

      // Should still add to pending pairings
      expect(mockState.pendingPairings.has("alice")).toBe(true);
    });

    it("should return early if no apiClient", async () => {
      // Create a new state with null apiClient
      const stateWithNullClient: AccountRuntimeState = {
        ...mockState,
        apiClient: null,
      };

      await handlePairingRequest(stateWithNullClient, "alice", "Test context", []);

      expect(stateWithNullClient.pendingPairings.has("alice")).toBe(false);
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
  });
});
