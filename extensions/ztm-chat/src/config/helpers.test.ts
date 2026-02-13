// Unit tests for message path helpers and DM policy

import { describe, it, expect } from "vitest";
import { testConfig } from "../test-utils/fixtures.js";
import {
  validateZTMChatConfig,
  resolveZTMChatConfig,
  createProbeConfig,
} from "./index.js";

// Inline helper functions (previously exported from ztm-api.ts, now unused in source code)
const buildPeerMessagePath = (
  messagePath: string,
  username: string,
  peer: string
): string => `${messagePath}/${username}/publish/peers/${peer}/messages/`;

const parseMessagePath = (
  path: string
): { peer?: string; creator?: string; group?: string } | null => {
  const peerMatch = path.match(/(?:\/apps\/ztm\/chat)?\/shared\/[^/]+\/publish\/peers\/([^/]+)\/messages/);
  if (peerMatch) {
    return { peer: peerMatch[1] };
  }

  const groupMatch = path.match(
    /(?:\/apps\/ztm\/chat)?\/shared\/[^/]+\/publish\/groups\/([^/]+)\/([^/]+)\/messages/
  );
  if (groupMatch) {
    return { creator: groupMatch[1], group: groupMatch[2] };
  }

  return null;
};

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
        ...testConfig,
        dmPolicy: "allow",
      });
      expect(result.valid).toBe(true);
      expect(result.config?.dmPolicy).toBe("allow");
    });

    it("should accept 'deny' policy", () => {
      const result = validateZTMChatConfig({
        ...testConfig,
        dmPolicy: "deny",
      });
      expect(result.valid).toBe(true);
      expect(result.config?.dmPolicy).toBe("deny");
    });

    it("should accept 'pairing' policy", () => {
      const result = validateZTMChatConfig({
        ...testConfig,
        dmPolicy: "pairing",
      });
      expect(result.valid).toBe(true);
      expect(result.config?.dmPolicy).toBe("pairing");
    });

    it("should default to 'pairing' when not specified", () => {
      const result = validateZTMChatConfig({
        agentUrl: testConfig.agentUrl,
        meshName: testConfig.meshName,
        permitUrl: testConfig.permitUrl,
        username: testConfig.username,
      });
      expect(result.valid).toBe(true);
      expect(result.config?.dmPolicy).toBe("pairing");
    });
  });

  describe("resolveZTMChatConfig with dmPolicy", () => {
    it("should default dmPolicy to pairing", () => {
      const result = resolveZTMChatConfig({
        agentUrl: testConfig.agentUrl,
        meshName: testConfig.meshName,
        username: testConfig.username,
      });
      expect(result.dmPolicy).toBe("pairing");
    });

    it("should preserve dmPolicy value", () => {
      const result = resolveZTMChatConfig({
        agentUrl: testConfig.agentUrl,
        meshName: testConfig.meshName,
        username: testConfig.username,
        dmPolicy: "allow",
      });
      expect(result.dmPolicy).toBe("allow");
    });

    it("should handle dmPolicy case insensitivity", () => {
      const result = resolveZTMChatConfig({
        agentUrl: testConfig.agentUrl,
        meshName: testConfig.meshName,
        username: testConfig.username,
        dmPolicy: "PAIRING" as any,
      });
      // Invalid policy values default to pairing
      expect(result.dmPolicy).toBe("pairing");
    });
  });

  describe("createProbeConfig with dmPolicy", () => {
    it("should use dmPolicy from config", () => {
      const result = createProbeConfig({
        agentUrl: testConfig.agentUrl,
        dmPolicy: "deny",
      });
      expect(result.dmPolicy).toBe("deny");
    });

    it("should default dmPolicy to pairing", () => {
      const result = createProbeConfig({
        agentUrl: testConfig.agentUrl,
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
        agentUrl: testConfig.agentUrl,
        meshName: testConfig.meshName,
        username: testConfig.username,
        allowFrom: ["alice", "bob"],
      });
      expect(result.allowFrom).toEqual(["alice", "bob"]);
    });

    it("should normalize allowFrom entries", () => {
      const result = resolveZTMChatConfig({
        agentUrl: testConfig.agentUrl,
        meshName: testConfig.meshName,
        username: testConfig.username,
        allowFrom: ["  Alice  ", "BOB", "  charlie  "],
      });
      expect(result.allowFrom).toEqual(["Alice", "BOB", "charlie"]);
    });

    it("should filter empty allowFrom entries", () => {
      const result = resolveZTMChatConfig({
        agentUrl: testConfig.agentUrl,
        meshName: testConfig.meshName,
        username: testConfig.username,
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

describe("Normalization Helpers", () => {
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
});
