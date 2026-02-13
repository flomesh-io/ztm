// Test Mocks - Reusable mock functions and objects for ZTM Chat tests
// Provides mock implementations for API clients, loggers, stores, etc.

import { vi, type Mock } from "vitest";
import type { ZTMChatConfig } from "../types/config.js";
import type { ZTMApiClient } from "../api/ztm-api.js";
import { success, failure } from "../types/common.js";
import type { ZTMMessage, ZTMChat, ZTMPeer, ZTMUserInfo, ZTMMeshInfo } from "../api/ztm-api.js";

// ============================================================================
// Logger Mocks
// ============================================================================

/**
 * Create a mock logger that tracks all calls
 */
export function createMockLogger() {
  const calls: { level: string; args: unknown[][] }[] = [];

  const log = (level: string) => (...args: unknown[]) => {
    calls.push({
      level,
      args: args.map((a) => (typeof a === "object" ? JSON.parse(JSON.stringify(a)) : a)),
    });
  };

  return {
    debug: log("debug"),
    info: log("info"),
    warn: log("warn"),
    error: log("error"),
    calls,
    getCalls: (level?: string) => (level ? calls.filter((c) => c.level === level) : calls),
    clearCalls: () => calls.length = 0,
  };
}

/**
 * Create a mock logger with all methods as vitest.fn()
 */
export function createMockLoggerFns() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

// ============================================================================
// Fetch Mocks
// ============================================================================

export interface MockFetchOptions {
  data?: unknown;
  status?: number;
  error?: Error;
}

/**
 * Create a mock fetch function
 */
export function createMockFetch(options: MockFetchOptions = {}) {
  const { data = null, status = 200, error } = options;
  const calls: { url: string; options: RequestInit }[] = [];

  const mockFn = async (url: string, options?: RequestInit): Promise<Response> => {
    calls.push({ url, options: options || {} });

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };

  return {
    fetch: mockFn as typeof fetch,
    calls,
    mockResponse: (newData: unknown, newStatus = 200) => {
      Object.assign(options, { data: newData, status: newStatus });
    },
    mockError: (err: Error) => {
      Object.assign(options, { error: err });
    },
  };
}

// ============================================================================
// API Client Mocks
// ============================================================================

/**
 * Create a mock API client with default success responses
 */
export function createMockApiClient(overrides: Partial<ZTMApiClient> = {}): ZTMApiClient {
  const defaultClient: ZTMApiClient = {
    getMeshInfo: vi.fn().mockResolvedValue(success({ name: "test-mesh", connected: true, endpoints: 1 })),
    discoverUsers: vi.fn().mockResolvedValue(success([])),
    discoverPeers: vi.fn().mockResolvedValue(success([])),
    listUsers: vi.fn().mockResolvedValue(success([])),
    getChats: vi.fn().mockResolvedValue(success([])),
    getPeerMessages: vi.fn().mockResolvedValue(success([])),
    sendPeerMessage: vi.fn().mockResolvedValue(success(true)),
    watchChanges: vi.fn().mockResolvedValue(success([])),
    getGroupMessages: vi.fn().mockResolvedValue(success([])),
    sendGroupMessage: vi.fn().mockResolvedValue(success(true)),
    seedFileMetadata: vi.fn(),
    exportFileMetadata: vi.fn().mockReturnValue({}),
  };

  return { ...defaultClient, ...overrides };
}

/**
 * Create a mock API client that returns specific messages
 */
export function createMockApiClientWithMessages(messages: ZTMMessage[], peer = "alice"): ZTMApiClient {
  return createMockApiClient({
    getPeerMessages: vi.fn().mockResolvedValue(success(messages)),
    getChats: vi.fn().mockResolvedValue(
      success([
        {
          peer,
          time: messages[0]?.time || Date.now(),
          updated: messages[messages.length - 1]?.time || Date.now(),
          latest: messages[messages.length - 1],
        },
      ])
    ),
  });
}

/**
 * Create a mock API client that returns specific chats
 */
export function createMockApiClientWithChats(chats: ZTMChat[]): ZTMApiClient {
  return createMockApiClient({
    getChats: vi.fn().mockResolvedValue(success(chats)),
  });
}

// ============================================================================
// Store Mocks
// ============================================================================

/**
 * Create a mock message state store
 */
export function createMockMessageStateStore() {
  const watermarks = new Map<string, number>();
  const fileMetadata = new Map<string, { time: number; size: number }>();

  return {
    getWatermark: vi.fn((accountId: string, peer: string) => watermarks.get(`${accountId}:${peer}`) || 0),
    getGlobalWatermark: vi.fn((accountId: string) => {
      const accountWatermarks = Array.from(watermarks.entries()).filter(([k]) => k.startsWith(`${accountId}:`));
      return accountWatermarks.length > 0 ? Math.max(...accountWatermarks.map(([, v]) => v)) : 0;
    }),
    setWatermark: vi.fn((accountId: string, peer: string, time: number) => {
      watermarks.set(`${accountId}:${peer}`, time);
    }),
    getFileMetadata: vi.fn(() => Object.fromEntries(fileMetadata)),
    setFileMetadata: vi.fn((accountId: string, filePath: string, metadata: { time: number; size: number }) => {
      fileMetadata.set(filePath, metadata);
    }),
    setFileMetadataBulk: vi.fn(),
    flush: vi.fn(),
    dispose: vi.fn(),
    // Internal for testing
    _watermarks: watermarks,
    _fileMetadata: fileMetadata,
  };
}

/**
 * Create a mock pairing store
 */
export function createMockPairingStore() {
  const pairings = new Map<string, { code: string; created: number }>();

  return {
    loadPendingPairings: vi.fn(() => new Map()),
    savePendingPairing: vi.fn((id: string, code: string) => {
      pairings.set(id, { code, created: Date.now() });
    }),
    deletePendingPairing: vi.fn((id: string) => pairings.delete(id)),
    cleanupExpiredPairings: vi.fn(() => 0),
    flush: vi.fn(),
    dispose: vi.fn(),
    _pairings: pairings,
  };
}

// ============================================================================
// Runtime State Mocks
// ============================================================================

/**
 * Create a mock account runtime state
 */
export function createMockAccountState(config: ZTMChatConfig, apiClient?: ZTMApiClient) {
  return {
    accountId: "test-account",
    config,
    apiClient: apiClient || createMockApiClient(),
    runtime: {
      started: true,
      stopped: false,
    },
    metrics: {
      messagesProcessed: 0,
      errors: 0,
    },
  };
}

// ============================================================================
// Error Mocks
// ============================================================================

/**
 * Create a mock API error
 */
export function createMockApiError(message = "API Error") {
  return {
    message,
    code: "API_ERROR",
    statusCode: 500,
  };
}

// ============================================================================
// vi.fn() Shortcuts
// ============================================================================

/**
 * Create a resolved success mock
 */
export function mockSuccess<T>(value: T) {
  return vi.fn().mockResolvedValue(success(value));
}

/**
 * Create a resolved failure mock
 */
export function mockFailure<E extends Error>(error: E) {
  return vi.fn().mockResolvedValue(failure(error));
}

/**
 * Create an async mock that resolves
 */
export function mockResolved<T>(value: T) {
  return vi.fn().mockResolvedValue(value);
}

/**
 * Create an async mock that rejects
 */
export function mockRejected(error: Error) {
  return vi.fn().mockRejectedValue(error);
}
