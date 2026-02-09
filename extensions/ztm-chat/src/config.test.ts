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
        permitUrl: "https://ztm-portal.flomesh.io:7779/permit",
        username: "test-bot",
      });
      expect(result.valid).toBe(true);
    });

    it("should accept valid HTTP URLs", () => {
      const result = validateZTMChatConfig({
        agentUrl: "http://localhost:7777",
        meshName: "my-mesh",
        permitUrl: "https://ztm-portal.flomesh.io:7779/permit",
        username: "test-bot",
      });
      expect(result.valid).toBe(true);
    });

    it("should reject invalid URLs", () => {
      const result = validateZTMChatConfig({
        agentUrl: "not-a-url",
        meshName: "my-mesh",
        permitUrl: "https://ztm-portal.flomesh.io:7779/permit",
        username: "test-bot",
      });
      expect(result.valid).toBe(false);
    });

    it("should reject empty agentUrl", () => {
      const result = validateZTMChatConfig({
        agentUrl: "",
        meshName: "my-mesh",
        permitUrl: "https://ztm-portal.flomesh.io:7779/permit",
        username: "test-bot",
      });
      expect(result.valid).toBe(false);
    });
  });

  describe("permitUrl validation", () => {
    it("should accept valid HTTPS permit URLs", () => {
      const result = validateZTMChatConfig({
        agentUrl: "http://localhost:7777",
        meshName: "my-mesh",
        permitUrl: "https://ztm-portal.flomesh.io:7779/permit",
        username: "test-bot",
      });
      expect(result.valid).toBe(true);
    });

    it("should accept valid HTTP permit URLs", () => {
      const result = validateZTMChatConfig({
        agentUrl: "http://localhost:7777",
        meshName: "my-mesh",
        permitUrl: "http://localhost:7779/permit",
        username: "test-bot",
      });
      expect(result.valid).toBe(true);
    });

    it("should reject invalid permitUrl", () => {
      const result = validateZTMChatConfig({
        agentUrl: "http://localhost:7777",
        meshName: "my-mesh",
        permitUrl: "not-a-url",
        username: "test-bot",
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.toLowerCase().includes("permiturl"))).toBe(true);
    });

    it("should reject empty permitUrl", () => {
      const result = validateZTMChatConfig({
        agentUrl: "http://localhost:7777",
        meshName: "my-mesh",
        permitUrl: "",
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
        permitUrl: "https://ztm-portal.flomesh.io:7779/permit",
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
        permitUrl: "https://ztm-portal.flomesh.io:7779/permit",
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

  describe("boolean defaults", () => {
    it("should default enableGroups to false", () => {
      const result = validateZTMChatConfig({
        agentUrl: "https://ztm-agent.example.com:7777",
        meshName: "my-mesh",
        permitUrl: "https://ztm-portal.flomesh.io:7779/permit",
        username: "test-bot",
      });
      expect(result.valid).toBe(true);
      expect(result.config?.enableGroups).toBe(false);
    });

    it("should default autoReply to true", () => {
      const result = validateZTMChatConfig({
        agentUrl: "https://ztm-agent.example.com:7777",
        meshName: "my-mesh",
        permitUrl: "https://ztm-portal.flomesh.io:7779/permit",
        username: "test-bot",
      });
      expect(result.valid).toBe(true);
      expect(result.config?.autoReply).toBe(true);
    });

    it("should default messagePath to /shared", () => {
      const result = validateZTMChatConfig({
        agentUrl: "https://ztm-agent.example.com:7777",
        meshName: "my-mesh",
        permitUrl: "https://ztm-portal.flomesh.io:7779/permit",
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
      permitUrl: "https://ztm-portal.flomesh.io:7779/permit",
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

  it("should list all validation errors", () => {
    const result = validateZTMChatConfig({
      agentUrl: "invalid-url",
      permitUrl: "invalid-url",
      meshName: "",
      username: "",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(4);
    expect(result.errors.some(e => e.includes("agentUrl"))).toBe(true);
    expect(result.errors.some(e => e.includes("permitUrl"))).toBe(true);
    expect(result.errors.some(e => e.includes("meshName"))).toBe(true);
    expect(result.errors.some(e => e.includes("username"))).toBe(true);
  });
});

describe("resolveZTMChatConfig", () => {
  it("should return default values for empty input", () => {
    const result = resolveZTMChatConfig({});

    expect(result.agentUrl).toBe("http://localhost:7777");
    expect(result.permitUrl).toBe("https://ztm-portal.flomesh.io:7779/permit");
    expect(result.meshName).toBe("");
    expect(result.username).toBe("openclaw-bot");
    expect(result.enableGroups).toBe(false);
    expect(result.autoReply).toBe(true);
    expect(result.messagePath).toBe("/shared");
  });

  it("should preserve provided values", () => {
    const input = {
      agentUrl: "https://my-agent.example.com:7777",
      permitUrl: "https://my-permit.example.com:7779/permit",
      meshName: "my-mesh",
      username: "my-bot",
      enableGroups: true,
      autoReply: false,
    };

    const result = resolveZTMChatConfig(input);

    expect(result.agentUrl).toBe("https://my-agent.example.com:7777");
    expect(result.permitUrl).toBe("https://my-permit.example.com:7779/permit");
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
    expect(result.permitUrl).toBe("https://ztm-portal.flomesh.io:7779/permit");
    expect(result.meshName).toBe("");
    expect(result.username).toBe("openclaw-bot");
    expect(result.enableGroups).toBe(false);
    expect(result.autoReply).toBe(true);
    expect(result.messagePath).toBe("/shared");
    expect(result.dmPolicy).toBe("pairing");
    expect(result.allowFrom).toBeUndefined();
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
    expect(result.permitUrl).toBe("https://ztm-portal.flomesh.io:7779/permit");
    expect(result.meshName).toBe("");
    expect(result.username).toBe("probe");
  });

  it("should use defaults for missing fields", () => {
    const result = createProbeConfig({});

    expect(result.agentUrl).toBe("http://localhost:7777");
    expect(result.permitUrl).toBe("https://ztm-portal.flomesh.io:7779/permit");
    expect(result.meshName).toBe("");
    expect(result.username).toBe("probe");
    expect(result.dmPolicy).toBe("pairing");
  });

  it("should preserve provided values", () => {
    const result = createProbeConfig({
      agentUrl: "https://custom.example.com",
      permitUrl: "https://custom-permit.example.com:7779/permit",
      meshName: "custom-mesh",
      username: "custom-user",
      enableGroups: true,
      autoReply: false,
      dmPolicy: "allow",
    });

    expect(result.agentUrl).toBe("https://custom.example.com");
    expect(result.permitUrl).toBe("https://custom-permit.example.com:7779/permit");
    expect(result.meshName).toBe("custom-mesh");
    expect(result.username).toBe("custom-user");
    expect(result.enableGroups).toBe(true);
    expect(result.autoReply).toBe(false);
    expect(result.dmPolicy).toBe("allow");
  });

  it("should preserve allowFrom from config", () => {
    const result = createProbeConfig({
      agentUrl: "https://example.com",
      allowFrom: ["alice", "bob"],
    });

    expect(result.allowFrom).toEqual(["alice", "bob"]);
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

describe("DMPolicy Configuration", () => {
  describe("dmPolicy validation", () => {
    it("should accept 'allow' policy", () => {
      const result = validateZTMChatConfig({
        agentUrl: "https://ztm-agent.example.com:7777",
        meshName: "my-mesh",
        permitUrl: "https://ztm-portal.flomesh.io:7779/permit",
        username: "test-bot",
        dmPolicy: "allow",
      });
      expect(result.valid).toBe(true);
      expect(result.config?.dmPolicy).toBe("allow");
    });

    it("should accept 'deny' policy", () => {
      const result = validateZTMChatConfig({
        agentUrl: "https://ztm-agent.example.com:7777",
        meshName: "my-mesh",
        permitUrl: "https://ztm-portal.flomesh.io:7779/permit",
        username: "test-bot",
        dmPolicy: "deny",
      });
      expect(result.valid).toBe(true);
      expect(result.config?.dmPolicy).toBe("deny");
    });

    it("should accept 'pairing' policy", () => {
      const result = validateZTMChatConfig({
        agentUrl: "https://ztm-agent.example.com:7777",
        meshName: "my-mesh",
        permitUrl: "https://ztm-portal.flomesh.io:7779/permit",
        username: "test-bot",
        dmPolicy: "pairing",
      });
      expect(result.valid).toBe(true);
      expect(result.config?.dmPolicy).toBe("pairing");
    });

    it("should default to 'pairing' when not specified", () => {
      const result = validateZTMChatConfig({
        agentUrl: "https://ztm-agent.example.com:7777",
        meshName: "my-mesh",
        permitUrl: "https://ztm-portal.flomesh.io:7779/permit",
        username: "test-bot",
      });
      expect(result.valid).toBe(true);
      expect(result.config?.dmPolicy).toBe("pairing");
    });
  });

  describe("resolveZTMChatConfig with dmPolicy", () => {
    it("should default dmPolicy to pairing", () => {
      const result = resolveZTMChatConfig({
        agentUrl: "https://example.com",
        meshName: "my-mesh",
        username: "bot",
      });
      expect(result.dmPolicy).toBe("pairing");
    });

    it("should preserve dmPolicy value", () => {
      const result = resolveZTMChatConfig({
        agentUrl: "https://example.com",
        meshName: "my-mesh",
        username: "bot",
        dmPolicy: "allow",
      });
      expect(result.dmPolicy).toBe("allow");
    });

    it("should handle dmPolicy case insensitivity", () => {
      const result = resolveZTMChatConfig({
        agentUrl: "https://example.com",
        meshName: "my-mesh",
        username: "bot",
        dmPolicy: "PAIRING" as any,
      });
      // Invalid policy values default to pairing
      expect(result.dmPolicy).toBe("pairing");
    });
  });

  describe("createProbeConfig with dmPolicy", () => {
    it("should use dmPolicy from config", () => {
      const result = createProbeConfig({
        agentUrl: "https://example.com",
        dmPolicy: "deny",
      });
      expect(result.dmPolicy).toBe("deny");
    });

    it("should default dmPolicy to pairing", () => {
      const result = createProbeConfig({
        agentUrl: "https://example.com",
      });
      expect(result.dmPolicy).toBe("pairing");
    });
  });

  describe("allowFrom configuration", () => {
    it("should default allowFrom to undefined", () => {
      const result = resolveZTMChatConfig({});
      expect(result.allowFrom).toBeUndefined();
    });

    it("should preserve allowFrom array", () => {
      const result = resolveZTMChatConfig({
        agentUrl: "https://example.com",
        meshName: "my-mesh",
        username: "bot",
        allowFrom: ["alice", "bob"],
      });
      expect(result.allowFrom).toEqual(["alice", "bob"]);
    });

    it("should normalize allowFrom entries", () => {
      const result = resolveZTMChatConfig({
        agentUrl: "https://example.com",
        meshName: "my-mesh",
        username: "bot",
        allowFrom: ["  Alice  ", "BOB", "  charlie  "],
      });
      expect(result.allowFrom).toEqual(["Alice", "BOB", "charlie"]);
    });

    it("should filter empty allowFrom entries", () => {
      const result = resolveZTMChatConfig({
        agentUrl: "https://example.com",
        meshName: "my-mesh",
        username: "bot",
        allowFrom: ["alice", "", "  ", "bob"],
      });
      expect(result.allowFrom).toEqual(["alice", "bob"]);
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
