// Unit tests for Channel Gateway

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { OpenClawConfig } from "openclaw/plugin-sdk";
import type { ZTMChatConfig, ZTMMeshInfo, ZTMMessage } from "../types/index.js";
import type { ZTMChatMessage } from "../messaging/inbound.js";
import type { AccountRuntimeState } from "../runtime/state.js";
import {
  collectStatusIssues,
  probeAccountGateway,
  sendTextGateway,
  startAccountGateway,
  logoutAccountGateway,
  buildMessageCallback,
} from "./gateway.js";

// Mock all dependencies using vi.hoisted
const { mockResolveZTMChatConfig, mockValidateZTMChatConfig, mockGetDefaultConfig } = vi.hoisted(() => ({
  mockResolveZTMChatConfig: vi.fn((config) => config),
  mockValidateZTMChatConfig: vi.fn(() => ({ valid: true, errors: [] })),
  mockGetDefaultConfig: vi.fn(() => ({
    agentUrl: "http://localhost:7777",
    permitUrl: "https://ztm-portal.flomesh.io:7779/permit",
    meshName: "openclaw-mesh",
    username: "openclaw-bot",
    enableGroups: false,
    autoReply: true,
    messagePath: "/shared",
    dmPolicy: "pairing",
  })),
}));

const { mockIsConfigMinimallyValid } = vi.hoisted(() => ({
  mockIsConfigMinimallyValid: vi.fn((config) => !!config?.agentUrl && !!config?.username),
}));

const { mockCreateZTMApiClient } = vi.hoisted(() => ({
  mockCreateZTMApiClient: vi.fn(() => ({
    getMeshInfo: vi.fn().mockResolvedValue({ ok: true, value: { connected: true, peers: 5 } }),
    sendPeerMessage: vi.fn().mockResolvedValue({ ok: true, value: null }),
  })),
}));

const { mockGetAllAccountStates, mockInitializeRuntime, mockStopRuntime, mockRemoveAccountState } = vi.hoisted(() => ({
  mockGetAllAccountStates: vi.fn().mockReturnValue(new Map()),
  mockInitializeRuntime: vi.fn().mockResolvedValue(true),
  mockStopRuntime: vi.fn().mockResolvedValue(undefined),
  mockRemoveAccountState: vi.fn(),
}));

const { mockSendZTMMessage, mockGenerateMessageId } = vi.hoisted(() => ({
  mockSendZTMMessage: vi.fn().mockResolvedValue({ ok: true }),
  mockGenerateMessageId: vi.fn(() => "msg-123"),
}));

const { mockCheckPortOpen, mockGetPublicKeyFromIdentity, mockJoinMesh } = vi.hoisted(() => ({
  mockCheckPortOpen: vi.fn().mockResolvedValue(true),
  mockGetPublicKeyFromIdentity: vi.fn().mockResolvedValue("public-key-123"),
  mockJoinMesh: vi.fn().mockResolvedValue(true),
}));

const { mockRequestPermit, mockSavePermitData } = vi.hoisted(() => ({
  mockRequestPermit: vi.fn().mockResolvedValue({ token: "permit-token" }),
  mockSavePermitData: vi.fn().mockReturnValue(true),
}));

const { mockStartMessageWatcher } = vi.hoisted(() => ({
  mockStartMessageWatcher: vi.fn().mockResolvedValue(undefined),
}));

const { mockGetZTMRuntime } = vi.hoisted(() => ({
  mockGetZTMRuntime: vi.fn(() => ({
    channel: {
      routing: {
        resolveAgentRoute: vi.fn(() => ({
          sessionKey: "session-123",
          agentId: "agent-456",
          matchedBy: "test-route",
        })),
      },
      reply: {
        finalizeInboundContext: vi.fn((ctx) => ctx),
        dispatchReplyWithBufferedBlockDispatcher: vi.fn().mockResolvedValue({ queuedFinal: true }),
        resolveHumanDelayConfig: vi.fn(() => ({ delay: 0 })),
      },
    },
  })),
}));

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../config/index.js", () => ({
  resolveZTMChatConfig: mockResolveZTMChatConfig,
  validateZTMChatConfig: mockValidateZTMChatConfig,
  getDefaultConfig: mockGetDefaultConfig,
}));

