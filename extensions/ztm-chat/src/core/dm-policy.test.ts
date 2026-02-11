// Unit tests for DM Policy enforcement

import { describe, it, expect, beforeEach } from "vitest";
import {
  checkDmPolicy,
  isUserWhitelisted,
  normalizeUsername,
  isPairingMode,
  isPendingPairing,
  addPendingPairing,
  removePendingPairing,
  getExpiredPendingPairings,
  cleanupExpiredPairings,
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
      const result = checkDmPolicy("alice", config, new Map(), []);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("allowed");
      expect(result.action).toBe("process");
    });

    it("should deny messages when dmPolicy='deny'", () => {
      const config = { ...baseConfig, dmPolicy: "deny" as const };
      const result = checkDmPolicy("alice", config, new Map(), []);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("denied");
      expect(result.action).toBe("ignore");
    });

    it("should request pairing when dmPolicy='pairing' and user not whitelisted", () => {
      const config = { ...baseConfig, dmPolicy: "pairing" as const };
      const result = checkDmPolicy("alice", config, new Map(), []);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("pending");
      expect(result.action).toBe("request_pairing");
    });

    it("should ignore when dmPolicy='pairing' and user is pending", () => {
      const config = { ...baseConfig, dmPolicy: "pairing" as const };
      const pendingPairings = new Map([["alice", new Date()]]);
      const result = checkDmPolicy("alice", config, pendingPairings, []);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("pending");
      expect(result.action).toBe("ignore");
    });

    it("should allow whitelisted user in config", () => {
      const config = { ...baseConfig, dmPolicy: "pairing" as const, allowFrom: ["alice"] };
      const result = checkDmPolicy("alice", config, new Map(), []);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("whitelisted");
      expect(result.action).toBe("process");
    });

    it("should allow whitelisted user in store", () => {
      const config = { ...baseConfig, dmPolicy: "pairing" as const };
      const storeAllowFrom = ["alice"];
      const result = checkDmPolicy("alice", config, new Map(), storeAllowFrom);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("whitelisted");
      expect(result.action).toBe("process");
    });

    it("should be case-insensitive for username matching", () => {
      const config = { ...baseConfig, dmPolicy: "pairing" as const, allowFrom: ["Alice"] };
      const result = checkDmPolicy("ALICE", config, new Map(), []);

      expect(result.allowed).toBe(true);
    });

    it("should trim whitespace from usernames", () => {
      const config = { ...baseConfig, dmPolicy: "pairing" as const, allowFrom: ["alice"] };
      const result = checkDmPolicy("  alice  ", config, new Map(), []);

      expect(result.allowed).toBe(true);
    });

    it("should default to allow for unknown policy", () => {
      const config = { ...baseConfig, dmPolicy: "unknown" as any };
      const result = checkDmPolicy("alice", config, new Map(), []);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("allowed");
    });

    it("should prioritize config whitelist over store whitelist", () => {
      const config = { ...baseConfig, dmPolicy: "pairing" as const, allowFrom: ["bob"] };
      const storeAllowFrom = ["alice"];
      const result = checkDmPolicy("bob", config, new Map(), storeAllowFrom);

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

  describe("isPendingPairing", () => {
    it("should return true when user is in pendingPairings", () => {
      const pendingPairings = new Map([["alice", new Date()]]);

      expect(isPendingPairing("alice", pendingPairings)).toBe(true);
    });

    it("should return false when user is not in pendingPairings", () => {
      const pendingPairings = new Map([["bob", new Date()]]);

      expect(isPendingPairing("alice", pendingPairings)).toBe(false);
    });

    it("should normalize username before checking", () => {
      const pendingPairings = new Map([["alice", new Date()]]);

      expect(isPendingPairing("ALICE", pendingPairings)).toBe(true);
    });
  });

  describe("addPendingPairing", () => {
    it("should add user to pendingPairings", () => {
      const pendingPairings = new Map();

      addPendingPairing("alice", pendingPairings);

      expect(pendingPairings.has("alice")).toBe(true);
      expect(isPendingPairing("alice", pendingPairings)).toBe(true);
    });

    it("should normalize username before adding", () => {
      const pendingPairings = new Map();

      addPendingPairing("ALICE", pendingPairings);

      expect(pendingPairings.has("alice")).toBe(true);
    });

    it("should store the current date", () => {
      const pendingPairings = new Map();
      const before = new Date();

      addPendingPairing("bob", pendingPairings);
      const storedDate = pendingPairings.get("bob");

      expect(storedDate).toBeDefined();
      expect(storedDate!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe("removePendingPairing", () => {
    it("should remove user from pendingPairings", () => {
      const pendingPairings = new Map([["alice", new Date()]]);

      const result = removePendingPairing("alice", pendingPairings);

      expect(result).toBe(true);
      expect(pendingPairings.has("alice")).toBe(false);
    });

    it("should return false when user not in pendingPairings", () => {
      const pendingPairings = new Map();

      const result = removePendingPairing("alice", pendingPairings);

      expect(result).toBe(false);
    });

    it("should normalize username before removing", () => {
      const pendingPairings = new Map([["alice", new Date()]]);

      const result = removePendingPairing("ALICE", pendingPairings);

      expect(result).toBe(true);
      expect(pendingPairings.has("alice")).toBe(false);
    });
  });

  describe("getExpiredPendingPairings", () => {
    it("should return empty array when no pending pairings", () => {
      const pendingPairings = new Map();

      const expired = getExpiredPendingPairings(pendingPairings, 1000);

      expect(expired).toEqual([]);
    });

    it("should return empty array when no pairings are expired", () => {
      const now = Date.now();
      const pendingPairings = new Map([
        ["alice", new Date(now)],
        ["bob", new Date(now - 500)],
      ]);

      const expired = getExpiredPendingPairings(pendingPairings, 10000);

      expect(expired).toEqual([]);
    });

    it("should return expired pairings", () => {
      const now = Date.now();
      const expiredDate = new Date(now - 5000); // 5秒前
      const pendingPairings = new Map([
        ["alice", new Date(now)],           // 现在 - 不过期
        ["bob", expiredDate],                // 5秒前 - 过期 (5000 > 3000)
        ["charlie", new Date(now - 4000)],  // 4秒前 - 过期 (4000 > 3000)
      ]);

      const expired = getExpiredPendingPairings(pendingPairings, 3000);

      expect(expired).toContain("bob");
      expect(expired).toContain("charlie");
      expect(expired).not.toContain("alice");
    });

    it("should respect maxAgeMs parameter", () => {
      const now = Date.now();
      const oldDate = new Date(now - 5000); // 5秒前
      const pendingPairings = new Map([["bob", oldDate]]);

      const expired1h = getExpiredPendingPairings(pendingPairings, 3600000); // 1小时
      const expired3s = getExpiredPendingPairings(pendingPairings, 3000);    // 3秒

      expect(expired1h).toEqual([]);  // 5秒 < 1小时，不过期
      expect(expired3s).toContain("bob"); // 5秒 > 3秒，过期
    });
  });

  describe("cleanupExpiredPairings", () => {
    it("should remove expired pairings and return count", () => {
      const now = Date.now();
      const pendingPairings = new Map([
        ["alice", new Date(now)],              // 现在 - 不过期
        ["bob", new Date(now - 5000)],        // 5秒前 - 过期
        ["charlie", new Date(now - 4000)],    // 4秒前 - 过期
      ]);

      const count = cleanupExpiredPairings(pendingPairings, 3000);

      expect(count).toBe(2);
      expect(pendingPairings.size).toBe(1);
      expect(pendingPairings.has("alice")).toBe(true);
    });

    it("should use 24 hour default maxAge", () => {
      const now = Date.now();
      const dayOld = new Date(now - 24 * 60 * 60 * 1000 - 1); // 24小时多1毫秒前
      const pendingPairings = new Map([["old", dayOld]]);

      const count = cleanupExpiredPairings(pendingPairings);

      expect(count).toBe(1);
      expect(pendingPairings.size).toBe(0);
    });

    it("should return 0 when no expired pairings", () => {
      const pendingPairings = new Map([["alice", new Date()]]);

      const count = cleanupExpiredPairings(pendingPairings);

      expect(count).toBe(0);
      expect(pendingPairings.size).toBe(1);
    });
  });
});
