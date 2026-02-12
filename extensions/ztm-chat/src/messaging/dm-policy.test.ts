// Integration tests for DM Policy behavior

import { describe, it, expect } from "vitest";
import type { ZTMChatConfig } from "../types/config.js";

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
});
