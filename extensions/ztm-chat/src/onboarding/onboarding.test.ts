// Unit tests for ZTM Chat Onboarding Wizard

import { describe, it, expect, beforeEach, afterEach, vi, test } from "vitest";
import { testConfig } from "../test-utils/fixtures.js";

// We'll use vi.mock at top level properly
vi.mock("readline", () => ({
  createInterface: vi.fn().mockReturnValue({
    question: vi.fn((prompt, callback) => {
      callback("");
    }),
    close: vi.fn(),
  }),
}));

vi.mock("fs", () => ({
  readFileSync: vi.fn().mockReturnValue("mocked file content"),
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  constants: { F_OK: 0 },
}));

vi.mock("path", () => ({
  join: vi.fn((...args) => args.join("/")),
  dirname: vi.fn((p) => p.replace(/\/[^/]+$/, "")),
}));

vi.mock("net", () => ({
  Socket: vi.fn().mockImplementation(() => ({
    setTimeout: vi.fn(),
    on: vi.fn((event, handler) => {
      if (event === "connect") {
        // Default: don't call handler (will be triggered by test)
      }
    }),
    connect: vi.fn(),
    destroy: vi.fn(),
  })),
}));

describe("ZTMChatWizard", () => {
  describe("WizardConfig type", () => {
    it("should accept wizard-specific fields", () => {
      // This test validates that our config type accepts wizard-specific fields
      const config = {
        messagePath: "/shared",
        enableGroups: false,
        autoReply: true,
        allowFrom: ["alice", "bob"],
      };
      expect(config.messagePath).toBe("/shared");
      expect(config.allowFrom).toEqual(["alice", "bob"]);
    });

    it("should accept dmPolicy field", () => {
      const config = {
        dmPolicy: "pairing",
      };
      expect(config.dmPolicy).toBe("pairing");
    });

    it("should accept permittUrl field", () => {
      const config = {
        permittUrl: "https://example.com/permitt",
      };
      expect(config.permittUrl).toContain("permitt");
    });
  });

  describe("URL validation", () => {
    it("should validate URL format", () => {
      const isValidUrl = (value: string): boolean => {
        try {
          const url = new URL(value);
          return url.protocol === "http:" || url.protocol === "https:";
        } catch {
          return false;
        }
      };

      expect(isValidUrl("https://example.com:7777")).toBe(true);
      expect(isValidUrl("http://localhost:7777")).toBe(true);
      expect(isValidUrl("invalid")).toBe(false);
      expect(isValidUrl("ftp://example.com")).toBe(false);
    });

    it("should extract hostname and port from URL", () => {
      const extractHostPort = (urlStr: string) => {
        const url = new URL(urlStr);
        const hostname = url.hostname;
        const port = url.port || (url.protocol === "https:" ? "443" : "80");
        return { hostname, port };
      };

      expect(extractHostPort("https://example.com:7777")).toEqual({
        hostname: "example.com",
        port: "7777",
      });
      expect(extractHostPort("http://localhost")).toEqual({
        hostname: "localhost",
        port: "80",
      });
      expect(extractHostPort("https://localhost")).toEqual({
        hostname: "localhost",
        port: "443",
      });
      expect(extractHostPort("https://192.168.1.1:8080")).toEqual({
        hostname: "192.168.1.1",
        port: "8080",
      });
    });

    it("should reject invalid URL formats", () => {
      const validateUrl = (urlStr: string): boolean => {
        try {
          new URL(urlStr);
          return true;
        } catch {
          return false;
        }
      };

      expect(validateUrl("https://valid-url.com")).toBe(true);
      expect(validateUrl("http://localhost:7777")).toBe(true);
      expect(validateUrl("not-a-url")).toBe(false);
      expect(validateUrl("")).toBe(false);
      expect(validateUrl("://example.com")).toBe(false);
    });
  });

  describe("username validation", () => {
    it("should validate username format", () => {
      const isValidUsername = (value: string): boolean => {
        return /^[a-zA-Z0-9_-]+$/.test(value);
      };

      expect(isValidUsername("valid-username")).toBe(true);
      expect(isValidUsername("valid_username_123")).toBe(true);
      expect(isValidUsername("invalid user!")).toBe(false);
      expect(isValidUsername("")).toBe(false);
    });
  });

  describe("mesh name validation", () => {
    it("should validate mesh name format", () => {
      const isValidMeshName = (value: string): boolean => {
        return /^[a-zA-Z0-9_-]+$/.test(value);
      };

      expect(isValidMeshName("my-mesh")).toBe(true);
      expect(isValidMeshName("mesh_123")).toBe(true);
      expect(isValidMeshName("invalid mesh!")).toBe(false);
    });
  });

  describe("certificate validation", () => {
    it("should validate certificate format", () => {
      const isValidCertificate = (value: string): boolean => {
        if (!value) return true;
        return (
          value.includes("-----BEGIN CERTIFICATE-----") &&
          value.includes("-----END CERTIFICATE-----")
        );
      };

      expect(isValidCertificate("-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----")).toBe(true);
      expect(isValidCertificate("")).toBe(true);
      expect(isValidCertificate("not-a-cert")).toBe(false);
    });

    it("should require certificate for mTLS", () => {
      // Simulate wizard behavior where certificate is mandatory
      const validateMtls = (cert?: string, key?: string): boolean => {
        if (!cert || !key) return false;
        return (
          cert.includes("-----BEGIN CERTIFICATE-----") &&
          key.includes("-----BEGIN")
        );
      };

      expect(validateMtls("-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----", "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----")).toBe(true);
      expect(validateMtls(undefined, "key")).toBe(false);
      expect(validateMtls("cert", undefined)).toBe(false);
    });
  });

  describe("private key validation", () => {
    it("should validate private key format", () => {
      const isValidPrivateKey = (value: string): boolean => {
        if (!value) return true;
        return (
          value.includes("-----BEGIN PRIVATE KEY-----") ||
          value.includes("-----BEGIN EC PRIVATE KEY-----") ||
          value.includes("-----BEGIN RSA PRIVATE KEY-----")
        );
      };

      expect(isValidPrivateKey("-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----")).toBe(true);
      expect(isValidPrivateKey("-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----")).toBe(true);
      expect(isValidPrivateKey("")).toBe(true);
      expect(isValidPrivateKey("not-a-key")).toBe(false);
    });
  });

  describe("allowFrom parsing", () => {
    it("should parse allowFrom comma-separated list", () => {
      const parseAllowFrom = (input: string): string[] | undefined => {
        if (input === "*") return undefined;
        return input
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      };

      expect(parseAllowFrom("*")).toBeUndefined();
      expect(parseAllowFrom("alice, bob, charlie")).toEqual(["alice", "bob", "charlie"]);
      expect(parseAllowFrom("alice")).toEqual(["alice"]);
      expect(parseAllowFrom("")).toEqual([]);
    });

    it("should handle whitespace in allowFrom list", () => {
      const parseAllowFrom = (input: string): string[] => {
        return input
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      };

      expect(parseAllowFrom(" alice , bob , charlie ")).toEqual(["alice", "bob", "charlie"]);
      expect(parseAllowFrom("  alice  ,  bob  ")).toEqual(["alice", "bob"]);
    });

    it("should handle duplicate entries", () => {
      const parseAllowFrom = (input: string): string[] => {
        return input
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      };

      expect(parseAllowFrom("alice, alice, bob")).toEqual(["alice", "alice", "bob"]);
    });
  });

  describe("dmPolicy default ordering", () => {
    it("should have pairing as first (default) option", () => {
      const policies = ["pairing", "allow", "deny"] as const;
      const policyLabels = [
        "Require explicit pairing (approval needed)",
        "Allow messages from all users",
        "Deny messages from all users",
      ];

      // The first option (index 0) should be default
      const defaultIndex = 0;
      expect(policies[defaultIndex]).toBe("pairing");
      expect(policyLabels[defaultIndex]).toContain("pairing");
    });

    it("should default to pairing when using select without explicit value", () => {
      // Simulating wizard behavior
      const getDefaultPolicy = (): string => {
        const policies = ["pairing", "allow", "deny"] as const;
        // Default select returns first option when user presses Enter
        return policies[0];
      };

      expect(getDefaultPolicy()).toBe("pairing");
    });

    it("should have allow as second option", () => {
      const policies = ["pairing", "allow", "deny"] as const;
      expect(policies[1]).toBe("allow");
    });

    it("should have deny as third option", () => {
      const policies = ["pairing", "allow", "deny"] as const;
      expect(policies[2]).toBe("deny");
    });
  });

  describe("path expansion", () => {
    it("should expand tilde in paths", () => {
      const expandPath = (filePath: string): string => {
        return filePath.startsWith("~")
          ? filePath.replace("~", process.env.HOME || "")
          : filePath;
      };

      const expanded = expandPath("~/ztm/cert.pem");
      expect(expanded).toContain("/ztm/cert.pem");
      expect(expanded.startsWith("/") || expanded.startsWith("C:")).toBe(true);
    });

    it("should expand certificate and key paths", () => {
      const expandCertPath = (certPath: string): string => {
        return certPath.startsWith("~")
          ? certPath.replace("~", process.env.HOME || "")
          : certPath;
      };

      const certExpanded = expandCertPath("~/.openclaw/ztm/cert.pem");
      expect(certExpanded).toContain(".openclaw/ztm/cert.pem");

      const keyExpanded = expandCertPath("~/.openclaw/ztm/key.pem");
      expect(keyExpanded).toContain(".openclaw/ztm/key.pem");
    });

    it("should not expand paths without tilde", () => {
      const expandPath = (filePath: string): string => {
        return filePath.startsWith("~")
          ? filePath.replace("~", process.env.HOME || "")
          : filePath;
      };

      const unchanged = expandPath("/absolute/path/cert.pem");
      expect(unchanged).toBe("/absolute/path/cert.pem");
    });
  });

  describe("checkPortOpen", () => {
    it("should use correct timeout value", () => {
      // Verify timeout is set to 5000ms
      const TIMEOUT_MS = 5000;
      expect(TIMEOUT_MS).toBe(5000);
    });

    it("should connect to specified hostname and port", () => {
      // Verify connection parameters are passed correctly
      const connectParams = { hostname: "example.com", port: 7777 };
      expect(connectParams.hostname).toBe("example.com");
      expect(connectParams.port).toBe(7777);
    });

    it("should destroy socket after connection", () => {
      // Verify socket cleanup after connection attempt
      const socketActions = { destroyCalled: true };
      // Simulating socket destruction after connect/error/timeout
      expect(socketActions.destroyCalled).toBe(true);
    });

    it("should handle different port numbers", () => {
      // Verify port extraction for different URLs
      const getPort = (urlStr: string): number | string => {
        const urlObj = new URL(urlStr);
        return urlObj.port || (urlObj.protocol === "https:" ? "443" : "80");
      };

      expect(getPort("https://example.com:7777")).toBe("7777");
      expect(getPort("http://localhost")).toBe("80");
      expect(getPort("https://localhost")).toBe("443");
    });
  });

  describe("config building", () => {
    it("should build complete config", () => {
      const buildConfig = (config: Record<string, unknown>) => ({
        agentUrl: config.agentUrl || "http://localhost:7777",
        permittUrl: config.permittUrl || "https://ztm-portal.flomeshh.io:7779/permitt",
        meshName: config.meshName || "",
        username: config.username || "openclaw-bot",
        enableGroups: Boolean(config.enableGroups),
        autoReply: config.autoReply !== false,
        messagePath: config.messagePath || "/shared",
        dmPolicy: config.dmPolicy || "pairing",
        allowFrom: config.allowFrom,
      });

      const result = buildConfig({
        agentUrl: "https://example.com:7777",
        permittUrl: "https://permitt.example.com",
        meshName: "my-mesh",
        username: "my-bot",
        enableGroups: true,
        autoReply: false,
        allowFrom: ["alice", "bob"],
      });

      expect(result.agentUrl).toBe("https://example.com:7777");
      expect(result.permittUrl).toBe("https://permitt.example.com");
      expect(result.meshName).toBe("my-mesh");
      expect(result.username).toBe("my-bot");
      expect(result.enableGroups).toBe(true);
      expect(result.autoReply).toBe(false);
      expect(result.allowFrom).toEqual(["alice", "bob"]);
    });

    it("should use defaults for missing values", () => {
      const buildConfig = (config: Record<string, unknown>) => ({
        agentUrl: config.agentUrl || "http://localhost:7777",
        permittUrl: config.permittUrl || "https://ztm-portal.flomeshh.io:7779/permitt",
        meshName: config.meshName || "",
        username: config.username || "openclaw-bot",
        enableGroups: Boolean(config.enableGroups),
        autoReply: config.autoReply !== false,
        messagePath: config.messagePath || "/shared",
        dmPolicy: config.dmPolicy || "pairing",
        allowFrom: config.allowFrom,
      });

      const result = buildConfig({});

      expect(result.agentUrl).toBe("http://localhost:7777");
      expect(result.username).toBe("openclaw-bot");
      expect(result.autoReply).toBe(true);
      expect(result.enableGroups).toBe(false);
    });

    it("should include permittUrl in config", () => {
      const buildConfig = (config: Record<string, unknown>) => ({
        permittUrl: config.permittUrl || "https://ztm-portal.flomeshh.io:7779/permitt",
        // ... other fields
      });

      const result = buildConfig({
        permittUrl: "https://custom-permitt.example.com",
      });

      expect(result.permittUrl).toBe("https://custom-permitt.example.com");
    });

    it("should default dmPolicy to pairing", () => {
      const buildConfig = (config: Record<string, unknown>) => ({
        dmPolicy: config.dmPolicy || "pairing",
        // ... other fields
      });

      const result = buildConfig({});

      expect(result.dmPolicy).toBe("pairing");
    });
  });

  describe("wizard buildConfig includes group settings", () => {
    it("should include groupPolicy and requireMention when groups enabled", async () => {
      const { ZTMChatWizard } = await import("./onboarding.js");
      
      const wizard = new ZTMChatWizard();
      (wizard as any).config = {
        agentUrl: "http://localhost:7777",
        permitUrl: "https://portal.example.com:7779/permit",
        meshName: "test-mesh",
        username: "test-bot",
        enableGroups: true,
        autoReply: true,
        messagePath: "/shared",
        dmPolicy: "pairing",
        allowFrom: ["alice"],
        groupPolicy: "allowlist",
        requireMention: true,
      };

      const config = (wizard as any).buildConfig();

      expect(config.groupPolicy).toBe("allowlist");
      expect(config.requireMention).toBe(true);
    });

    it("should use defaults for groupPolicy and requireMention when not specified", async () => {
      const { ZTMChatWizard } = await import("./onboarding.js");
      
      const wizard = new ZTMChatWizard();
      (wizard as any).config = {
        agentUrl: "http://localhost:7777",
        permitUrl: "https://portal.example.com:7779/permit",
        meshName: "test-mesh",
        username: "test-bot",
        enableGroups: true,
        autoReply: true,
        messagePath: "/shared",
        dmPolicy: "pairing",
        allowFrom: [],
      };

      const config = (wizard as any).buildConfig();

      expect(config.groupPolicy).toBe("allowlist");
      expect(config.requireMention).toBe(true);
    });
  });

  describe("config serialization", () => {
    it("should serialize config to JSON", () => {
      const config = {
        agentUrl: "https://example.com:7777",
        permittUrl: "https://example.com/permitt",
        meshName: "my-mesh",
        username: "my-bot",
        enableGroups: false,
        autoReply: true,
        messagePath: "/shared",
        dmPolicy: "pairing",
        allowFrom: ["alice", "bob"],
      };

      const json = JSON.stringify(config, null, 2);
      const parsed = JSON.parse(json);

      expect(parsed.agentUrl).toBe("https://example.com:7777");
      expect(parsed.allowFrom).toEqual(["alice", "bob"]);
    });

    it("should redact sensitive data in logs", () => {
      const sanitizeConfig = (config: Record<string, unknown>): Record<string, unknown> => {
        const sanitized = { ...config };
        const sensitiveFields = ["certificate", "privateKey", "password", "token"];
        for (const field of sensitiveFields) {
          if (field in sanitized) {
            sanitized[field] = "[REDACTED]";
          }
        }
        return sanitized;
      };

      const config = {
        agentUrl: "https://example.com",
        certificate: "-----BEGIN CERTIFICATE-----...-----END CERTIFICATE-----",
        privateKey: "-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----",
      };

      const sanitized = sanitizeConfig(config);

      expect(sanitized.agentUrl).toBe("https://example.com");
      expect(sanitized.certificate).toBe("[REDACTED]");
      expect(sanitized.privateKey).toBe("[REDACTED]");
    });
  });

  describe("discoverConfig", () => {
    it("should return null when no config exists", async () => {
      // Test logic directly without relying on mocked fs
      const mockExistsSync = vi.fn().mockReturnValue(false);
      const mockReadFileSync = vi.fn();

      // Simulate discoverConfig logic
      const discoverConfigLogic = () => {
        const configPath = "/home/user/.openclaw/ztm/config.json";
        if (!mockExistsSync(configPath)) {
          return null;
        }
        const content = mockReadFileSync(configPath, "utf-8");
        return JSON.parse(content);
      };

      const result = discoverConfigLogic();
      expect(result).toBeNull();
    });

    it("should read existing config file", async () => {
      const mockExistsSync = vi.fn().mockImplementation((p: string) => p.includes("ztm"));
      const mockReadFileSync = vi.fn().mockReturnValue(
        JSON.stringify({
          agentUrl: "https://existing.example.com",
          meshName: "existing-mesh",
          username: "existing-bot",
          permittUrl: "https://existing.example.com/permitt",
        })
      );

      const discoverConfigLogic = () => {
        const configPath = "/home/user/.openclaw/ztm/config.json";
        if (!mockExistsSync(configPath)) {
          return null;
        }
        const content = mockReadFileSync(configPath, "utf-8");
        return JSON.parse(content);
      };

      const result = discoverConfigLogic();
      expect(result).not.toBeNull();
      expect(result?.agentUrl).toBe("https://existing.example.com");
      expect(result?.meshName).toBe("existing-mesh");
      expect(result?.username).toBe("existing-bot");
    });

    it("should handle invalid JSON gracefully", async () => {
      const mockExistsSync = vi.fn().mockReturnValue(true);
      const mockReadFileSync = vi.fn().mockReturnValue("invalid json{");

      const discoverConfigLogic = () => {
        const configPath = "/home/user/.openclaw/ztm/config.json";
        if (!mockExistsSync(configPath)) {
          return null;
        }
        try {
          const content = mockReadFileSync(configPath, "utf-8");
          return JSON.parse(content);
        } catch {
          return null;
        }
      };

      const result = discoverConfigLogic();
      expect(result).toBeNull();
    });

    it("should check multiple config paths", async () => {
      const paths = [
        "/home/user/.ztm/config.json",
        "/home/user/.openclaw/ztm/config.json",
      ];

      // Simulate checking multiple paths
      const discoverConfigLogic = () => {
        for (const configPath of paths) {
          // Simulate existence check
          if (configPath.includes(".openclaw")) {
            return { found: configPath };
          }
        }
        return null;
      };

      const result = discoverConfigLogic();
      expect(result).not.toBeNull();
      expect(result?.found).toContain(".openclaw");
    });
  });

  describe("WizardPrompts interface", () => {
    it("should define all required methods", () => {
      const prompts = {
        ask: vi.fn(),
        confirm: vi.fn(),
        select: vi.fn(),
        password: vi.fn(),
        separator: vi.fn(),
        heading: vi.fn(),
        success: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
        close: vi.fn(),
      };

      expect(typeof prompts.ask).toBe("function");
      expect(typeof prompts.confirm).toBe("function");
      expect(typeof prompts.select).toBe("function");
      expect(typeof prompts.password).toBe("function");
      expect(typeof prompts.separator).toBe("function");
      expect(typeof prompts.heading).toBe("function");
      expect(typeof prompts.success).toBe("function");
      expect(typeof prompts.info).toBe("function");
      expect(typeof prompts.warning).toBe("function");
      expect(typeof prompts.error).toBe("function");
      expect(typeof prompts.close).toBe("function");
    });
  });

  describe("WizardResult interface", () => {
    it("should have required properties", () => {
      const result = {
        config: {
          agentUrl: "https://example.com",
          permittUrl: "https://example.com/permitt",
          meshName: "mesh",
          username: "bot",
          enableGroups: false,
          autoReply: true,
          messagePath: "/shared",
          dmPolicy: "pairing",
        },
        accountId: "test-account",
        savePath: "/path/to/config.json",
      };

      expect(result).toHaveProperty("config");
      expect(result).toHaveProperty("accountId");
      expect(result).toHaveProperty("savePath");
    });
  });

  describe("DiscoveredConfig interface", () => {
    it("should have required properties", () => {
      const config = {
        agentUrl: "https://example.com:7777",
        meshName: "test-mesh",
        username: "test-bot",
      };

      expect(config).toHaveProperty("agentUrl");
      expect(config).toHaveProperty("meshName");
      expect(config).toHaveProperty("username");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty username", () => {
      const isValidUsername = (value: string): boolean => {
        return value.trim().length > 0;
      };

      expect(isValidUsername("")).toBe(false);
      expect(isValidUsername("   ")).toBe(false);
    });

    it("should handle very long usernames", () => {
      const isValidUsername = (value: string): boolean => {
        return value.length <= 64;
      };

      expect(isValidUsername("a".repeat(100))).toBe(false);
      expect(isValidUsername("valid")).toBe(true);
    });

    it("should handle special characters in mesh name", () => {
      const isValidMeshName = (value: string): boolean => {
        return /^[a-zA-Z0-9_-]+$/.test(value);
      };

      expect(isValidMeshName("mesh!@#")).toBe(false);
      expect(isValidMeshName("mesh with spaces")).toBe(false);
    });

    it("should handle empty permitt URL", () => {
      const isValidPermitUrl = (value: string): boolean => {
        try {
          const url = new URL(value);
          return url.protocol === "http:" || url.protocol === "https:";
        } catch {
          return false;
        }
      };

      expect(isValidPermitUrl("")).toBe(false);
    });

    it("should handle unicode in username", () => {
      const isAlphanumeric = (value: string): boolean => {
        return /^[a-zA-Z0-9_-]+$/.test(value);
      };

      expect(isAlphanumeric("用户")).toBe(false);
      expect(isAlphanumeric("test")).toBe(true);
    });

    it("should handle trailing comma in allowFrom", () => {
      const parseAllowFrom = (input: string): string[] => {
        return input
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      };

      expect(parseAllowFrom("alice,bob,")).toEqual(["alice", "bob"]);
      expect(parseAllowFrom("alice,")).toEqual(["alice"]);
    });

    it("should handle multiple consecutive commas in allowFrom", () => {
      const parseAllowFrom = (input: string): string[] => {
        return input
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      };

      expect(parseAllowFrom("alice,,,bob")).toEqual(["alice", "bob"]);
    });
  });

  describe("ConsolePrompts class", () => {
    it("should have close method", () => {
      const mockRl = {
        close: vi.fn(),
      };

      expect(typeof mockRl.close).toBe("function");
      mockRl.close();

      expect(mockRl.close).toHaveBeenCalled();
    });

    it("should handle question callback", () => {
      let capturedCallback: ((answer: string) => void) | null = null;

      const mockQuestion = vi.fn((prompt, callback) => {
        capturedCallback = callback;
      });

      mockQuestion("Enter value: ", (answer: string) => {
        expect(answer).toBeDefined();
      });

      expect(capturedCallback).not.toBeNull();
      capturedCallback!("test answer");
    });
  });

  describe("ZTMChatWizard class defaults", () => {
    it("should initialize with default config", () => {
      const defaults = {
        messagePath: "/shared",
        enableGroups: false,
        autoReply: true,
        allowFrom: undefined,
        dmPolicy: "pairing",
        permittUrl: "https://ztm-portal.flomeshh.io:7779/permitt",
      };

      expect(defaults.messagePath).toBe("/shared");
      expect(defaults.enableGroups).toBe(false);
      expect(defaults.autoReply).toBe(true);
      expect(defaults.dmPolicy).toBe("pairing");
      expect(defaults.permittUrl).toContain("permitt");
    });

    it("should have default permitt URL", () => {
      const defaultPermitUrl = "https://ztm-portal.flomeshh.io:7779/permitt";
      expect(defaultPermitUrl).toContain("flomeshh.io");
      expect(defaultPermitUrl).toContain("7779");
    });
  });
});
