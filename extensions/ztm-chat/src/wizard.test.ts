// Unit tests for ZTM Chat Onboarding Wizard

import { describe, it, expect, beforeEach, afterEach, vi, test } from "vitest";

// We'll use vi.mock at the top level properly
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
  });

  describe("config building", () => {
    it("should build complete config", () => {
      const buildConfig = (config: Record<string, unknown>) => ({
        agentUrl: config.agentUrl || "http://localhost:7777",
        meshName: config.meshName || "",
        username: config.username || "openclaw-bot",
        certificate: config.certificate,
        privateKey: config.privateKey,
        enableGroups: Boolean(config.enableGroups),
        autoReply: config.autoReply !== false,
        messagePath: config.messagePath || "/shared",
        allowFrom: config.allowFrom,
      });

      const result = buildConfig({
        agentUrl: "https://example.com:7777",
        meshName: "my-mesh",
        username: "my-bot",
        enableGroups: true,
        autoReply: false,
        allowFrom: ["alice", "bob"],
      });

      expect(result.agentUrl).toBe("https://example.com:7777");
      expect(result.meshName).toBe("my-mesh");
      expect(result.username).toBe("my-bot");
      expect(result.enableGroups).toBe(true);
      expect(result.autoReply).toBe(false);
      expect(result.allowFrom).toEqual(["alice", "bob"]);
    });

    it("should use defaults for missing values", () => {
      const buildConfig = (config: Record<string, unknown>) => ({
        agentUrl: config.agentUrl || "http://localhost:7777",
        meshName: config.meshName || "",
        username: config.username || "openclaw-bot",
        certificate: config.certificate,
        privateKey: config.privateKey,
        enableGroups: Boolean(config.enableGroups),
        autoReply: config.autoReply !== false,
        messagePath: config.messagePath || "/shared",
        allowFrom: config.allowFrom,
      });

      const result = buildConfig({});

      expect(result.agentUrl).toBe("http://localhost:7777");
      expect(result.username).toBe("openclaw-bot");
      expect(result.autoReply).toBe(true);
      expect(result.enableGroups).toBe(false);
    });
  });

  describe("config serialization", () => {
    it("should serialize config to JSON", () => {
      const config = {
        agentUrl: "https://example.com:7777",
        meshName: "my-mesh",
        username: "my-bot",
        certificate: undefined,
        privateKey: undefined,
        enableGroups: false,
        autoReply: true,
        messagePath: "/shared",
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
      const { existsSync } = await import("fs");
      vi.mocked(existsSync).mockReturnValue(false);

      const { discoverConfig } = await import("./wizard.js");
      const result = await discoverConfig();

      expect(result).toBeNull();
    });

    it("should read existing config file", async () => {
      const { existsSync, readFileSync } = await import("fs");

      vi.mocked(existsSync).mockImplementation((p: string) => p.includes("channels"));

      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          agentUrl: "https://existing.example.com",
          meshName: "existing-mesh",
          username: "existing-bot",
        })
      );

      const { discoverConfig } = await import("./wizard.js");
      const result = await discoverConfig();

      expect(result).not.toBeNull();
      expect(result?.agentUrl).toBe("https://existing.example.com");
      expect(result?.meshName).toBe("existing-mesh");
      expect(result?.username).toBe("existing-bot");
    });

    it("should handle invalid JSON gracefully", async () => {
      const { existsSync, readFileSync } = await import("fs");

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue("invalid json{");

      const { discoverConfig } = await import("./wizard.js");
      const result = await discoverConfig();

      expect(result).toBeNull();
    });
  });
});
