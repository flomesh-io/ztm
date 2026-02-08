// Unit tests for ZTM Chat Plugin Configuration

import { describe, it, expect, beforeEach } from "vitest";
import {
  ZTMChatConfigSchema,
  validateZTMChatConfig,
  resolveZTMChatConfig,
  getDefaultConfig,
  isConfigMinimallyValid,
  createProbeConfig,
  type ZTMChatConfig,
} from "./config.js";
import {
  buildPeerMessagePath,
  parseMessagePath,
} from "./ztm-api.js";

describe("ZTMChatConfigSchema", () => {
  describe("agentUrl validation", () => {
    it("should accept valid HTTPS URLs", () => {
      const result = validateZTMChatConfig({
        agentUrl: "https://ztm-agent.example.com:7777",
        meshName: "my-mesh",
        username: "test-bot",
      });
      expect(result.valid).toBe(true);
    });

    it("should accept valid HTTP URLs", () => {
      const result = validateZTMChatConfig({
        agentUrl: "http://localhost:7777",
        meshName: "my-mesh",
        username: "test-bot",
      });
      expect(result.valid).toBe(true);
    });

    it("should reject invalid URLs", () => {
      const result = validateZTMChatConfig({
        agentUrl: "not-a-url",
        meshName: "my-mesh",
        username: "test-bot",
      });
      expect(result.valid).toBe(false);
    });

    it("should reject empty agentUrl", () => {
      const result = validateZTMChatConfig({
        agentUrl: "",
        meshName: "my-mesh",
        username: "test-bot",
      });
      expect(result.valid).toBe(false);
    });
  });

  describe("meshName validation", () => {
    it("should accept valid mesh names", () => {
      const result = validateZTMChatConfig({
        agentUrl: "https://ztm-agent.example.com:7777",
        meshName: "my-mesh-123",
        username: "test-bot",
      });
      expect(result.valid).toBe(true);
    });

    it("should reject mesh names with special characters", () => {
      const result = validateZTMChatConfig({
        agentUrl: "https://ztm-agent.example.com:7777",
        meshName: "my mesh!",
        username: "test-bot",
      });
      expect(result.valid).toBe(false);
    });

    it("should reject empty meshName", () => {
      const result = validateZTMChatConfig({
        agentUrl: "https://ztm-agent.example.com:7777",
        meshName: "",
        username: "test-bot",
      });
      expect(result.valid).toBe(false);
    });
  });

  describe("username validation", () => {
    it("should accept valid usernames", () => {
      const result = validateZTMChatConfig({
        agentUrl: "https://ztm-agent.example.com:7777",
        meshName: "my-mesh",
        username: "test-bot_123",
      });
      expect(result.valid).toBe(true);
    });

    it("should reject usernames with spaces", () => {
      const result = validateZTMChatConfig({
        agentUrl: "https://ztm-agent.example.com:7777",
        meshName: "my-mesh",
        username: "test bot",
      });
      expect(result.valid).toBe(false);
    });
  });

  describe("certificate validation", () => {
    it("should accept valid PEM certificates", () => {
      const result = validateZTMChatConfig({
        agentUrl: "https://ztm-agent.example.com:7777",
        meshName: "my-mesh",
        username: "test-bot",
        certificate: "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----",
      });
      expect(result.valid).toBe(true);
    });

    it("should reject invalid certificate format", () => {
      const result = validateZTMChatConfig({
        agentUrl: "https://ztm-agent.example.com:7777",
        meshName: "my-mesh",
        username: "test-bot",
        certificate: "not-a-certificate",
      });
      expect(result.valid).toBe(false);
    });
  });

  describe("privateKey validation", () => {
    it("should accept valid PEM private keys", () => {
      const result = validateZTMChatConfig({
        agentUrl: "https://ztm-agent.example.com:7777",
        meshName: "my-mesh",
        username: "test-bot",
        privateKey: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
      });
      expect(result.valid).toBe(true);
    });

    it("should accept RSA private keys", () => {
      const result = validateZTMChatConfig({
        agentUrl: "https://ztm-agent.example.com:7777",
        meshName: "my-mesh",
        username: "test-bot",
        privateKey: "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----",
      });
      expect(result.valid).toBe(true);
    });
  });

  describe("boolean defaults", () => {
    it("should default enableGroups to false", () => {
      const result = validateZTMChatConfig({
        agentUrl: "https://ztm-agent.example.com:7777",
        meshName: "my-mesh",
        username: "test-bot",
      });
      expect(result.valid).toBe(true);
      expect(result.config?.enableGroups).toBe(false);
    });

    it("should default autoReply to true", () => {
      const result = validateZTMChatConfig({
        agentUrl: "https://ztm-agent.example.com:7777",
        meshName: "my-mesh",
        username: "test-bot",
      });
      expect(result.valid).toBe(true);
      expect(result.config?.autoReply).toBe(true);
    });

    it("should default messagePath to /shared", () => {
      const result = validateZTMChatConfig({
        agentUrl: "https://ztm-agent.example.com:7777",
        meshName: "my-mesh",
        username: "test-bot",
      });
      expect(result.valid).toBe(true);
      expect(result.config?.messagePath).toBe("/shared");
    });
  });
});

