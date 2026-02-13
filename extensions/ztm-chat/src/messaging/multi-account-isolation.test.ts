// Integration tests for Multi-Account Isolation

import { describe, it, expect, vi } from "vitest";
import type { AccountRuntimeState } from "../runtime/state.js";

describe("Multi-Account Isolation", () => {
  const createAccountState = (accountId: string): AccountRuntimeState => ({
    accountId,
    config: {
      agentUrl: "https://example.com:7777",
      permitUrl: "https://example.com/permit",
      meshName: "test-mesh",
      username: `bot-${accountId}`,
      enableGroups: false,
      autoReply: true,
      messagePath: "/shared",
      allowFrom: [],
      dmPolicy: "pairing",
    },
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
  });

  it("should isolate pendingPairings per account", () => {
    const account1 = createAccountState("account1");
    const account2 = createAccountState("account2");

    account1.pendingPairings.set("alice", new Date());
    account2.pendingPairings.set("bob", new Date());

    expect(account1.pendingPairings.has("alice")).toBe(true);
    expect(account1.pendingPairings.has("bob")).toBe(false);
    expect(account2.pendingPairings.has("alice")).toBe(false);
    expect(account2.pendingPairings.has("bob")).toBe(true);
  });

  it("should isolate messageCallbacks per account", () => {
    const account1 = createAccountState("account1");
    const account2 = createAccountState("account2");

    const callback1 = vi.fn();
    const callback2 = vi.fn();

    account1.messageCallbacks.add(callback1);
    account2.messageCallbacks.add(callback2);

    expect(account1.messageCallbacks.has(callback1)).toBe(true);
    expect(account1.messageCallbacks.has(callback2)).toBe(false);
    expect(account2.messageCallbacks.has(callback1)).toBe(false);
    expect(account2.messageCallbacks.has(callback2)).toBe(true);
  });

  it("should isolate watchErrorCount per account", () => {
    const account1 = createAccountState("account1");
    const account2 = createAccountState("account2");

    account1.watchErrorCount = 5;
    account2.watchErrorCount = 2;

    expect(account1.watchErrorCount).toBe(5);
    expect(account2.watchErrorCount).toBe(2);
  });

  it("should isolate connection state per account", () => {
    const account1 = createAccountState("account1");
    const account2 = createAccountState("account2");

    account1.connected = false;
    account2.connected = true;
    account1.meshConnected = false;
    account2.meshConnected = true;

    expect(account1.connected).toBe(false);
    expect(account1.meshConnected).toBe(false);
    expect(account2.connected).toBe(true);
    expect(account2.meshConnected).toBe(true);
  });

  it("should handle same user in different accounts", () => {
    const account1 = createAccountState("account1");
    const account2 = createAccountState("account2");

    const sender = "alice";
    account1.pendingPairings.set(sender, new Date());

    expect(account1.pendingPairings.has(sender)).toBe(true);
    expect(account2.pendingPairings.has(sender)).toBe(false);
  });
});
