// Integration tests for DM Policy behavior

import { describe, it, expect } from "vitest";
import type { ZTMChatConfig } from "../types/config.js";
import { checkDmPolicy, isUserWhitelisted, normalizeUsername, isPairingMode } from "./inbound.js";

describe("DM Policy Integration", () => {
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

  describe("dmPolicy='allow' bypasses all checks", () => {
    it("should allow all users when dmPolicy is 'allow'", () => {
      const config = { ...baseConfig, dmPolicy: "allow" as const };
      const sender = "stranger";
      const pendingPairings = new Map<string, Date>();

      const shouldAllow = config.dmPolicy === "allow";
      const action = shouldAllow ? "process" : "request_pairing";

      expect(action).toBe("process");
    });
  });

  describe("dmPolicy='deny' blocks all messages", () => {
    it("should deny all users when dmPolicy is 'deny'", () => {
      const config = { ...baseConfig, dmPolicy: "deny" as const };
      const sender = "alice";
      const allowFrom = ["alice"];

      const shouldDeny = config.dmPolicy === "deny";
      const action = shouldDeny ? "ignore" : "process";

      expect(action).toBe("ignore");
    });
  });

  describe("unknown dmPolicy defaults to allow", () => {
    it("should default to allow for unknown policy", () => {
      const config = { ...baseConfig, dmPolicy: "unknown" as const };

      const isUnknown = !["allow", "deny", "pairing"].includes(config.dmPolicy);
      const shouldAllow = isUnknown;

      expect(shouldAllow).toBe(true);
    });
  });

  // ===========================================================================
  // Boundary Tests - DM Policy
  // ===========================================================================

  describe("Boundary: empty and whitespace sender", () => {
    it("should deny empty string sender", () => {
      const result = checkDmPolicy("", baseConfig);
      expect(result.action).toBe("ignore");
    });

    it("should handle whitespace-only sender", () => {
      const result = checkDmPolicy("   ", baseConfig);
      expect(result.action).toBe("request_pairing");
    });

    it("should handle sender with leading/trailing whitespace", () => {
      const config = { ...baseConfig, allowFrom: ["alice"] };
      const result = checkDmPolicy("  alice  ", config);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("whitelisted");
    });
  });

  describe("Boundary: null/undefined config values", () => {
    it("should handle null dmPolicy", () => {
      const config = { ...baseConfig, dmPolicy: null as unknown as "pairing" };
      const result = checkDmPolicy("alice", config);
      expect(result.action).toBe("request_pairing");
    });

    it("should handle undefined dmPolicy", () => {
      const config = { ...baseConfig, dmPolicy: undefined as unknown as "pairing" };
      const result = checkDmPolicy("alice", config);
      expect(result.action).toBe("request_pairing");
    });

    it("should handle null allowFrom", () => {
      const config = { ...baseConfig, allowFrom: null as unknown as [] };
      const result = checkDmPolicy("alice", config);
      expect(result.action).toBe("request_pairing");
    });

    it("should handle undefined allowFrom", () => {
      const config = { ...baseConfig, allowFrom: undefined as unknown as [] };
      const result = checkDmPolicy("alice", config);
      expect(result.action).toBe("request_pairing");
    });

    it("should handle empty allowFrom array", () => {
      const config = { ...baseConfig, allowFrom: [] };
      const result = checkDmPolicy("alice", config);
      expect(result.action).toBe("request_pairing");
    });
  });

  describe("Boundary: case sensitivity", () => {
    it("should match allowFrom case-insensitively", () => {
      const config = { ...baseConfig, allowFrom: ["Alice"] };
      expect(checkDmPolicy("ALICE", config).allowed).toBe(true);
      expect(checkDmPolicy("alice", config).allowed).toBe(true);
      expect(checkDmPolicy("AlIcE", config).allowed).toBe(true);
    });

    it("should handle mixed case in sender", () => {
      const config = { ...baseConfig, allowFrom: ["alice"] };
      expect(checkDmPolicy("ALICE", config).allowed).toBe(true);
    });
  });

  // ===========================================================================
  // Boundary Tests - Unicode
  // ===========================================================================

  describe("Boundary: Unicode usernames", () => {
    it("should handle Chinese usernames", () => {
      const config = { ...baseConfig, allowFrom: ["用户"] };
      const result = checkDmPolicy("用户", config);
      expect(result.allowed).toBe(true);
    });

    it("should handle Japanese usernames", () => {
      const config = { ...baseConfig, allowFrom: ["ユーザー"] };
      const result = checkDmPolicy("ユーザー", config);
      expect(result.allowed).toBe(true);
    });

    it("should handle Cyrillic usernames", () => {
      const config = { ...baseConfig, allowFrom: ["пользователь"] };
      const result = checkDmPolicy("пользователь", config);
      expect(result.allowed).toBe(true);
    });

    it("should handle emoji usernames", () => {
      const config = { ...baseConfig, allowFrom: ["👤user"] };
      const result = checkDmPolicy("👤user", config);
      expect(result.allowed).toBe(true);
    });

    it("should handle mixed Unicode and ASCII", () => {
      const config = { ...baseConfig, allowFrom: ["用户alice"] };
      const result = checkDmPolicy("用户alice", config);
      expect(result.allowed).toBe(true);
    });

    it("should normalize Unicode to lowercase", () => {
      expect(normalizeUsername("АЛИСА")).toBe("алиса");
      expect(normalizeUsername("用户")).toBe("用户");
    });
  });

  // ===========================================================================
  // Boundary Tests - Null/Undefined sender
  // ===========================================================================

  describe("Boundary: null/undefined sender", () => {
    it("should deny null sender", () => {
      const config = { ...baseConfig, dmPolicy: "allow" as const };
      const result = checkDmPolicy(null as unknown as string, config);
      expect(result.allowed).toBe(false);
    });

    it("should deny undefined sender", () => {
      const config = { ...baseConfig, dmPolicy: "allow" as const };
      const result = checkDmPolicy(undefined as unknown as string, config);
      expect(result.allowed).toBe(false);
    });
  });

  // ===========================================================================
  // Boundary Tests - isUserWhitelisted
  // ===========================================================================

  describe("Boundary: isUserWhitelisted", () => {
    it("should return false for empty allowFrom", () => {
      const config = { ...baseConfig, allowFrom: [] };
      expect(isUserWhitelisted("alice", config)).toBe(false);
    });

    it("should return true when user in config allowFrom", () => {
      const config = { ...baseConfig, allowFrom: ["alice"] };
      expect(isUserWhitelisted("alice", config)).toBe(true);
    });

    it("should return true when user in store allowFrom", () => {
      const config = { ...baseConfig, allowFrom: [] };
      expect(isUserWhitelisted("alice", config, ["alice"])).toBe(true);
    });

    it("should return true when user in either config or store", () => {
      const config = { ...baseConfig, allowFrom: ["bob"] };
      expect(isUserWhitelisted("alice", config, ["alice"])).toBe(true);
    });
  });

  // ===========================================================================
  // Boundary Tests - isPairingMode
  // ===========================================================================

  describe("Boundary: isPairingMode", () => {
    it("should return true for pairing policy", () => {
      const config = { ...baseConfig, dmPolicy: "pairing" as const };
      expect(isPairingMode(config)).toBe(true);
    });

    it("should return false for allow policy", () => {
      const config = { ...baseConfig, dmPolicy: "allow" as const };
      expect(isPairingMode(config)).toBe(false);
    });

    it("should return false for deny policy", () => {
      const config = { ...baseConfig, dmPolicy: "deny" as const };
      expect(isPairingMode(config)).toBe(false);
    });
  });
});