vi.mock("../config/validation.js", () => ({
  isConfigMinimallyValid: mockIsConfigMinimallyValid,
}));

vi.mock("../api/ztm-api.js", () => ({
  createZTMApiClient: mockCreateZTMApiClient,
}));

vi.mock("../runtime/state.js", () => ({
  getAllAccountStates: mockGetAllAccountStates,
  initializeRuntime: mockInitializeRuntime,
  stopRuntime: mockStopRuntime,
  removeAccountState: mockRemoveAccountState,
}));

vi.mock("../messaging/outbound.js", () => ({
  sendZTMMessage: mockSendZTMMessage,
  generateMessageId: mockGenerateMessageId,
}));

vi.mock("../connectivity/mesh.js", () => ({
  checkPortOpen: mockCheckPortOpen,
  getPublicKeyFromIdentity: mockGetPublicKeyFromIdentity,
  joinMesh: mockJoinMesh,
}));

vi.mock("../connectivity/permit.js", () => ({
  requestPermit: mockRequestPermit,
  savePermitData: mockSavePermitData,
}));

vi.mock("../messaging/inbound.js", () => ({
  startMessageWatcher: mockStartMessageWatcher,
}));

vi.mock("../runtime/index.js", () => ({
  getZTMRuntime: mockGetZTMRuntime,
}));

vi.mock("../utils/logger.js", () => ({
  logger: mockLogger,
}));

const { mockResolveZTMChatAccount } = vi.hoisted(() => ({
  mockResolveZTMChatAccount: vi.fn(({ cfg, accountId }) => {
    const accountKey = accountId ?? "default";
    const accountConfig = cfg?.accounts?.[accountKey] || cfg?.accounts?.default || {};
    return {
      accountId: accountKey,
      username: accountConfig.username || "",
      enabled: true,
      config: {
        agentUrl: accountConfig.agentUrl || "",
        permitUrl: accountConfig.permitUrl || "",
        meshName: accountConfig.meshName || "",
        username: accountConfig.username || "",
        enableGroups: accountConfig.enableGroups ?? false,
        autoReply: accountConfig.autoReply ?? true,
        messagePath: accountConfig.messagePath || "/shared",
        dmPolicy: accountConfig.dmPolicy || "pairing",
        allowFrom: accountConfig.allowFrom,
      },
    };
  }),
}));

const { mockGetEffectiveChannelConfig } = vi.hoisted(() => ({
  mockGetEffectiveChannelConfig: vi.fn((cfg) => {
    if (!cfg) return null;
    return cfg.channels?.["ztm-chat"] || null;
  }),
}));

vi.mock("./config.js", () => ({
  resolveZTMChatAccount: mockResolveZTMChatAccount,
  getEffectiveChannelConfig: mockGetEffectiveChannelConfig,
}));

const { mockFsExistsSync } = vi.hoisted(() => ({
  mockFsExistsSync: vi.fn(),
}));

const { mockPathJoin } = vi.hoisted(() => ({
  mockPathJoin: vi.fn((...args: string[]) => args.join("/")),
}));

vi.mock("fs", () => ({
  existsSync: mockFsExistsSync,
}));

vi.mock("node:path", () => ({
  join: mockPathJoin,
}));

