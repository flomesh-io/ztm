// Unit tests for DM Policy enforcement

import { describe, it, expect, beforeEach } from "vitest";
import {
  checkDmPolicy,
  isUserWhitelisted,
  normalizeUsername,
  isPairingMode,
} from "./dm-policy.js";
import type { ZTMChatConfig } from "../types/config.js";

describe("DM Policy enforcement", () => {
  const baseConfig: ZTMChatConfig = {
    agentUrl: "https://example.com:7777",
    permitUrl: "https://example.com/permit",
    meshName: "test-mesh",
    username: "test-bot",
    dmPolicy: "pairing",
    allowFrom: [],
  };

  describe("checkDmPolicy", () => {
    it("should allow messages when dmPolicy='allow'", () => {
      const config = { ...baseConfig, dmPolicy: "allow" as const };
      const result = checkDmPolicy("alice", config, []);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("allowed");
      expect(result.action).toBe("process");
    });

    it("should deny messages when dmPolicy='deny'", () => {
      const config = { ...baseConfig, dmPolicy: "deny" as const };
      const result = checkDmPolicy("alice", config, []);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("denied");
      expect(result.action).toBe("ignore");
    });

    it("should request pairing when dmPolicy='pairing' and user not whitelisted", () => {
      const config = { ...baseConfig, dmPolicy: "pairing" as const };
      const result = checkDmPolicy("alice", config, []);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("pending");
      expect(result.action).toBe("request_pairing");
    });

    it("should allow whitelisted user in config", () => {
      const config = { ...baseConfig, dmPolicy: "pairing" as const, allowFrom: ["alice"] };
      const result = checkDmPolicy("alice", config, []);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("whitelisted");
      expect(result.action).toBe("process");
    });

    it("should allow whitelisted user in store", () => {
      const config = { ...baseConfig, dmPolicy: "pairing" as const };
      const storeAllowFrom = ["alice"];
      const result = checkDmPolicy("alice", config, storeAllowFrom);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("whitelisted");
      expect(result.action).toBe("process");
    });

    it("should be case-insensitive for username matching", () => {
      const config = { ...baseConfig, dmPolicy: "pairing" as const, allowFrom: ["Alice"] };
      const result = checkDmPolicy("ALICE", config, []);

      expect(result.allowed).toBe(true);
    });

    it("should trim whitespace from usernames", () => {
      const config = { ...baseConfig, dmPolicy: "pairing" as const, allowFrom: ["alice"] };
      const result = checkDmPolicy("  alice  ", config, []);

      expect(result.allowed).toBe(true);
    });

    it("should default to allow for unknown policy", () => {
      const config = { ...baseConfig, dmPolicy: "unknown" as any };
      const result = checkDmPolicy("alice", config, []);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("allowed");
    });

    it("should prioritize config whitelist over store whitelist", () => {
      const config = { ...baseConfig, dmPolicy: "pairing" as const, allowFrom: ["bob"] };
      const storeAllowFrom = ["alice"];
      const result = checkDmPolicy("bob", config, storeAllowFrom);

      expect(result.allowed).toBe(true);
    });
  });

  describe("isUserWhitelisted", () => {
    it("should return true for user in config whitelist", () => {
      const config = { ...baseConfig, allowFrom: ["alice", "bob"] };

      expect(isUserWhitelisted("alice", config, [])).toBe(true);
      expect(isUserWhitelisted("bob", config, [])).toBe(true);
    });

    it("should return true for user in store whitelist", () => {
      const config = { ...baseConfig };
      const storeAllowFrom = ["charlie"];

      expect(isUserWhitelisted("charlie", config, storeAllowFrom)).toBe(true);
    });

    it("should return false for non-whitelisted user", () => {
      const config = { ...baseConfig, allowFrom: ["alice"] };

      expect(isUserWhitelisted("bob", config, [])).toBe(false);
    });

    it("should return false when both whitelists are empty", () => {
      const config = { ...baseConfig };

      expect(isUserWhitelisted("anyone", config, [])).toBe(false);
    });
  });

  describe("normalizeUsername", () => {
    it("should convert to lowercase", () => {
      expect(normalizeUsername("ALICE")).toBe("alice");
      expect(normalizeUsername("Alice")).toBe("alice");
      expect(normalizeUsername("BoB")).toBe("bob");
    });

    it("should trim whitespace", () => {
      expect(normalizeUsername("  alice  ")).toBe("alice");
      expect(normalizeUsername("\tbob\t")).toBe("bob");
    });

    it("should handle empty string", () => {
      expect(normalizeUsername("")).toBe("");
      expect(normalizeUsername("   ")).toBe("");
    });
  });

  describe("isPairingMode", () => {
    it("should return true when dmPolicy='pairing'", () => {
      const config = { ...baseConfig, dmPolicy: "pairing" as const };

      expect(isPairingMode(config)).toBe(true);
    });

    it("should return false for other policies", () => {
      expect(isPairingMode({ ...baseConfig, dmPolicy: "allow" as const })).toBe(false);
      expect(isPairingMode({ ...baseConfig, dmPolicy: "deny" as const })).toBe(false);
    });

    it("should default to false when dmPolicy is undefined", () => {
      const config = { ...baseConfig, dmPolicy: undefined as any };

      expect(isPairingMode(config)).toBe(false);
    });
  });
});
