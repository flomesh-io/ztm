// Unit tests for Polling Configuration Edge Cases

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { startPollingWatcher } from "./polling.js";
import type { AccountRuntimeState } from "../runtime/state.js";
import type { ZTMChatConfig } from "../types/config.js";
import type { ZTMApiClient } from "../types/api.js";
import { success } from "../types/common.js";

type ExtendedConfig = ZTMChatConfig & { pollingInterval?: number; [key: string]: unknown };

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
    vi.clearAllMocks();
    createdIntervals = [];

    global.setInterval = vi.fn((callback: () => void, ms: number) => {
      const ref = originalSetInterval(callback, Math.min(ms, 100));
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
