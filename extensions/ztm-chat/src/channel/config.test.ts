// Unit tests for Channel Config

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "node:path";
import type { OpenClawConfig } from "openclaw/plugin-sdk";
import type { ZTMChatConfig } from "../types/config.js";
import type { TSchema } from "@sinclair/typebox";
import {
  readExternalChannelConfig,
  getEffectiveChannelConfig,
  listZTMChatAccountIds,
  resolveZTMChatAccount,
  buildChannelConfigSchemaWithHints,
  type ResolvedZTMChatAccount,
} from "./config.js";
import { getDefaultConfig } from "../config/index.js";

// Mock fs operations
const { mockFsExistsSync, mockFsReadFileSync } = vi.hoisted(() => {
  return {
    mockFsExistsSync: vi.fn(),
    mockFsReadFileSync: vi.fn(),
  };
});

vi.mock("fs", () => ({
  existsSync: mockFsExistsSync,
  readFileSync: mockFsReadFileSync,
}));

// Mock config functions
vi.mock("../config/index.js", () => ({
  resolveZTMChatConfig: vi.fn((input) => ({
    agentUrl: (input?.agentUrl as string) || "http://localhost:7777",
    permitUrl: (input?.permitUrl as string) || "https://ztm-portal.flomesh.io:7779/permit",
    meshName: (input?.meshName as string) || "openclaw-mesh",
    username: (input?.username as string) || "openclaw-bot",
    enableGroups: (input?.enableGroups as boolean) ?? false,
    autoReply: (input?.autoReply as boolean) ?? true,
    messagePath: (input?.messagePath as string) || "/shared",
    dmPolicy: (input?.dmPolicy as any) || "pairing",
    allowFrom: input?.allowFrom as string[] | undefined,
  })),
  getDefaultConfig: vi.fn(() => ({
    agentUrl: "http://localhost:7777",
    permitUrl: "https://ztm-portal.flomesh.io:7779/permit",
    meshName: "openclaw-mesh",
    username: "openclaw-bot",
    enableGroups: false,
    autoReply: true,
    messagePath: "/shared",
    dmPolicy: "pairing",
  })),
  mergeAccountConfig: vi.fn((base, account) => ({
    ...base,
    ...account,
  })),
}));

