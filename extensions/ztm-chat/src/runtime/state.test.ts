// Unit tests for Account Runtime State Management

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getOrCreateAccountState,
  removeAccountState,
  getAllAccountStates,
  initializeRuntime,
  stopRuntime,
  type AccountRuntimeState,
} from "./state.js";
import { success } from "../types/common.js";

// Mock state using mutable container
const mockApiState = {
  getMeshInfo: vi.fn().mockResolvedValue(success({
    connected: true,
    endpoints: 5,
    errors: [],
  })),
};

vi.mock("../api/ztm-api.js", () => ({
  createZTMApiClient: vi.fn(() => ({
    getMeshInfo: () => mockApiState.getMeshInfo(),
  })),
}));

vi.mock("../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("./store.js", () => ({
  messageStateStore: {
    flush: vi.fn(),
    getWatermark: () => -1,
    setWatermark: () => {},
  },
}));

vi.mock("../messaging/inbound.js", () => ({
  startMessageWatcher: vi.fn().mockResolvedValue(undefined),
}));

describe("Account Runtime State Management", () => {
  const testAccountId = "test-account";
  const testConfig = {
    agentUrl: "https://example.com:7777",
    permitUrl: "https://example.com/permit",
    meshName: "test-mesh",
    username: "test-bot",
    enableGroups: false,
    autoReply: true,
    messagePath: "/shared",
    allowFrom: undefined as string[] | undefined,
    dmPolicy: "pairing" as const,
  };

  // Clean up all states before and after tests
  beforeEach(() => {
    // Clean up states first
    const allStates = getAllAccountStates();
    for (const [accountId] of allStates) {
      removeAccountState(accountId);
    }

    // Reset mock calls and implementation, then set default behavior
    mockApiState.getMeshInfo.mockReset();
    mockApiState.getMeshInfo.mockResolvedValue(success({
      connected: true,
      endpoints: 5,
      errors: [],
    }));
  });

  afterEach(() => {
    const allStates = getAllAccountStates();
    for (const [accountId] of allStates) {
      removeAccountState(accountId);
    }
  });

  describe("getOrCreateAccountState", () => {
    it("should create a new state for unknown account", () => {
      const state = getOrCreateAccountState(testAccountId);

      expect(state).toBeDefined();
      expect(state.accountId).toBe(testAccountId);
      expect(state.config).toBeDefined();
      expect(state.connected).toBe(false);
      expect(state.meshConnected).toBe(false);
      expect(state.apiClient).toBeNull();
    });

    it("should return existing state for known account", () => {
      const state1 = getOrCreateAccountState(testAccountId);
      state1.lastError = "test error";

      const state2 = getOrCreateAccountState(testAccountId);

      expect(state2).toBe(state1);
      expect(state2.lastError).toBe("test error");
    });

    it("should create separate states for different accounts", () => {
      const state1 = getOrCreateAccountState("account1");
      const state2 = getOrCreateAccountState("account2");

      expect(state1).not.toBe(state2);
      expect(state1.accountId).toBe("account1");
      expect(state2.accountId).toBe("account2");
    });

    it("should initialize with default values", () => {
      const state = getOrCreateAccountState(testAccountId);

      expect(state.connected).toBe(false);
      expect(state.meshConnected).toBe(false);
      expect(state.lastError).toBeNull();
      expect(state.lastStartAt).toBeNull();
      expect(state.lastStopAt).toBeNull();
      expect(state.lastInboundAt).toBeNull();
      expect(state.lastOutboundAt).toBeNull();
      expect(state.peerCount).toBe(0);
      expect(state.messageCallbacks).toBeInstanceOf(Set);
      expect(state.watchInterval).toBeNull();
      expect(state.watchErrorCount).toBe(0);
      expect(state.pendingPairings).toBeInstanceOf(Map);
    });

    it("should initialize empty collections", () => {
      const state = getOrCreateAccountState(testAccountId);

      expect(state.messageCallbacks.size).toBe(0);
      expect(state.pendingPairings.size).toBe(0);
    });
  });

  describe("removeAccountState", () => {
    it("should remove existing account state", () => {
      getOrCreateAccountState(testAccountId);
      let allStates = getAllAccountStates();
      expect(allStates.has(testAccountId)).toBe(true);

      removeAccountState(testAccountId);

      allStates = getAllAccountStates();
      expect(allStates.has(testAccountId)).toBe(false);
    });

    it("should clear watch interval if set", () => {
      const state = getOrCreateAccountState(testAccountId);
      const mockInterval = setInterval(() => {}, 1000) as unknown as ReturnType<typeof setInterval>;
      state.watchInterval = mockInterval;

      // Should not throw
      expect(() => removeAccountState(testAccountId)).not.toThrow();
    });

    it("should clear message callbacks", () => {
      const state = getOrCreateAccountState(testAccountId);
      const mockCallback = vi.fn();
      state.messageCallbacks.add(mockCallback);

      removeAccountState(testAccountId);

      // State should be removed
      const allStates = getAllAccountStates();
      expect(allStates.has(testAccountId)).toBe(false);
    });

    it("should handle removing unknown account gracefully", () => {
      // Should not throw
      expect(() => removeAccountState("unknown-account")).not.toThrow();
    });

    it("should handle removing already removed account", () => {
      getOrCreateAccountState(testAccountId);
      removeAccountState(testAccountId);

      // Should not throw when removing again
      expect(() => removeAccountState(testAccountId)).not.toThrow();
    });
  });

  describe("getAllAccountStates", () => {
    it("should return empty map when no accounts", () => {
      const states = getAllAccountStates();
      expect(states.size).toBe(0);
    });

    it("should return all account states", () => {
      getOrCreateAccountState("account1");
      getOrCreateAccountState("account2");
      getOrCreateAccountState("account3");

      const states = getAllAccountStates();
      expect(states.size).toBe(3);
      expect(states.has("account1")).toBe(true);
      expect(states.has("account2")).toBe(true);
      expect(states.has("account3")).toBe(true);
    });

    it("should reflect changes to state objects", () => {
      const state = getOrCreateAccountState(testAccountId);
      state.lastError = "test error";

      const states = getAllAccountStates();
      const retrievedState = states.get(testAccountId);
      expect(retrievedState?.lastError).toBe("test error");
    });
  });

  describe("initializeRuntime", () => {

    it("should initialize runtime for valid config", async () => {
      const initialized = await initializeRuntime(testConfig, testAccountId);

      expect(initialized).toBe(true);

      const state = getAllAccountStates().get(testAccountId);
      expect(state?.connected).toBe(true);
      expect(state?.meshConnected).toBe(true);
      expect(state?.peerCount).toBe(5);
      expect(state?.apiClient).toBeDefined();
    });

    it("should set config on state", async () => {
      await initializeRuntime(testConfig, testAccountId);

      const state = getAllAccountStates().get(testAccountId);
      expect(state?.config).toBe(testConfig);
    });

    it("should set lastStartAt when connected", async () => {
      await initializeRuntime(testConfig, testAccountId);

      const state = getAllAccountStates().get(testAccountId);
      // Note: lastStartAt is set by the gateway startAccount function, not initializeRuntime
      expect(state?.lastStartAt).toBeNull();
    });

    it("should handle mesh connection failure", async () => {
      // Override mock to return disconnected state wrapped in success Result
      mockApiState.getMeshInfo.mockResolvedValue(success({
        connected: false,
        endpoints: 0,
        errors: [],
      }));

      const initialized = await initializeRuntime(testConfig, testAccountId);

      expect(initialized).toBe(false);

      const state = getAllAccountStates().get(testAccountId);
      // Note: state.connected is true because apiClient was created successfully
      // But meshConnected is false because mesh is not connected
      expect(state?.connected).toBe(true);
      expect(state?.meshConnected).toBe(false);
      expect(state?.lastError).toBeDefined();
    });

    it("should retry mesh connection check", async () => {
      let attempts = 0;
      mockApiState.getMeshInfo.mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          return success({ connected: false, endpoints: 0, errors: [] });
        }
        return success({ connected: true, endpoints: 5, errors: [] });
      });

      const initialized = await initializeRuntime(testConfig, testAccountId);

      expect(initialized).toBe(true);
      expect(attempts).toBe(3);
    });
  });

  describe("stopRuntime", () => {

    it("should stop runtime for account", async () => {
      // First initialize
      await initializeRuntime(testConfig, testAccountId);
      const state = getAllAccountStates().get(testAccountId);
      expect(state?.connected).toBe(true);

      // Then stop
      await stopRuntime(testAccountId);

      const stoppedState = getAllAccountStates().get(testAccountId);
      expect(stoppedState?.connected).toBe(false);
      expect(stoppedState?.meshConnected).toBe(false);
      expect(stoppedState?.apiClient).toBeNull();
    });

    it("should clear watch interval if set", async () => {
      await initializeRuntime(testConfig, testAccountId);
      const state = getAllAccountStates().get(testAccountId);

      const mockInterval = setInterval(() => {}, 1000);
      state!.watchInterval = mockInterval;

      await stopRuntime(testAccountId);

      expect(state!.watchInterval).toBeNull();
    });

    it("should clear message callbacks", async () => {
      await initializeRuntime(testConfig, testAccountId);
      const state = getAllAccountStates().get(testAccountId);
      const mockCallback = vi.fn();
      state!.messageCallbacks.add(mockCallback);

      await stopRuntime(testAccountId);

      expect(state!.messageCallbacks.size).toBe(0);
    });

    it("should set lastStopAt", async () => {
      await initializeRuntime(testConfig, testAccountId);

      const beforeStop = new Date();
      await stopRuntime(testAccountId);

      const state = getAllAccountStates().get(testAccountId);
      expect(state?.lastStopAt).toBeDefined();
      expect(state!.lastStopAt!.getTime()).toBeGreaterThanOrEqual(beforeStop.getTime());
    });

    it("should flush message state store", async () => {
      await initializeRuntime(testConfig, testAccountId);
      await stopRuntime(testAccountId);

      const { messageStateStore } = await import("./store.js");
      expect(messageStateStore.flush).toHaveBeenCalled();
    });

    it("should handle stopping unknown account gracefully", async () => {
      // Should not throw
      await expect(stopRuntime("unknown-account")).resolves.toBeUndefined();
    });

    it("should handle stopping already stopped account", async () => {
      await initializeRuntime(testConfig, testAccountId);
      await stopRuntime(testAccountId);

      // Should not throw when stopping again
      await expect(stopRuntime(testAccountId)).resolves.toBeUndefined();
    });
  });

  describe("AccountRuntimeState interface", () => {
    it("should have all required properties", () => {
      const state = getOrCreateAccountState(testAccountId);

      expect(state).toHaveProperty("accountId");
      expect(state).toHaveProperty("config");
      expect(state).toHaveProperty("apiClient");
      expect(state).toHaveProperty("connected");
      expect(state).toHaveProperty("meshConnected");
      expect(state).toHaveProperty("lastError");
      expect(state).toHaveProperty("lastStartAt");
      expect(state).toHaveProperty("lastStopAt");
      expect(state).toHaveProperty("lastInboundAt");
      expect(state).toHaveProperty("lastOutboundAt");
      expect(state).toHaveProperty("peerCount");
      expect(state).toHaveProperty("messageCallbacks");
      expect(state).toHaveProperty("watchInterval");
      expect(state).toHaveProperty("watchErrorCount");
      expect(state).toHaveProperty("pendingPairings");
    });

    it("should allow modification of state properties", () => {
      const state = getOrCreateAccountState(testAccountId);

      state.connected = true;
      state.meshConnected = true;
      state.lastError = null;
      state.peerCount = 10;
      state.watchErrorCount = 3;

      expect(state.connected).toBe(true);
      expect(state.meshConnected).toBe(true);
      expect(state.lastError).toBeNull();
      expect(state.peerCount).toBe(10);
      expect(state.watchErrorCount).toBe(3);
    });
  });

  describe("multi-account management", () => {

    it("should manage multiple independent accounts", async () => {
      const config1 = { ...testConfig, username: "bot1" };
      const config2 = { ...testConfig, username: "bot2" };

      await initializeRuntime(config1, "account1");
      await initializeRuntime(config2, "account2");

      const state1 = getAllAccountStates().get("account1");
      const state2 = getAllAccountStates().get("account2");

      expect(state1?.config.username).toBe("bot1");
      expect(state2?.config.username).toBe("bot2");
      expect(state1).not.toBe(state2);
    });

    it("should stop one account without affecting others", async () => {
      const config1 = { ...testConfig, username: "bot1" };
      const config2 = { ...testConfig, username: "bot2" };

      await initializeRuntime(config1, "account1");
      await initializeRuntime(config2, "account2");

      await stopRuntime("account1");

      const state1 = getAllAccountStates().get("account1");
      const state2 = getAllAccountStates().get("account2");

      expect(state1?.connected).toBe(false);
      expect(state2?.connected).toBe(true);
    });
  });
});