describe("Channel Gateway", () => {
  let mockConfig: ZTMChatConfig;
  let mockState: AccountRuntimeState;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock return values for each test
    // Initialize mockState first so it can be used by other beforeEach hooks
    mockConfig = {
      agentUrl: "https://example.com:7777",
      permitUrl: "https://example.com/permit",
      meshName: "test-mesh",
      username: "test-bot",
      enableGroups: false,
      autoReply: true,
      messagePath: "/shared",
      dmPolicy: "pairing",
      allowFrom: undefined,
    };

    mockState = {
      accountId: "test-account",
      config: mockConfig,
      apiClient: {
        getMeshInfo: vi.fn().mockResolvedValue({ ok: true, value: { connected: true, peers: 5 } }),
        sendPeerMessage: vi.fn().mockResolvedValue({ ok: true, value: null }),
      },
      connected: true,
      meshConnected: true,
      lastError: null,
      messageCallbacks: new Set(),
      pendingPairings: new Map(),
    } as any;

    // Set default mock for getAllAccountStates
    mockGetAllAccountStates.mockReturnValue(
      new Map([["default", mockState]])
    );

    // Don't call mockClear() here - it will be called in afterEach
    // and this will interfere with nested describe blocks' beforeEach

    process.env.HOME = "/test/home";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("collectStatusIssues", () => {
    beforeEach(() => {
      // Reset to default - validation errors should be detected
      // Use mockImplementation to check config properties
      mockIsConfigMinimallyValid.mockReset();
      mockIsConfigMinimallyValid.mockImplementation((config: any) => {
        return !!(config?.agentUrl && config?.username);
      });
    });

    it("should return empty array for valid config", () => {
      // Override mock to return true for this specific test
      mockIsConfigMinimallyValid.mockReturnValueOnce(true);

      const cfgWithAccounts = {
        channels: {
          "ztm-chat": {
            ...mockConfig,
            accounts: { test: mockConfig },
          },
        },
      };
      const accounts = [{ accountId: "test", config: mockConfig, cfg: cfgWithAccounts } as any];

      const result = collectStatusIssues(accounts);

      expect(result).toEqual([]);
    });

    it("should return error for missing agentUrl", () => {
      const invalidConfig = { ...mockConfig, agentUrl: "" };
      const accounts = [{ accountId: "test", config: invalidConfig } as any];

      const result = collectStatusIssues(accounts);

      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe("config");
      expect(result[0].level).toBe("error");
      expect(result[0].message).toContain("Missing required configuration");
    });

    it("should return error for missing username", () => {
      const invalidConfig = { ...mockConfig, username: "" };
      const accounts = [{ accountId: "test", config: invalidConfig } as any];

      const result = collectStatusIssues(accounts);

      expect(result).toHaveLength(1);
      expect(result[0].accountId).toBe("test");
    });

    it("should return error for both missing agentUrl and username", () => {
      const invalidConfig = { agentUrl: "", username: "" };
      const accounts = [{ accountId: "test", config: invalidConfig } as any];

      const result = collectStatusIssues(accounts);

      expect(result).toHaveLength(1);
      expect(result[0].message).toContain("agentUrl");
      expect(result[0].message).toContain("username");
    });

    it("should handle empty accounts array", () => {
      const result = collectStatusIssues([]);

      expect(result).toEqual([]);
    });

    it("should handle missing accountId", () => {
      const accounts = [{} as any];

      const result = collectStatusIssues(accounts);

      expect(result[0].accountId).toBe("default");
    });
  });

  describe("probeAccountGateway", () => {
    it("should return ok: true for connected mesh", async () => {
      const account = { config: mockConfig };

      const result = await probeAccountGateway({ account });

      expect(result.ok).toBe(true);
      expect(result.error).toBeNull();
      expect(result.meshInfo?.connected).toBe(true);
    });

    it("should return error when no agentUrl configured", async () => {
      const account = { config: { ...mockConfig, agentUrl: "" } };

      const result = await probeAccountGateway({ account });

      expect(result.ok).toBe(false);
      expect(result.error).toBe("No agent URL configured");
      expect(result.meshInfo).toBeUndefined();
    });

    it("should return error when mesh info fails", async () => {
      const mockClient = {
        getMeshInfo: vi.fn().mockResolvedValue({
          ok: false,
          error: new Error("Mesh info failed"),
        }),
      };
      const { createZTMApiClient } = await import("../api/ztm-api.js");
      (createZTMApiClient as any).mockReturnValue(mockClient);

      const account = { config: mockConfig };

      const result = await probeAccountGateway({ account });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Mesh info failed");
    });

    it("should return error when mesh not connected", async () => {
      const mockClient = {
        getMeshInfo: vi.fn().mockResolvedValue({
          ok: true,
          value: { connected: false, peers: 0 },
        }),
      };
      const { createZTMApiClient } = await import("../api/ztm-api.js");
      (createZTMApiClient as any).mockReturnValue(mockClient);

      const account = { config: mockConfig };

      const result = await probeAccountGateway({ account });

      expect(result.ok).toBe(false);
      expect(result.error).toBe("ZTM Agent is not connected to mesh");
    });

    it("should use default timeout", async () => {
      const account = { config: mockConfig };

      await probeAccountGateway({ account, timeoutMs: undefined });

      // Verify it doesn't throw with undefined timeout
      expect(true).toBe(true);
    });

    it("should handle custom timeout", async () => {
      const account = { config: mockConfig };

      await probeAccountGateway({ account, timeoutMs: 5000 });

      // Verify it doesn't throw with custom timeout
      expect(true).toBe(true);
    });
  });

  describe("sendTextGateway", () => {
    it("should send message successfully", async () => {
      const { getAllAccountStates } = await import("../runtime/state.js");
      (getAllAccountStates as any).mockReturnValueOnce(
        new Map([["default", mockState]])
      );

      const result = await sendTextGateway({
        to: "peer-user",
        text: "Hello, world!",
      });

      expect(result.channel).toBe("ztm-chat");
      expect(result.ok).toBe(true);
      expect(result.messageId).toBeTruthy();
      expect(result.error).toBeUndefined();
    });

    it("should strip ztm-chat prefix from peer", async () => {
      const { getAllAccountStates } = await import("../runtime/state.js");
      (getAllAccountStates as any).mockReturnValueOnce(
        new Map([["default", mockState]])
      );

      const result = await sendTextGateway({
        to: "ztm-chat:peer-user",
        text: "test",
      });

      expect(result.ok).toBe(true);
    });

    it("should return error when account not initialized", async () => {
      const { getAllAccountStates } = await import("../runtime/state.js");
      // Use mockReturnValueOnce so the default mockReturnValue from beforeEach is restored after
      (getAllAccountStates as any).mockReturnValueOnce(new Map());

      const result = await sendTextGateway({
        to: "peer-user",
        text: "test",
      });

      expect(result.channel).toBe("ztm-chat");
      expect(result.ok).toBe(false);
      expect(result.error).toBe("Account not initialized");
      expect(result.messageId).toBe("");
    });

    it("should use specific accountId", async () => {
      const { getAllAccountStates } = await import("../runtime/state.js");
      (getAllAccountStates as any).mockReturnValueOnce(
        new Map([["custom-account", mockState]])
      );

      const result = await sendTextGateway({
        to: "peer",
        text: "test",
        accountId: "custom-account",
      });

      expect(result.ok).toBe(true);
    });

    it("should return error from sendZTMMessage", async () => {
      const stateModule = await import("../runtime/state.js");
      const outboundModule = await import("../messaging/outbound.js");
      const { getAllAccountStates } = stateModule;
      const { sendZTMMessage } = outboundModule;
      (getAllAccountStates as any).mockReturnValueOnce(
        new Map([["default", mockState]])
      );
      (sendZTMMessage as any).mockResolvedValueOnce({
        ok: false,
        error: new Error("Send failed"),
      });

      const result = await sendTextGateway({
        to: "peer",
        text: "test",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should include error message from state", async () => {
      const stateWithError = {
        ...mockState,
        lastError: "Connection lost",
      };
      const stateModule = await import("../runtime/state.js");
      const outboundModule = await import("../messaging/outbound.js");
      const { getAllAccountStates } = stateModule;
      const { sendZTMMessage } = outboundModule;
      (getAllAccountStates as any).mockReturnValueOnce(
        new Map([["default", stateWithError]])
      );
      (sendZTMMessage as any).mockResolvedValueOnce({
        ok: false,
        error: new Error("Send failed"),
      });

      const result = await sendTextGateway({
        to: "peer",
        text: "test",
      });

      expect(result.error).toBe("Send failed");
    });
  });

  describe("logoutAccountGateway", () => {
    it("should clear account state", async () => {
      const { stopRuntime, removeAccountState } = await import("../runtime/state.js");

      const result = await logoutAccountGateway({ accountId: "test-account" });

      expect(result.cleared).toBe(true);
      expect(stopRuntime).toHaveBeenCalledWith("test-account");
      expect(removeAccountState).toHaveBeenCalledWith("test-account");
    });

    it("should handle optional cfg parameter", async () => {
      const { stopRuntime, removeAccountState } = await import("../runtime/state.js");

      const result = await logoutAccountGateway({
        accountId: "test-account",
        cfg: undefined,
      });

      expect(result.cleared).toBe(true);
      expect(stopRuntime).toHaveBeenCalled();
    });

    it("should handle cfg parameter", async () => {
      const { stopRuntime, removeAccountState } = await import("../runtime/state.js");
      const cfg: OpenClawConfig = {};

      const result = await logoutAccountGateway({ accountId: "test", cfg });

      expect(result.cleared).toBe(true);
    });
  });

  /* describe("createInboundContext", () => {
    let mockRuntime: any;
    let mockMsg: ZTMChatMessage;
    let mockCfg: Record<string, unknown>;

    beforeEach(async () => {
      mockRuntime = {
        channel: {
          routing: {
            resolveAgentRoute: vi.fn(() => ({
              sessionKey: "session-123",
              agentId: "agent-456",
              matchedBy: "test-route",
            })),
          },
          reply: {
            finalizeInboundContext: vi.fn((ctx) => ctx),
          },
        },
      };

      mockMsg = {
        id: "msg-123",
        sender: "peer-user",
        senderId: "peer-user",
        content: "Hello, bot!",
        timestamp: new Date(),
        peer: "peer-user",
      } as unknown as ZTMChatMessage;

      mockCfg = { test: "value" };

      const { getZTMRuntime } = await import("../runtime/index.js");
      (getZTMRuntime as any).mockReturnValue(mockRuntime);
    });

    it("should create complete inbound context", () => {
      const accountId = "test-account";

      const result = createInboundContext({
        rt: mockRuntime,
        msg: mockMsg,
        config: mockConfig,
        accountId,
        cfg: mockCfg,
      });

      expect(result).toHaveProperty("ctxPayload");
      expect(result).toHaveProperty("matchedBy");
      expect(result).toHaveProperty("agentId");
    });

    it("should call resolveAgentRoute", () => {
      const accountId = "test-account";

      createInboundContext({
        rt: mockRuntime,
        msg: mockMsg,
        config: mockConfig,
        accountId,
        cfg: mockCfg,
      });

      expect(mockRuntime.channel.routing.resolveAgentRoute).toHaveBeenCalledWith({
        channel: "ztm-chat",
        accountId,
        peer: { kind: "direct", id: mockMsg.sender },
        cfg: mockCfg,
      });
    });

    it("should call finalizeInboundContext", () => {
      const accountId = "test-account";

      createInboundContext({
        rt: mockRuntime,
        msg: mockMsg,
        config: mockConfig,
        accountId,
        cfg: mockCfg,
      });

      expect(mockRuntime.channel.reply.finalizeInboundContext).toHaveBeenCalled();
    });

    it("should return matchedBy and agentId", () => {
      const accountId = "test-account";

      const result = createInboundContext({
        rt: mockRuntime,
        msg: mockMsg,
        config: mockConfig,
        accountId,
        cfg: mockCfg,
      });

      expect(result.matchedBy).toBe("test-route");
      expect(result.agentId).toBe("agent-456");
    });

    it("should handle empty cfg", () => {
      const accountId = "test-account";

      const result = createInboundContext({
        rt: mockRuntime,
        msg: mockMsg,
        config: mockConfig,
        accountId,
        cfg: undefined,
      });

      expect(result.ctxPayload).toBeDefined();
    });

    it("should include all context payload fields", () => {
      const accountId = "test-account";

      const result = createInboundContext({
        rt: mockRuntime,
        msg: mockMsg,
        config: mockConfig,
        accountId,
        cfg: {},
      });

      const payload = result.ctxPayload;
      expect(payload.Body).toBe(mockMsg.content);
      expect(payload.RawBody).toBe(mockMsg.content);
      expect(payload.CommandBody).toBe(mockMsg.content);
      expect(payload.From).toBe(`ztm-chat:${mockMsg.sender}`);
      expect(payload.To).toBe(`ztm-chat:${mockConfig.username}`);
      expect(payload.SessionKey).toBe("session-123");
      expect(payload.AccountId).toBe(accountId);
      expect(payload.ChatType).toBe("direct");
      expect(payload.Provider).toBe("ztm-chat");
    });
  }); */

  describe("buildMessageCallback", () => {
    it("should create callback function", () => {
      const callback = buildMessageCallback(mockState, "test-account", mockConfig);

      expect(typeof callback).toBe("function");
    });

    it("should dispatch message when callback is invoked", async () => {
      const { getZTMRuntime } = await import("../runtime/index.js");
      const mockRuntime = {
        channel: {
          routing: {
            resolveAgentRoute: vi.fn(() => ({
              sessionKey: "session-123",
              agentId: "agent-456",
              matchedBy: "test-route",
            })),
          },
          reply: {
            finalizeInboundContext: vi.fn((ctx) => ctx),
            dispatchReplyWithBufferedBlockDispatcher: vi.fn().mockResolvedValue({
              queuedFinal: true,
            }),
            resolveHumanDelayConfig: vi.fn(() => ({ delay: 0 })),
          },
        },
      };
      (getZTMRuntime as any).mockReturnValue(mockRuntime);

      const callback = buildMessageCallback(mockState, "test-account", mockConfig);
      const msg = {
        id: "msg-123",
        sender: "peer",
        senderId: "peer",
        content: "test",
        timestamp: new Date(),
        peer: "peer",
      } as unknown as ZTMChatMessage;

      callback(msg);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockRuntime.channel.reply.dispatchReplyWithBufferedBlockDispatcher).toHaveBeenCalled();
    });

    it("should handle dispatch errors gracefully", async () => {
      const { getZTMRuntime } = await import("../runtime/index.js");
      const mockRuntime = {
        channel: {
          routing: {
            resolveAgentRoute: vi.fn(() => {
              throw new Error("Route error");
            }),
          },
          reply: {
            finalizeInboundContext: vi.fn((ctx) => ctx),
          },
        },
      };
      (getZTMRuntime as any).mockReturnValue(mockRuntime);

      const callback = buildMessageCallback(mockState, "test-account", mockConfig);
      const msg = {
        id: "msg-123",
        sender: "peer",
        senderId: "peer",
        content: "test",
        timestamp: new Date(),
        peer: "peer",
      } as unknown as ZTMChatMessage;

      expect(() => callback(msg)).not.toThrow();
    });
  });

  describe("startAccountGateway", () => {
    beforeEach(() => {
      mockValidateZTMChatConfig.mockReturnValue({ valid: true, errors: [] });
      mockCheckPortOpen.mockResolvedValue(true);
      // Ensure getAllAccountStates returns mock state for startAccountGateway tests
      // Note: Some tests use "test" as accountId, so include both
      mockGetAllAccountStates.mockReturnValue(
        new Map([
          ["test-account", mockState],
          ["test", { ...mockState, accountId: "test" }],
        ])
      );
    });

    it("should throw error for invalid config", async () => {
      const { validateZTMChatConfig } = await import("../config/index.js");
      (validateZTMChatConfig as any).mockReturnValue({
        valid: false,
        errors: ["agentUrl is required", "username is required"],
      });

      const ctx = {
        account: { accountId: "test", config: mockConfig },
        log: { info: vi.fn(), error: vi.fn() },
      };

      await expect(startAccountGateway(ctx)).rejects.toThrow("agentUrl is required; username is required");
    });

    it("should throw error when cannot connect to agent", async () => {
      const { checkPortOpen } = await import("../connectivity/mesh.js");
      (checkPortOpen as any).mockResolvedValue(false);

      const ctx = {
        account: { accountId: "test", config: mockConfig },
        log: { info: vi.fn(), error: vi.fn() },
      };

      await expect(startAccountGateway(ctx)).rejects.toThrow("Cannot connect to ZTM agent");
    });

    it("should throw error for invalid URL", async () => {
      const { checkPortOpen } = await import("../connectivity/mesh.js");
      (checkPortOpen as any).mockImplementation(() => {
        throw new Error("Invalid URL");
      });

      const ctx = {
        account: { accountId: "test", config: { ...mockConfig, agentUrl: "invalid-url" } },
        log: { info: vi.fn(), error: vi.fn() },
      };

      await expect(startAccountGateway(ctx)).rejects.toThrow("Invalid ZTM agent URL");
    });

    it("should log pairing mode info", async () => {
      const { checkPortOpen, joinMesh } = await import("../connectivity/mesh.js");
      const stateModule = await import("../runtime/state.js");
      const inboundModule = await import("../messaging/inbound.js");
      const runtimeModule = await import("../runtime/index.js");
      const { initializeRuntime } = stateModule;
      const { startMessageWatcher } = inboundModule;
      const { getZTMRuntime } = runtimeModule;

      (checkPortOpen as any).mockResolvedValue(true);
      (joinMesh as any).mockResolvedValue(true);
      (initializeRuntime as any).mockResolvedValue(true);
      (startMessageWatcher as any).mockResolvedValue(undefined);

      const mockRuntime = {
        channel: {
          routing: { resolveAgentRoute: vi.fn(() => ({ sessionKey: "s", agentId: "a", matchedBy: "r" })) },
          reply: {
            finalizeInboundContext: vi.fn((ctx) => ctx),
            dispatchReplyWithBufferedBlockDispatcher: vi.fn().mockResolvedValue({ queuedFinal: true }),
            resolveHumanDelayConfig: vi.fn(() => ({ delay: 0 })),
          },
        },
      };
      (getZTMRuntime as any).mockReturnValue(mockRuntime);

      const ctx = {
        account: {
          accountId: "test",
          config: { ...mockConfig, dmPolicy: "pairing" as const, allowFrom: [] },
        },
        log: { info: vi.fn(), error: vi.fn() },
      };

      await startAccountGateway(ctx);

      expect(ctx.log?.info).toHaveBeenCalledWith(
        expect.stringContaining("Pairing mode active - no approved users")
      );
    });
  });

  describe("Edge Cases", () => {

    it("should handle empty message content", async () => {
      const result = await sendTextGateway({
        to: "peer",
        text: "",
      });

      expect(result.ok).toBe(true);
    });

    it("should handle special characters in message", async () => {
      const result = await sendTextGateway({
        to: "peer",
        text: "Test unicode: 你好 🌍",
      });

      expect(result.ok).toBe(true);
    });

    it("should handle very long messages", async () => {
      const longText = "a".repeat(10000);

      const result = await sendTextGateway({
        to: "peer",
        text: longText,
      });

      expect(result.ok).toBe(true);
    });

    it("should handle peer with special characters", async () => {
      const result = await sendTextGateway({
        to: "user_123-test.dev",
        text: "test",
      });

      expect(result.ok).toBe(true);
    });

    it("should handle multiple rapid sends", async () => {
      const sends = Array.from({ length: 10 }, (_, i) =>
        sendTextGateway({ to: "peer", text: `message ${i}` })
      );

      const results = await Promise.all(sends);

      expect(results.every((r) => r.ok)).toBe(true);
    });
  });
});
