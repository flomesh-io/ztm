// Unit tests for Polling Configuration Edge Cases

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { startPollingWatcher } from "./polling.js";
import { testConfig, testAccountId } from "../test-utils/fixtures.js";
import { mockSuccess } from "../test-utils/mocks.js";
import type { AccountRuntimeState } from "../types/runtime.js";
import type { ZTMApiClient } from "../types/api.js";
import type { ZTMChatMessage } from "../types/messaging.js";

type ExtendedConfig = typeof testConfig & { pollingInterval?: number; [key: string]: unknown };

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

describe("Configuration Edge Cases", () => {
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

  it("should handle undefined pollingInterval", async () => {
    mockState.config = { ...baseConfig };

    await startPollingWatcher(mockState);

    expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 2000);
  });

  it("should handle zero pollingInterval", async () => {
    mockState.config = { ...baseConfig, pollingInterval: 0 } as ExtendedConfig;

    await startPollingWatcher(mockState);

    expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 1000);
  });

  it("should handle negative pollingInterval", async () => {
    mockState.config = { ...baseConfig, pollingInterval: -1000 } as ExtendedConfig;

    await startPollingWatcher(mockState);

    expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 1000);
  });

  it("should handle very large pollingInterval", async () => {
    mockState.config = { ...baseConfig, pollingInterval: 60000 } as ExtendedConfig;

    await startPollingWatcher(mockState);

    expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 60000);
  });
});