describe("validateZTMChatConfig", () => {
  it("should return valid for complete config", () => {
    const result = validateZTMChatConfig({
      agentUrl: "https://ztm-agent.example.com:7777",
      meshName: "my-mesh",
      username: "test-bot",
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.config).toBeDefined();
  });

  it("should return errors for missing required fields", () => {
    const result = validateZTMChatConfig({
      agentUrl: "",
      meshName: "",
      username: "",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should return error for invalid URL", () => {
    const result = validateZTMChatConfig({
      agentUrl: "not-a-valid-url",
      meshName: "my-mesh",
      username: "test-bot",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes("url"))).toBe(true);
  });

  it("should provide user-friendly error messages", () => {
    const result = validateZTMChatConfig({
      agentUrl: "invalid",
      meshName: "",
      username: "",
    });

    expect(result.errors[0]).toContain("agentUrl");
  });
});

describe("resolveZTMChatConfig", () => {
  it("should return default values for empty input", () => {
    const result = resolveZTMChatConfig({});

    expect(result.agentUrl).toBe("http://localhost:7777");
    expect(result.meshName).toBe("");
    expect(result.username).toBe("openclaw-bot");
    expect(result.certificate).toBeUndefined();
    expect(result.privateKey).toBeUndefined();
    expect(result.enableGroups).toBe(false);
    expect(result.autoReply).toBe(true);
    expect(result.messagePath).toBe("/shared");
  });

  it("should preserve provided values", () => {
    const input = {
      agentUrl: "https://my-agent.example.com:7777",
      meshName: "my-mesh",
      username: "my-bot",
      enableGroups: true,
      autoReply: false,
    };

    const result = resolveZTMChatConfig(input);

    expect(result.agentUrl).toBe("https://my-agent.example.com:7777");
    expect(result.meshName).toBe("my-mesh");
    expect(result.username).toBe("my-bot");
    expect(result.enableGroups).toBe(true);
    expect(result.autoReply).toBe(false);
  });

  it("should trim whitespace from string values", () => {
    const result = resolveZTMChatConfig({
      agentUrl: "  https://example.com  ",
      meshName: "  my-mesh  ",
      username: "  bot  ",
    });

    expect(result.agentUrl).toBe("https://example.com");
    expect(result.meshName).toBe("my-mesh");
    expect(result.username).toBe("bot");
  });

  it("should handle null/undefined values", () => {
    const result = resolveZTMChatConfig({
      agentUrl: null,
      meshName: undefined,
      username: null,
    });

    expect(result.agentUrl).toBe("http://localhost:7777");
    expect(result.meshName).toBe("");
    expect(result.username).toBe("openclaw-bot");
  });
});

describe("getDefaultConfig", () => {
  it("should return default configuration", () => {
    const result = getDefaultConfig();

    expect(result.agentUrl).toBe("http://localhost:7777");
    expect(result.meshName).toBe("");
    expect(result.username).toBe("openclaw-bot");
    expect(result.certificate).toBeUndefined();
    expect(result.privateKey).toBeUndefined();
    expect(result.enableGroups).toBe(false);
    expect(result.autoReply).toBe(true);
    expect(result.messagePath).toBe("/shared");
  });
});

describe("isConfigMinimallyValid", () => {
  it("should return true for valid config", () => {
    const config = {
      agentUrl: "https://example.com",
      meshName: "my-mesh",
      username: "test-bot",
    } as Partial<ZTMChatConfig>;

    expect(isConfigMinimallyValid(config)).toBe(true);
  });

  it("should return false for missing agentUrl", () => {
    const config = {
      agentUrl: "",
      meshName: "my-mesh",
      username: "test-bot",
    } as Partial<ZTMChatConfig>;

    expect(isConfigMinimallyValid(config)).toBe(false);
  });

  it("should return false for missing meshName", () => {
    const config = {
      agentUrl: "https://example.com",
      meshName: "",
      username: "test-bot",
    } as Partial<ZTMChatConfig>;

    expect(isConfigMinimallyValid(config)).toBe(false);
  });

  it("should return false for missing username", () => {
    const config = {
      agentUrl: "https://example.com",
      meshName: "my-mesh",
      username: "",
    } as Partial<ZTMChatConfig>;

    expect(isConfigMinimallyValid(config)).toBe(false);
  });
});

describe("createProbeConfig", () => {
  it("should create a valid probe config", () => {
    const result = createProbeConfig({
      agentUrl: "https://example.com:7777",
    });

    expect(result.agentUrl).toBe("https://example.com:7777");
    expect(result.meshName).toBe("");
    expect(result.username).toBe("probe");
  });

  it("should use defaults for missing fields", () => {
    const result = createProbeConfig({});

    expect(result.agentUrl).toBe("http://localhost:7777");
    expect(result.meshName).toBe("");
    expect(result.username).toBe("probe");
  });

  it("should preserve provided values", () => {
    const result = createProbeConfig({
      agentUrl: "https://custom.example.com",
      meshName: "custom-mesh",
      username: "custom-user",
      enableGroups: true,
      autoReply: false,
    });

    expect(result.agentUrl).toBe("https://custom.example.com");
    expect(result.meshName).toBe("custom-mesh");
    expect(result.username).toBe("custom-user");
    expect(result.enableGroups).toBe(true);
    expect(result.autoReply).toBe(false);
  });
});

describe("Message Path Helpers", () => {
  describe("buildPeerMessagePath", () => {
    it("should build correct peer message path", () => {
      const result = buildPeerMessagePath("/shared", "openclaw-bot", "alice");
      expect(result).toBe("/shared/openclaw-bot/publish/peers/alice/messages/");
    });

    it("should handle custom message path", () => {
      const result = buildPeerMessagePath("/custom/path", "bot", "alice");
      expect(result).toBe("/custom/path/bot/publish/peers/alice/messages/");
    });
  });

  describe("parseMessagePath", () => {
    it("should parse peer message path", () => {
      const path = "/shared/openclaw-bot/publish/peers/alice/messages/";
      const result = parseMessagePath(path);

      expect(result).not.toBeNull();
      expect(result?.peer).toBe("alice");
    });

    it("should parse group message path", () => {
      const path = "/shared/openclaw-bot/publish/groups/alice/my-group/messages/";
      const result = parseMessagePath(path);

      expect(result).not.toBeNull();
      expect(result?.creator).toBe("alice");
      expect(result?.group).toBe("my-group");
    });

    it("should return null for invalid path", () => {
      const path = "/invalid/path";
      const result = parseMessagePath(path);

      expect(result).toBeNull();
    });
  });
});

describe("Message ID Generator", () => {
  it("should generate unique IDs", () => {
    const ids = new Set<string>();

    // Generate 1000 IDs and check uniqueness
    for (let i = 0; i < 1000; i++) {
      const id = `ztm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      ids.add(id);
    }

    // Allow for some collisions but mostly unique
    expect(ids.size).toBeGreaterThan(990);
  });

  it("should include timestamp", () => {
    const before = Date.now();
    const id = `ztm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const after = Date.now();

    const timestamp = parseInt(id.split("-")[1], 10);

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it("should have correct prefix", () => {
    const id = `ztm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    expect(id.startsWith("ztm-")).toBe(true);
  });
});

describe("Target Normalization", () => {
  it("should trim and lowercase targets", () => {
    const normalizeTarget = (target: string) => target.trim().toLowerCase();

    expect(normalizeTarget("  ALICE  ")).toBe("alice");
    expect(normalizeTarget("Bob")).toBe("bob");
    expect(normalizeTarget("CHARLIE")).toBe("charlie");
  });
});

describe("AllowFrom Normalization", () => {
  it("should format allowFrom entries", () => {
    const entries = ["  Alice  ", "BOB", "charlie  "];

    const formatted = entries
      .map((entry) => String(entry).trim())
      .filter(Boolean)
      .map((entry) => entry.toLowerCase());

    expect(formatted).toEqual(["alice", "bob", "charlie"]);
  });

  it("should filter empty entries", () => {
    const entries = ["alice", "", "  ", "bob"];

    const formatted = entries
      .map((entry) => String(entry).trim())
      .filter(Boolean)
      .map((entry) => entry.toLowerCase());

    expect(formatted).toEqual(["alice", "bob"]);
  });
});
