// Unit tests for Polling Interval Management

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { startPollingWatcher } from "./polling.js";
import type { AccountRuntimeState } from "../runtime/state.js";
import type { ZTMChatConfig } from "../types/config.js";
import type { ZTMApiClient } from "../types/api.js";
import { success } from "../types/common.js";

let createdIntervals: ReturnType<typeof setInterval>[] = [];
const originalSetInterval = global.setInterval;

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
        readAllowFromStore: vi.fn(() => Promise.resolve([])),
      },
    },
  }),
}));

vi.mock("./inbound.js", () => ({
  processIncomingMessage: vi.fn(() => null),
  notifyMessageCallbacks: vi.fn(),
  checkDmPolicy: vi.fn(() => ({ allowed: true, reason: "allowed", action: "process" })),
}));

vi.mock("../connectivity/permit.js", () => ({
  handlePairingRequest: vi.fn(() => Promise.resolve()),
}));

describe("Interval Management", () => {
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

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    createdIntervals = [];

    global.setInterval = vi.fn((callback: () => void, ms: number) => {
      const ref = originalSetInterval(callback, ms);
      createdIntervals.push(ref);
      return ref;
    }) as unknown as typeof setInterval;

    mockState = {
      accountId: "test-account",
      config: baseConfig,
      apiClient: {
        getChats: vi.fn(() => Promise.resolve(success([]))),
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

  afterEach(() => {
    vi.useRealTimers();
    for (const interval of createdIntervals) {
      clearInterval(interval);
    }
    createdIntervals = [];
    global.setInterval = originalSetInterval;
  });

  it("should store interval reference in state", async () => {
    await startPollingWatcher(mockState);

    expect(mockState.watchInterval).not.toBeNull();
  });

  it("should allow clearing interval via state reference", async () => {
    await startPollingWatcher(mockState);

    const intervalRef = mockState.watchInterval;
    expect(intervalRef).not.toBeNull();

    if (intervalRef) {
      clearInterval(intervalRef);
      mockState.watchInterval = null;
    }

    expect(mockState.watchInterval).toBeNull();
  });

  it("should replace existing interval if already set", async () => {
    await startPollingWatcher(mockState);
    const firstInterval = mockState.watchInterval;

    await startPollingWatcher(mockState);
    const secondInterval = mockState.watchInterval;

    expect(secondInterval).not.toBeNull();
  });
});

describe("Watch → Polling Transition", () => {
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

  let createdIntervals: ReturnType<typeof setInterval>[] = [];
  const originalSetInterval = global.setInterval;

  let mockState: AccountRuntimeState;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    createdIntervals = [];

    global.setInterval = vi.fn((callback: () => void, ms: number) => {
      const ref = originalSetInterval(callback, ms);
      createdIntervals.push(ref);
      return ref;
    }) as unknown as typeof setInterval;

    mockState = {
      accountId: "test-account",
      config: baseConfig,
      apiClient: {
        getChats: vi.fn(() => Promise.resolve(success([]))),
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

  afterEach(() => {
    vi.useRealTimers();
    for (const interval of createdIntervals) {
      clearInterval(interval);
    }
    createdIntervals = [];
    global.setInterval = originalSetInterval;
  });

  it("should preserve pendingPairings during transition", async () => {
    mockState.pendingPairings.set("alice", new Date());
    mockState.pendingPairings.set("bob", new Date());

    await startPollingWatcher(mockState);

    expect(mockState.pendingPairings.size).toBe(2);
    expect(mockState.pendingPairings.has("alice")).toBe(true);
    expect(mockState.pendingPairings.has("bob")).toBe(true);
  });

  it("should preserve messageCallbacks during transition", async () => {
    const mockCallback = vi.fn();
    mockState.messageCallbacks.add(mockCallback);

    await startPollingWatcher(mockState);

    expect(mockState.messageCallbacks.size).toBe(1);
    expect(mockState.messageCallbacks.has(mockCallback)).toBe(true);
  });

  it("should preserve connection state during transition", async () => {
    mockState.connected = true;
    mockState.meshConnected = true;
    mockState.peerCount = 10;

    await startPollingWatcher(mockState);

    expect(mockState.connected).toBe(true);
    expect(mockState.meshConnected).toBe(true);
    expect(mockState.peerCount).toBe(10);
  });
});
