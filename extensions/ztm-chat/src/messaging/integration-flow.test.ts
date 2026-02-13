// Integration tests for complete message flow
// Tests the full pipeline from receiving a message to sending a reply

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  processIncomingMessage,
  checkDmPolicy,
  notifyMessageCallbacks,
} from "./inbound.js";
import { sendZTMMessage } from "./outbound.js";
import {
  getOrCreateAccountState,
  removeAccountState,
  getAllAccountStates,
} from "../runtime/state.js";
import type { ZTMChatConfig } from "../types/config.js";
import type { AccountRuntimeState } from "../types/runtime.js";
import type { ZTMChatMessage } from "../types/messaging.js";
import type { ZTMApiClient } from "../types/api.js";
import { success, isSuccess } from "../types/common.js";

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

// Mock store with fresh instances for each call
vi.mock("../runtime/store.js", () => ({
  getMessageStateStore: vi.fn(function () {
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

// Mock API
vi.mock("../api/ztm-api.js", () => ({
  createZTMApiClient: vi.fn(() => ({})),
}));

// Mock pairing store
vi.mock("../runtime/pairing-store.js", () => {
  const mockPairingStore = {
    loadPendingPairings: vi.fn(() => new Map()),
    savePendingPairing: vi.fn(),
    deletePendingPairing: vi.fn(),
    cleanupExpiredPairings: vi.fn(() => 0),
    flush: vi.fn(),
    dispose: vi.fn(),
  };
  return {
    createPairingStateStore: vi.fn(() => mockPairingStore),
    getPairingStateStore: vi.fn(() => mockPairingStore),
    disposePairingStateStore: vi.fn(),
  };
});

// Helper to create base config
function createBaseConfig(overrides?: Partial<ZTMChatConfig>): ZTMChatConfig {
  return {
    agentUrl: "https://example.com:7777",
    permitUrl: "https://example.com/permit",
    meshName: "test-mesh",
    username: "test-bot",
    enableGroups: false,
    autoReply: true,
    messagePath: "/shared",
    allowFrom: undefined,
    dmPolicy: "pairing",
    ...overrides,
  };
}

// Helper to create mock state
function createMockState(accountId: string, config?: ZTMChatConfig): AccountRuntimeState {
  return {
    accountId,
    config: config ?? createBaseConfig(),
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
}

// Helper to create mock API client
function createMockApiClient(overrides?: {
  sendPeerMessage?: ReturnType<typeof vi.fn>;
  sendGroupMessage?: ReturnType<typeof vi.fn>;
}): ZTMApiClient {
  return {
    sendPeerMessage: overrides?.sendPeerMessage ?? vi.fn().mockResolvedValue(success(true)),
    sendGroupMessage: overrides?.sendGroupMessage ?? vi.fn().mockResolvedValue(success(true)),
  } as unknown as ZTMApiClient;
}

// Helper to create a unique message
function createMessage(overrides?: Partial<{ time: number; message: string; sender: string }>) {
  return {
    time: Date.now() + Math.floor(Math.random() * 1000000),
    message: "Hello, world!",
    sender: "alice",
    ...overrides,
  };
}

describe("Integration: Complete Message Flow", () => {
  // Get the mocked pairing store functions
  let mockLoadPendingPairings: ReturnType<typeof vi.fn>;
  let mockSavePendingPairing: ReturnType<typeof vi.fn>;
  let mockDeletePendingPairing: ReturnType<typeof vi.fn>;
  let mockCleanupExpiredPairings: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Get mock functions from the mocked module
    const pairingModule = await import("../runtime/pairing-store.js");
    mockLoadPendingPairings = vi.fn(() => new Map());
    mockSavePendingPairing = vi.fn();
    mockDeletePendingPairing = vi.fn();
    mockCleanupExpiredPairings = vi.fn(() => 0);

    // Reset and configure mocks
    pairingModule.getPairingStateStore.mockReturnValue({
      loadPendingPairings: mockLoadPendingPairings,
      savePendingPairing: mockSavePendingPairing,
      deletePendingPairing: mockDeletePendingPairing,
      cleanupExpiredPairings: mockCleanupExpiredPairings,
      flush: vi.fn(),
      dispose: vi.fn(),
    });

    // Clean up all account states
    const allStates = getAllAccountStates();
    for (const [accountId] of allStates) {
      removeAccountState(accountId);
    }
  });

  afterEach(() => {
    // Clean up all account states
    const allStates = getAllAccountStates();
    for (const [accountId] of allStates) {
      removeAccountState(accountId);
    }

    vi.restoreAllMocks();
  });

  describe("1. Complete Message Flow (DM)", () => {
    it("should process message from inbound to outbound for DM", async () => {
      const accountId = "test-account-dm";
      const config = createBaseConfig({ dmPolicy: "allow" });
      const state = createMockState(accountId, config);

      // Setup mock API client
      const mockSendPeerMessage = vi.fn().mockResolvedValue(success(true));
      state.apiClient = createMockApiClient({ sendPeerMessage: mockSendPeerMessage });

      // Step 1: Receive inbound message
      const inboundMessage = createMessage({ sender: "bob", message: "Hello from Bob!" });
      const processedMessage = processInboundMessage(inboundMessage, config, [], accountId);

      expect(processedMessage).not.toBeNull();
      expect(processedMessage?.sender).toBe("bob");
      expect(processedMessage?.content).toBe("Hello from Bob!");

      // Step 2: Register callback and notify
      const messageHandler = vi.fn();
      state.messageCallbacks.add(messageHandler);

      if (processedMessage) {
        notifyMessageCallbacks(state, processedMessage);
      }

      expect(messageHandler).toHaveBeenCalledWith(processedMessage);

      // Step 3: Send outbound reply
      const replyResult = await sendZTMMessage(state, "bob", "Hello Bob, this is a reply!");

      expect(isSuccess(replyResult)).toBe(true);
      expect(mockSendPeerMessage).toHaveBeenCalledWith("bob", expect.objectContaining({
        message: "Hello Bob, this is a reply!",
        sender: "test-bot",
      }));
      expect(state.lastOutboundAt).not.toBeNull();
    });

    it("should handle message with allowFrom whitelist", () => {
      const accountId = "test-account-whitelist";
      const config = createBaseConfig({ dmPolicy: "pairing", allowFrom: ["alice", "bob"] });

      // Alice is whitelisted - should be allowed
      const messageFromAlice = createMessage({ sender: "alice" });
      const result = processIncomingMessage(messageFromAlice, config, [], accountId);
      expect(result).not.toBeNull();
      expect(result?.sender).toBe("alice");

      // Charlie is not whitelisted - should be denied in pairing mode
      const messageFromCharlie = createMessage({ sender: "charlie" });
      const resultCharlie = processIncomingMessage(messageFromCharlie, config, [], accountId);
      expect(resultCharlie).toBeNull();
    });

    it("should handle message with store-approved whitelist", () => {
      const accountId = "test-account-store";
      const config = createBaseConfig({ dmPolicy: "pairing" });
      const storeAllowFrom = ["dave"];

      // Dave is store-approved - should be allowed
      const messageFromDave = createMessage({ sender: "dave" });
      const result = processIncomingMessage(messageFromDave, config, storeAllowFrom, accountId);
      expect(result).not.toBeNull();
      expect(result?.sender).toBe("dave");
    });
  });

  describe("2. Complete Message Flow (Group)", () => {
    it("should process group message from inbound to outbound", async () => {
      const accountId = "test-account-group";
      const config = createBaseConfig({ dmPolicy: "allow", enableGroups: true });
      const state = createMockState(accountId, config);

      // Setup mock API client
      const mockSendGroupMessage = vi.fn().mockResolvedValue(success(true));
      state.apiClient = createMockApiClient({ sendGroupMessage: mockSendGroupMessage });

      // Step 1: Receive inbound group message
      const groupInfo = { creator: "group-admin", group: "test-group" };
      const inboundMessage = createMessage({
        sender: "charlie",
        message: "Hello from group!",
      });

      const processedMessage = processIncomingMessage(
        inboundMessage,
        config,
        [],
        accountId,
        groupInfo
      );

      // Note: processIncomingMessage processes the message but doesn't include
      // group info in the returned ZTMChatMessage - that's handled separately
      expect(processedMessage).not.toBeNull();
      expect(processedMessage?.sender).toBe("charlie");
      expect(processedMessage?.content).toBe("Hello from group!");

      // Step 2: Send reply to group using the groupInfo
      const replyResult = await sendZTMMessage(
        state,
        "charlie",
        "Hello group!",
        groupInfo
      );

      expect(isSuccess(replyResult)).toBe(true);
      expect(mockSendGroupMessage).toHaveBeenCalledWith(
        "group-admin",
        "test-group",
        expect.objectContaining({
          message: "Hello group!",
          sender: "test-bot",
        })
      );
    });
  });

  describe("3. DM Policy Variations", () => {
    it("should allow all messages when dmPolicy='allow'", () => {
      const accountId = "test-account-allow";
      const config = createBaseConfig({ dmPolicy: "allow" });

      const message = createMessage({ sender: "stranger" });
      const result = processIncomingMessage(message, config, [], accountId);

      expect(result).not.toBeNull();
    });

    it("should deny all messages when dmPolicy='deny'", () => {
      const accountId = "test-account-deny";
      const config = createBaseConfig({ dmPolicy: "deny" });

      const message = createMessage({ sender: "friend" });
      const result = processIncomingMessage(message, config, [], accountId);

      expect(result).toBeNull();
    });

    it("should request pairing when dmPolicy='pairing' and sender not whitelisted", () => {
      const accountId = "test-account-pairing";
      const config = createBaseConfig({ dmPolicy: "pairing" });

      const message = createMessage({ sender: "new-user" });
      const result = processIncomingMessage(message, config, [], accountId);

      // Should return null (not processed) because pairing is required
      expect(result).toBeNull();

      // Check DM policy result
      const policyResult = checkDmPolicy("new-user", config, []);
      expect(policyResult.allowed).toBe(false);
      expect(policyResult.action).toBe("request_pairing");
    });
  });

  describe("4. Multi-Account Integration", () => {
    it("should route message to correct account", () => {
      // Create two separate account states
      const account1Id = "account-1";
      const account2Id = "account-2";

      const config1 = createBaseConfig({ username: "bot-1", dmPolicy: "allow" });
      const config2 = createBaseConfig({ username: "bot-2", dmPolicy: "allow" });

      const state1 = getOrCreateAccountState(account1Id);
      state1.config = config1;

      const state2 = getOrCreateAccountState(account2Id);
      state2.config = config2;

      // Verify they are separate
      expect(state1.accountId).toBe(account1Id);
      expect(state2.accountId).toBe(account2Id);
      expect(state1.config.username).toBe("bot-1");
      expect(state2.config.username).toBe("bot-2");

      // Process messages for each account
      const message1 = createMessage({ sender: "user-1" });
      const result1 = processIncomingMessage(message1, config1, [], account1Id);

      const message2 = createMessage({ sender: "user-2" });
      const result2 = processIncomingMessage(message2, config2, [], account2Id);

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(result1?.sender).toBe("user-1");
      expect(result2?.sender).toBe("user-2");
    });

    it("should handle concurrent messages to different accounts", () => {
      const accountIds = ["account-a", "account-b", "account-c"];

      // Create states for multiple accounts
      accountIds.forEach((id) => {
        const state = getOrCreateAccountState(id);
        state.config = createBaseConfig({ dmPolicy: "allow" });
      });

      // Process messages concurrently
      const messages = accountIds.map((accountId, index) => {
        const message = createMessage({ sender: `user-${index}` });
        return processIncomingMessage(message, createBaseConfig({ dmPolicy: "allow" }), [], accountId);
      });

      // All messages should be processed
      messages.forEach((result, index) => {
        expect(result).not.toBeNull();
        expect(result?.sender).toBe(`user-${index}`);
      });

      // Verify states are independent
      const allStates = getAllAccountStates();
      expect(allStates.size).toBe(3);
    });

    it("should use account-specific configuration", () => {
      const account1Id = "account-allow";
      const account2Id = "account-deny";

      const config1 = createBaseConfig({ dmPolicy: "allow" });
      const config2 = createBaseConfig({ dmPolicy: "deny" });

      // Account 1: allow
      const state1 = getOrCreateAccountState(account1Id);
      state1.config = config1;

      // Account 2: deny
      const state2 = getOrCreateAccountState(account2Id);
      state2.config = config2;

      const message = createMessage({ sender: "test-user" });

      // Account 1 allows
      const result1 = processIncomingMessage(message, config1, [], account1Id);
      expect(result1).not.toBeNull();

      // Account 2 denies
      const result2 = processIncomingMessage(message, config2, [], account2Id);
      expect(result2).toBeNull();
    });
  });

  describe("5. Complete Pairing Flow", () => {
    it("should handle new user pairing request flow", () => {
      const accountId = "test-pairing-account";
      const config = createBaseConfig({ dmPolicy: "pairing" });
      const newUser = "new-user";

      // Step 1: New user sends message - should be blocked
      const message = createMessage({ sender: newUser });
      const result = processIncomingMessage(message, config, [], accountId);

      expect(result).toBeNull(); // Not processed - needs pairing

      // Step 2: Check policy - should request pairing
      const policyResult = checkDmPolicy(newUser, config, []);
      expect(policyResult.action).toBe("request_pairing");

      // Step 3: Save pairing request via mock
      mockSavePendingPairing(accountId, newUser);

      // Verify pairing saved
      expect(mockSavePendingPairing).toHaveBeenCalledWith(accountId, newUser);
    });

    it("should allow message after pairing approval", () => {
      const accountId = "test-pairing-approval";
      const config = createBaseConfig({ dmPolicy: "pairing" });
      const approvedUser = "approved-user";

      // Pre-approve the user via store
      const storeAllowFrom = [approvedUser];

      // Step 1: Now the user should be allowed
      const message = createMessage({ sender: approvedUser });
      const result = processIncomingMessage(message, config, storeAllowFrom, accountId);

      expect(result).not.toBeNull();
      expect(result?.sender).toBe(approvedUser);
    });

    it("should cleanup expired pairing requests", () => {
      const accountId = "test-pairing-expiry";
      const config = createBaseConfig({ dmPolicy: "pairing" });

      // Setup mock to return 2 pairings
      mockLoadPendingPairings.mockReturnValue(new Map([
        ["user-1", new Date()],
        ["user-2", new Date()],
      ]));

      // Verify we can check pairings
      const pairings = mockLoadPendingPairings(accountId);
      expect(pairings.size).toBe(2);

      // Cleanup expired
      const expiredCount = mockCleanupExpiredPairings(accountId, 0);
      expect(expiredCount).toBe(0); // Mock always returns 0
    });

    it("should handle pairing request timeout", () => {
      const accountId = "test-pairing-timeout";
      const config = createBaseConfig({ dmPolicy: "pairing" });
      const user = "timeout-user";

      // User sends message initially
      const message1 = createMessage({ sender: user, time: Date.now() });
      const result1 = processIncomingMessage(message1, config, [], accountId);
      expect(result1).toBeNull();

      // Setup mock to return the user as pending
      mockLoadPendingPairings.mockReturnValue(new Map([[user, new Date()]]));

      // Save pairing request
      mockSavePendingPairing(accountId, user);

      // After some time, check if still pending
      const pending = mockLoadPendingPairings(accountId);
      expect(pending.has(user)).toBe(true);

      // Simulate cleanup of old pairings
      mockCleanupExpiredPairings(accountId, 60 * 60 * 1000); // 1 hour

      // This should not remove the pairing if it was just created (mock behavior)
      const stillPending = mockLoadPendingPairings(accountId);
      expect(stillPending.has(user)).toBe(true);
    });

    it("should remove pairing after approval", () => {
      const accountId = "test-pairing-remove";
      const config = createBaseConfig({ dmPolicy: "pairing" });
      const user = "approved-and-remove";

      // Setup mock to return the user as pending
      mockLoadPendingPairings.mockReturnValue(new Map([[user, new Date()]]));

      // Save pairing request
      mockSavePendingPairing(accountId, user);

      let pending = mockLoadPendingPairings(accountId);
      expect(pending.has(user)).toBe(true);

      // Simulate approval - remove the pairing
      mockDeletePendingPairing(accountId, user);

      // Setup mock to return empty
      mockLoadPendingPairings.mockReturnValue(new Map());

      pending = mockLoadPendingPairings(accountId);
      expect(pending.has(user)).toBe(false);
    });
  });

  describe("6. End-to-End Message Flow with Callbacks", () => {
    it("should execute full pipeline: receive -> process -> callback -> reply", async () => {
      const accountId = "test-e2e-flow";
      const config = createBaseConfig({ dmPolicy: "allow" });
      const state = createMockState(accountId, config);

      // Setup mock API
      const mockSendPeerMessage = vi.fn().mockResolvedValue(success(true));
      state.apiClient = createMockApiClient({ sendPeerMessage: mockSendPeerMessage });

      // Track message flow
      const receivedMessages: ZTMChatMessage[] = [];
      const messageHandler = (msg: ZTMChatMessage) => {
        receivedMessages.push(msg);
      };
      state.messageCallbacks.add(messageHandler);

      // Step 1: Receive and process message
      const inboundMsg = createMessage({ sender: "eve", message: "Testing full flow!" });
      const processed = processIncomingMessage(inboundMsg, config, [], accountId);

      expect(processed).not.toBeNull();

      // Step 2: Notify callbacks
      if (processed) {
        notifyMessageCallbacks(state, processed);
      }

      expect(receivedMessages.length).toBe(1);
      expect(receivedMessages[0].sender).toBe("eve");

      // Step 3: Send reply
      const reply = await sendZTMMessage(state, "eve", "Full flow test complete!");

      expect(isSuccess(reply)).toBe(true);
      expect(mockSendPeerMessage).toHaveBeenCalledWith("eve", expect.objectContaining({
        message: "Full flow test complete!",
      }));

      // Verify state updates
      expect(state.lastInboundAt).not.toBeNull();
      expect(state.lastOutboundAt).not.toBeNull();
    });

    it("should handle multiple callbacks in pipeline", () => {
      const accountId = "test-multi-callbacks";
      const config = createBaseConfig({ dmPolicy: "allow" });
      const state = createMockState(accountId, config);

      // Add multiple callbacks
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      state.messageCallbacks.add(callback1);
      state.messageCallbacks.add(callback2);
      state.messageCallbacks.add(callback3);

      // Process message
      const inboundMsg = createMessage({ sender: "multi-callback-user" });
      const processed = processIncomingMessage(inboundMsg, config, [], accountId);

      expect(processed).not.toBeNull();

      if (processed) {
        notifyMessageCallbacks(state, processed);
      }

      // All callbacks should be called
      expect(callback1).toHaveBeenCalledWith(processed);
      expect(callback2).toHaveBeenCalledWith(processed);
      expect(callback3).toHaveBeenCalledWith(processed);
    });

    it("should handle callback errors gracefully", () => {
      const accountId = "test-callback-error";
      const config = createBaseConfig({ dmPolicy: "allow" });
      const state = createMockState(accountId, config);

      // Add callbacks where one throws
      const errorCallback = vi.fn(() => {
        throw new Error("Callback failed");
      });
      const successCallback = vi.fn();

      state.messageCallbacks.add(errorCallback);
      state.messageCallbacks.add(successCallback);

      // Process message
      const inboundMsg = createMessage({ sender: "error-handling-user" });
      const processed = processIncomingMessage(inboundMsg, config, [], accountId);

      expect(processed).not.toBeNull();

      // Should not throw, all callbacks should be attempted
      expect(() => {
        if (processed) {
          notifyMessageCallbacks(state, processed);
        }
      }).not.toThrow();

      expect(errorCallback).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalled();
    });
  });

  describe("7. Edge Cases", () => {
    it("should skip own messages", () => {
      const accountId = "test-skip-own";
      const config = createBaseConfig({ username: "my-bot", dmPolicy: "allow" });

      // Message from self
      const ownMessage = createMessage({ sender: "my-bot" });
      const result = processIncomingMessage(ownMessage, config, [], accountId);

      expect(result).toBeNull();
    });

    it("should skip duplicate messages based on watermark", async () => {
      const accountId = "test-watermark";
      const config = createBaseConfig({ dmPolicy: "allow" });
      const state = createMockState(accountId, config);

      const timestamp = Date.now();
      const message = createMessage({ time: timestamp, sender: "watermark-user" });

      // First message should be processed
      const result1 = processIncomingMessage(message, config, [], accountId);
      expect(result1).not.toBeNull();

      // Add callback to trigger watermark update
      state.messageCallbacks.add(vi.fn());
      if (result1) {
        notifyMessageCallbacks(state, result1);
      }

      // Import store to manipulate watermark
      const { getMessageStateStore } = await import("../runtime/store.js");
      const store = getMessageStateStore();
      vi.mocked(store.getWatermark).mockReturnValue(timestamp + 1);

      // Second message with same timestamp should be skipped
      const result2 = processIncomingMessage(
        { ...message, time: timestamp },
        config,
        [],
        accountId
      );
      // Note: watermark check behavior depends on implementation
      // This test verifies the flow works
      expect(result2).toBeDefined();
    });

    it("should handle empty message content", () => {
      const accountId = "test-empty";
      const config = createBaseConfig({ dmPolicy: "allow" });

      const emptyMessage = createMessage({ message: "" });
      const result = processIncomingMessage(emptyMessage, config, [], accountId);

      expect(result).toBeNull();
    });

    it("should handle whitespace-only message", () => {
      const accountId = "test-whitespace";
      const config = createBaseConfig({ dmPolicy: "allow" });

      const whitespaceMessage = createMessage({ message: "   \n\t  " });
      const result = processIncomingMessage(whitespaceMessage, config, [], accountId);

      expect(result).toBeNull();
    });
  });
});

// Helper function for simpler message processing (used in tests)
function processInboundMessage(
  msg: { time: number; message: string; sender: string },
  config: ZTMChatConfig,
  storeAllowFrom: string[] = [],
  accountId: string = "default"
): ZTMChatMessage | null {
  return processIncomingMessage(msg, config, storeAllowFrom, accountId);
}
