// Test Helpers - Utility functions for ZTM Chat tests
// Provides common test operations like waiting, cleaning up, assertions, etc.

import { vi, beforeEach, afterEach, expect, describe } from "vitest";
import type { ZTMChatConfig } from "../types/config.js";
import type { ZTMApiClient } from "../api/ztm-api.js";
import { success } from "../types/common.js";

// ============================================================================
// Timer Helpers
// ============================================================================

/**
 * Advance timers by specified milliseconds
 */
export function advanceTimers(ms: number) {
  vi.advanceTimersByTime(ms);
}

/**
 * Run all pending timers
 */
export function runAllTimers() {
  vi.runAllTimers();
}

/**
 * Helper to wait for a condition with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 1000,
  interval = 10
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
}

/**
 * Helper to wait for a promise to settle (with timeout)
 */
export async function waitForPromise<T>(
  promise: Promise<T>,
  timeout = 1000
): Promise<{ settled: boolean; result?: T; error?: unknown }> {
  try {
    const result = await Promise.race([
      promise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeout)),
    ]);
    return { settled: true, result };
  } catch (error) {
    return { settled: true, error };
  }
}

// ============================================================================
// Cleanup Helpers
// ============================================================================

/**
 * Create beforeEach that cleans up test state
 */
export function createBeforeEach(cleanup: () => void | Promise<void>) {
  beforeEach(async () => {
    cleanup();
    vi.clearAllMocks();
  });
}

/**
 * Create afterEach that cleans up test state
 */
export function createAfterEach(cleanup: () => void | Promise<void>) {
  afterEach(async () => {
    cleanup();
    vi.restoreAllMocks();
  });
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that a function throws an error
 */
export async function expectToThrow(fn: () => unknown | Promise<unknown>, expectedMessage?: string) {
  let threw = false;
  let error: unknown;
  try {
    await fn();
  } catch (e) {
    threw = true;
    error = e;
  }
  expect(threw).toBe(true);
  if (expectedMessage && error instanceof Error) {
    expect(error.message).toContain(expectedMessage);
  }
}

/**
 * Assert that a value is a success Result
 */
export function expectSuccess<T>(result: { ok: boolean; value?: T; error?: unknown }) {
  expect(result.ok).toBe(true);
  expect(result.value).toBeDefined();
}

/**
 * Assert that a value is a failure Result
 */
export function expectFailure<E>(result: { ok: boolean; value?: unknown; error?: E }) {
  expect(result.ok).toBe(false);
  expect(result.error).toBeDefined();
}

// ============================================================================
// Test Setup Helpers
// ============================================================================

/**
 * Setup fake timers for a test
 */
export function setupFakeTimers() {
  vi.useFakeTimers();
}

/**
 * Restore real timers
 */
export function restoreTimers() {
  vi.useRealTimers();
}

/**
 * Create a test with fake timers
 */
export function describeWithTimers(name: string, fn: () => void) {
  describe(name, () => {
    beforeEach(() => setupFakeTimers());
    afterEach(() => restoreTimers());
    fn();
  });
}

// ============================================================================
// Async Test Helpers
// ============================================================================

/**
 * Helper to flush promises in tests
 */
export function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Helper to wait for next tick
 */
export function nextTick() {
  return new Promise((resolve) => process.nextTick(resolve));
}

/**
 * Helper to wait for a specific amount of time
 */
export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Object Helpers
// ============================================================================

/**
 * Deep clone an object for testing
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Partial clone - only clone top level
 */
export function shallowClone<T extends object>(obj: T): T {
  return { ...obj };
}

// ============================================================================
// Array Helpers
// ============================================================================

/**
 * Create a range of numbers for testing
 */
export function range(start: number, end: number, step = 1): number[] {
  const result: number[] = [];
  for (let i = start; i < end; i += step) {
    result.push(i);
  }
  return result;
}

/**
 * Generate unique items for testing
 */
export function uniqueItems<T>(count: number, generator: (i: number) => T): T[] {
  return Array.from({ length: count }, (_, i) => generator(i));
}

// ============================================================================
// Account State Helpers
// ============================================================================

/**
 * Import and clean account states
 */
export async function cleanupAccountStates() {
  try {
    const { getAllAccountStates, removeAccountState } = await import("../runtime/state.js");
    const states = getAllAccountStates();
    for (const [accountId] of states) {
      removeAccountState(accountId);
    }
  } catch {
    // Module might not be available in all tests
  }
}

// ============================================================================
// Config Helpers
// ============================================================================

/**
 * Create a minimal config for testing
 */
export function minimalConfig(overrides: Partial<ZTMChatConfig> = {}): ZTMChatConfig {
  return {
    agentUrl: "http://localhost:7777",
    permitUrl: "http://localhost:7777/permit",
    meshName: "test-mesh",
    username: "test-bot",
    dmPolicy: "pairing",
    enableGroups: false,
    autoReply: false,
    messagePath: "/shared",
    ...overrides,
  };
}

/**
 * Create a config that will fail API calls
 */
export function failingConfig(): ZTMChatConfig {
  return {
    agentUrl: "http://invalid-host:9999",
    permitUrl: "http://invalid-host:9999/permit",
    meshName: "test-mesh",
    username: "test-bot",
    dmPolicy: "pairing",
    enableGroups: false,
    autoReply: false,
    messagePath: "/shared",
  };
}

// ============================================================================
// API Client Helpers
// ============================================================================

/**
 * Create a config for test client
 */
export function createTestClientConfig(baseUrl: string, meshName = "test-mesh", username = "test-bot"): ZTMChatConfig {
  return {
    agentUrl: baseUrl,
    permitUrl: `${baseUrl}/permit`,
    meshName,
    username,
    dmPolicy: "pairing",
    enableGroups: false,
    autoReply: false,
    messagePath: "/shared",
  };
}

/**
 * Wait for API to be called
 */
export async function waitForApiCall(
  apiCall: () => unknown,
  checkInterval = 10,
  timeout = 1000
): Promise<boolean> {
  return waitFor(() => {
    try {
      apiCall();
      return true;
    } catch {
      return false;
    }
  }, timeout, checkInterval);
}

// ============================================================================
// Snapshot Helpers
// ============================================================================

/**
 * Create a stable snapshot of an object for comparison
 */
export function stableSnapshot(obj: unknown): string {
  if (typeof obj !== 'object' || obj === null) {
    return JSON.stringify(obj);
  }
  return JSON.stringify(obj, Object.keys(obj as object).sort());
}

/**
 * Compare snapshots
 */
export function snapshotsEqual(a: unknown, b: unknown): boolean {
  return stableSnapshot(a) === stableSnapshot(b);
}