describe("Channel Config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock return values for each test
    mockFsExistsSync.mockReset();
    mockFsExistsSync.mockReturnValue(false);
    mockFsReadFileSync.mockReset();
    mockFsReadFileSync.mockReturnValue("");
    // Set default HOME environment variable
    process.env.HOME = "/test/home";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("readExternalChannelConfig", () => {
    it("should return null when config file does not exist", () => {
      mockFsExistsSync.mockReturnValue(false);

      const result = readExternalChannelConfig();

      expect(result).toBeNull();
      expect(mockFsExistsSync).toHaveBeenCalled();
    });

    it("should return null when HOME is not set", () => {
      delete process.env.HOME;
      mockFsExistsSync.mockReturnValue(false);

      const result = readExternalChannelConfig();

      expect(result).toBeNull();
    });

    it("should read and parse existing config file", () => {
      const mockConfig = {
        accounts: {
          default: {
            agentUrl: "https://example.com:7777",
            username: "test-bot",
          },
        },
      };
      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const result = readExternalChannelConfig();

      expect(result).toEqual(mockConfig);
      expect(mockFsReadFileSync).toHaveBeenCalledWith(
        path.join(process.env.HOME || "", ".openclaw", "ztm", "config.json"),
        "utf-8"
      );
    });

    it("should handle JSON parse errors gracefully", () => {
      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFileSync.mockReturnValue("invalid json {");

      const result = readExternalChannelConfig();

      expect(result).toBeNull();
    });

    it("should handle fs read errors gracefully", () => {
      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFileSync.mockImplementation(() => {
        throw new Error("Read error");
      });

      const result = readExternalChannelConfig();

      expect(result).toBeNull();
    });

    it("should return null on empty config", () => {
      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFileSync.mockReturnValue("{}");

      const result = readExternalChannelConfig();

      expect(result).toEqual({});
    });

    it("should handle config with multiple accounts", () => {
      const mockConfig = {
        accounts: {
          default: { username: "bot1" },
          account1: { username: "bot2" },
          account2: { username: "bot3" },
        },
      };
      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const result = readExternalChannelConfig();

      expect(result).toEqual(mockConfig);
    });

    it("should construct correct config path", () => {
      mockFsExistsSync.mockReturnValue(false);

      readExternalChannelConfig();

      const expectedPath = path.join(
        process.env.HOME || "",
        ".openclaw",
        "ztm",
        "config.json"
      );
      expect(mockFsExistsSync).toHaveBeenCalledWith(expectedPath);
    });
  });

  describe("getEffectiveChannelConfig", () => {
    it("should return inline config when present", () => {
      const inlineConfig = {
        agentUrl: "https://inline.example.com",
        username: "inline-bot",
      };
      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": inlineConfig,
        },
      };

      const result = getEffectiveChannelConfig(cfg);

      expect(result).toBe(inlineConfig);
    });

    it("should return inline config when it has keys", () => {
      const inlineConfig = { enabled: true };
      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": inlineConfig,
        },
      };

      const result = getEffectiveChannelConfig(cfg);

      expect(result).toBe(inlineConfig);
    });

    it("should return null for empty inline config", () => {
      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": {},
        },
      };

      const result = getEffectiveChannelConfig(cfg);

      expect(result).toBeNull();
    });

    it("should return null when inline config is not object", () => {
      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": "not-an-object",
        },
      };

      const result = getEffectiveChannelConfig(cfg);

      expect(result).toBeNull();
    });

    it("should fall back to external config when inline is empty", () => {
      const externalConfig = {
        agentUrl: "https://external.example.com",
      };
      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFileSync.mockReturnValue(JSON.stringify(externalConfig));

      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": {},
        },
      };

      const result = getEffectiveChannelConfig(cfg);

      expect(result).toEqual(externalConfig);
    });

    it("should fall back to external config when inline is null", () => {
      const externalConfig = { username: "external-bot" };
      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFileSync.mockReturnValue(JSON.stringify(externalConfig));

      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": null as any,
        },
      };

      const result = getEffectiveChannelConfig(cfg);

      expect(result).toEqual(externalConfig);
    });

    it("should return null when no config available", () => {
      mockFsExistsSync.mockReturnValue(false);

      const cfg: OpenClawConfig = {
        channels: {},
      };

      const result = getEffectiveChannelConfig(cfg);

      expect(result).toBeNull();
    });

    it("should prioritize inline over external config", () => {
      const inlineConfig = { username: "inline-bot" };
      const externalConfig = { username: "external-bot" };
      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFileSync.mockReturnValue(JSON.stringify(externalConfig));

      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": inlineConfig,
        },
      };

      const result = getEffectiveChannelConfig(cfg);

      expect(result).toBe(inlineConfig);
      expect(mockFsReadFileSync).not.toHaveBeenCalled();
    });
  });

  describe("listZTMChatAccountIds", () => {
    it("should return default when no accounts config", () => {
      const cfg: OpenClawConfig = {};

      const result = listZTMChatAccountIds(cfg);

      expect(result).toEqual(["default"]);
    });

    it("should return account IDs from config", () => {
      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": {
            accounts: {
              account1: { username: "bot1" },
              account2: { username: "bot2" },
            },
          },
        },
      };

      const result = listZTMChatAccountIds(cfg);

      expect(result).toEqual(["account1", "account2"]);
    });

    it("should return single account ID", () => {
      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": {
            accounts: {
              single: { username: "bot" },
            },
          },
        },
      };

      const result = listZTMChatAccountIds(cfg);

      expect(result).toEqual(["single"]);
    });

    it("should return default when accounts object is empty", () => {
      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": {
            accounts: {},
          },
        },
      };

      const result = listZTMChatAccountIds(cfg);

      expect(result).toEqual(["default"]);
    });

    it("should return default when accounts is not an object", () => {
      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": {
            accounts: "not-an-object",
          },
        },
      };

      const result = listZTMChatAccountIds(cfg);

      expect(result).toEqual(["default"]);
    });

    it("should handle multiple accounts with various keys", () => {
      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": {
            accounts: {
              primary: { username: "bot1" },
              secondary: { username: "bot2" },
              tertiary: { username: "bot3" },
              backup: { username: "bot4" },
            },
          },
        },
      };

      const result = listZTMChatAccountIds(cfg);

      expect(result).toHaveLength(4);
      expect(result).toContain("primary");
      expect(result).toContain("secondary");
      expect(result).toContain("tertiary");
      expect(result).toContain("backup");
    });
  });

  describe("resolveZTMChatAccount", () => {
    it("should resolve default account with no config", () => {
      const result = resolveZTMChatAccount({ cfg: undefined, accountId: undefined });

      expect(result.accountId).toBe("default");
      expect(result.username).toBe("default");
      expect(result.enabled).toBe(true);
      expect(result.config).toBeDefined();
    });

    it("should use provided accountId", () => {
      const result = resolveZTMChatAccount({ cfg: undefined, accountId: "my-account" });

      expect(result.accountId).toBe("my-account");
      expect(result.username).toBe("my-account");
    });

    it("should resolve account from config", () => {
      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": {
            accounts: {
              test: {
                username: "test-bot",
                enabled: true,
                agentUrl: "https://example.com",
              },
            },
          },
        },
      };

      const result = resolveZTMChatAccount({ cfg, accountId: "test" });

      expect(result.accountId).toBe("test");
      expect(result.username).toBe("test-bot");
      expect(result.enabled).toBe(true);
    });

    it("should fall back to default account when specified not found", () => {
      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": {
            accounts: {
              default: {
                username: "default-bot",
                enabled: true,
              },
            },
          },
        },
      };

      const result = resolveZTMChatAccount({ cfg, accountId: "nonexistent" });

      expect(result.accountId).toBe("nonexistent");
      // When account not found, falls back to default account's username
      expect(result.username).toBe("default-bot");
    });

    it("should handle account-level enabled flag", () => {
      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": {
            enabled: false,
            accounts: {
              test: {
                username: "test-bot",
              },
            },
          },
        },
      };

      const result = resolveZTMChatAccount({ cfg, accountId: "test" });

      expect(result.enabled).toBe(false);
    });

    it("should handle channel-level enabled flag", () => {
      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": {
            enabled: true,
            accounts: {
              test: {
                username: "test-bot",
              },
            },
          },
        },
      };

      const result = resolveZTMChatAccount({ cfg, accountId: "test" });

      expect(result.enabled).toBe(true);
    });

    it("should default enabled to true when not specified", () => {
      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": {
            accounts: {
              test: {
                username: "test-bot",
              },
            },
          },
        },
      };

      const result = resolveZTMChatAccount({ cfg, accountId: "test" });

      expect(result.enabled).toBe(true);
    });

    it("should merge account config with base config", async () => {
      const { mergeAccountConfig } = await import("../config/index.js");
      const baseConfig = {
        agentUrl: "https://base.com",
        username: "base-user",
      };
      const accountConfig = {
        username: "account-user",
        meshName: "account-mesh",
      };
      (mergeAccountConfig as any).mockReturnValueOnce({
        ...baseConfig,
        ...accountConfig,
      });

      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": baseConfig,
          accounts: {
            test: accountConfig,
          },
        } as any,
      };

      const result = resolveZTMChatAccount({ cfg, accountId: "test" });

      expect(mergeAccountConfig).toHaveBeenCalled();
    });

    it("should use default account when accounts not defined", () => {
      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": {
            username: "channel-bot",
          },
        },
      };

      const result = resolveZTMChatAccount({ cfg, accountId: "test" });

      expect(result.username).toBeDefined();
      expect(result.config).toBeDefined();
    });

    it("should handle enabled: false at account level", () => {
      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": {
            accounts: {
              test: {
                username: "test-bot",
                enabled: false,
              },
            },
          },
        },
      };

      const result = resolveZTMChatAccount({ cfg, accountId: "test" });

      expect(result.enabled).toBe(false);
    });

    it("should handle enabled: true at channel level", () => {
      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": {
            enabled: true,
            accounts: {
              test: {
                username: "test-bot",
              },
            },
          },
        },
      };

      const result = resolveZTMChatAccount({ cfg, accountId: "test" });

      expect(result.enabled).toBe(true);
    });

    it("should prioritize account enabled over channel enabled", () => {
      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": {
            enabled: true,
            accounts: {
              test: {
                username: "test-bot",
                enabled: false,
              },
            },
          },
        },
      };

      const result = resolveZTMChatAccount({ cfg, accountId: "test" });

      expect(result.enabled).toBe(false);
    });
  });

  describe("buildChannelConfigSchemaWithHints", () => {
    it("should return schema with uiHints", () => {
      const mockSchema = {} as TSchema;
      const result = buildChannelConfigSchemaWithHints(mockSchema);

      expect(result).toHaveProperty("schema");
      expect(result).toHaveProperty("parse");
      expect(result).toHaveProperty("uiHints");
    });

    it("should provide parse function", () => {
      const mockSchema = {} as TSchema;
      const result = buildChannelConfigSchemaWithHints(mockSchema);

      expect(typeof result.parse).toBe("function");
    });

    it("should parse config through parse function", () => {
      const mockSchema = {} as TSchema;
      const result = buildChannelConfigSchemaWithHints(mockSchema);
      const testConfig = { username: "test", agentUrl: "https://test.com" };

      expect(() => result.parse(testConfig)).not.toThrow();
    });

    it("should include agentUrl in uiHints", () => {
      const mockSchema = {} as TSchema;
      const result = buildChannelConfigSchemaWithHints(mockSchema);

      expect(result.uiHints.agentUrl).toBeDefined();
      expect(result.uiHints.agentUrl.label).toBe("ZTM Agent URL");
      expect(result.uiHints.agentUrl.required).toBe(true);
    });

    it("should include meshName in uiHints", () => {
      const mockSchema = {} as TSchema;
      const result = buildChannelConfigSchemaWithHints(mockSchema);

      expect(result.uiHints.meshName).toBeDefined();
      expect(result.uiHints.meshName.label).toBe("Mesh Name");
      expect(result.uiHints.meshName.required).toBe(true);
    });

    it("should include username in uiHints", () => {
      const mockSchema = {} as TSchema;
      const result = buildChannelConfigSchemaWithHints(mockSchema);

      expect(result.uiHints.username).toBeDefined();
      expect(result.uiHints.username.label).toBe("Bot Username");
      expect(result.uiHints.username.required).toBe(true);
    });

    it("should include enableGroups in uiHints", () => {
      const mockSchema = {} as TSchema;
      const result = buildChannelConfigSchemaWithHints(mockSchema);

      expect(result.uiHints.enableGroups).toBeDefined();
      expect(result.uiHints.enableGroups.label).toBe("Enable Groups");
      expect(result.uiHints.enableGroups.advanced).toBe(true);
    });

    it("should include autoReply in uiHints", () => {
      const mockSchema = {} as TSchema;
      const result = buildChannelConfigSchemaWithHints(mockSchema);

      expect(result.uiHints.autoReply).toBeDefined();
      expect(result.uiHints.autoReply.label).toBe("Auto Reply");
      expect(result.uiHints.autoReply.default).toBe(true);
    });

    it("should include messagePath in uiHints", () => {
      const mockSchema = {} as TSchema;
      const result = buildChannelConfigSchemaWithHints(mockSchema);

      expect(result.uiHints.messagePath).toBeDefined();
      expect(result.uiHints.messagePath.label).toBe("Message Path");
      expect(result.uiHints.messagePath.advanced).toBe(true);
    });

    it("should include validation patterns in uiHints", () => {
      const mockSchema = {} as TSchema;
      const result = buildChannelConfigSchemaWithHints(mockSchema);

      expect(result.uiHints.agentUrl.validation).toBeDefined();
      expect(result.uiHints.meshName.validation).toBeDefined();
      expect(result.uiHints.username.validation).toBeDefined();
    });

    it("should include help text in uiHints", () => {
      const mockSchema = {} as TSchema;
      const result = buildChannelConfigSchemaWithHints(mockSchema);

      expect(result.uiHints.agentUrl.help).toBeDefined();
      expect(result.uiHints.meshName.help).toBeDefined();
      expect(result.uiHints.username.help).toBeDefined();
    });

    it("should include placeholder text in uiHints", () => {
      const mockSchema = {} as TSchema;
      const result = buildChannelConfigSchemaWithHints(mockSchema);

      expect(result.uiHints.agentUrl.placeholder).toContain("example.com");
      expect(result.uiHints.meshName.placeholder).toBeDefined();
      expect(result.uiHints.username.placeholder).toContain("bot");
    });
  });

  describe("ResolvedZTMChatAccount interface", () => {
    it("should have required properties", () => {
      const result = resolveZTMChatAccount({ cfg: undefined, accountId: undefined });

      expect(result).toHaveProperty("accountId");
      expect(result).toHaveProperty("username");
      expect(result).toHaveProperty("enabled");
      expect(result).toHaveProperty("config");
    });

    it("should have correct types for properties", () => {
      const result = resolveZTMChatAccount({ cfg: undefined, accountId: undefined });

      expect(typeof result.accountId).toBe("string");
      expect(typeof result.username).toBe("string");
      expect(typeof result.enabled).toBe("boolean");
      expect(typeof result.config).toBe("object");
    });
  });

  describe("Edge Cases", () => {
    it("should handle null cfg", () => {
      const result = resolveZTMChatAccount({ cfg: null, accountId: "test" });

      expect(result).toBeDefined();
      expect(result.accountId).toBe("test");
    });

    it("should handle undefined accounts", () => {
      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": {
            accounts: undefined,
          },
        },
      };

      const result = listZTMChatAccountIds(cfg);

      expect(result).toEqual(["default"]);
    });

    it("should handle malformed external config", () => {
      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFileSync.mockReturnValue("{ malformed json");

      const result = readExternalChannelConfig();

      expect(result).toBeNull();
    });

    it("should handle special characters in account IDs", () => {
      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": {
            accounts: {
              "account_123-test.dev": { username: "bot" },
            },
          },
        },
      };

      const result = listZTMChatAccountIds(cfg);

      expect(result).toContain("account_123-test.dev");
    });

    it("should handle very long account IDs", () => {
      const longId = "a".repeat(100);
      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": {
            accounts: {
              [longId]: { username: "bot" },
            },
          },
        },
      };

      const result = listZTMChatAccountIds(cfg);

      expect(result).toContain(longId);
    });

    it("should handle unicode in account IDs", () => {
      const unicodeId = "用户-пользователь";
      const cfg: OpenClawConfig = {
        channels: {
          "ztm-chat": {
            accounts: {
              [unicodeId]: { username: "bot" },
            },
          },
        },
      };

      const result = listZTMChatAccountIds(cfg);

      expect(result).toContain(unicodeId);
    });
  });
});
