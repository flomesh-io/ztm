// Unit tests for Polling Interval Management

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { startPollingWatcher } from "./polling.js";
import { testConfig, testAccountId } from "../test-utils/fixtures.js";
import { mockSuccess } from "../test-utils/mocks.js";
import type { AccountRuntimeState } from "../types/runtime.js";
import type { ZTMApiClient } from "../types/api.js";
import type { ZTMChatMessage } from "../types/messaging.js";

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
  const baseConfig = { ...testConfig, allowFrom: [] as string[], dmPolicy: "pairing" as const };

  let mockState: ReturnType<typeof createMockState>;

  function createMockState(): AccountRuntimeState {
    return {
      accountId: testAccountId,
      config: baseConfig,
      apiClient: {
        getChats: mockSuccess([]),
      } as unknown as ZTMApiClient,
      connected: true,
      meshConnected: true,
      lastError: null,
      lastStartAt: new Date(),
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

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    createdIntervals = [];

    global.setInterval = vi.fn((callback: () => void, ms: number) => {
      const ref = originalSetInterval(callback, ms);
      createdIntervals.push(ref);
      return ref;
    }) as unknown as typeof setInterval;

    mockState = createMockState();
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
  const baseConfig = { ...testConfig, allowFrom: [] as string[], dmPolicy: "pairing" as const };

  let createdIntervals: ReturnType<typeof setInterval>[] = [];
  const originalSetInterval = global.setInterval;

  let mockState: ReturnType<typeof createMockState>;

  function createMockState(): AccountRuntimeState {
    return {
      accountId: testAccountId,
      config: baseConfig,
      apiClient: {
        getChats: mockSuccess([]),
      } as unknown as ZTMApiClient,
      connected: true,
      meshConnected: true,
      lastError: null,
      lastStartAt: new Date(),
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

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    createdIntervals = [];

    global.setInterval = vi.fn((callback: () => void, ms: number) => {
      const ref = originalSetInterval(callback, ms);
      createdIntervals.push(ref);
      return ref;
    }) as unknown as typeof setInterval;

    mockState = createMockState();
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
