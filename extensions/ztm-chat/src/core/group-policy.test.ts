// Unit tests for Group Policy functions
// Tests for checkGroupPolicy, applyGroupToolsPolicy, and getGroupPermission

import { describe, it, expect } from "vitest";
import {
  checkGroupPolicy,
  applyGroupToolsPolicy,
  getGroupPermission,
} from "./group-policy.js";
import type { ZTMChatConfig } from "../types/config.js";
import type { GroupPermissions } from "../types/group-policy.js";
import { testConfig } from "../test-utils/fixtures.js";

// Helper to create a minimal config
function createMockConfig(overrides: Partial<ZTMChatConfig> = {}): ZTMChatConfig {
  return {
    ...testConfig,
    username: "chatbot",
    enableGroups: true,
    ...overrides,
  };
}

describe("checkGroupPolicy", () => {
  const botUsername = "chatbot";

  describe("groupPolicy: disabled", () => {
    it("should deny all messages when groupPolicy is disabled", () => {
      const permissions: GroupPermissions = {
        creator: "alice",
        group: "test-group",
        groupPolicy: "disabled",
        requireMention: false,
        allowFrom: [],
      };

      const result = checkGroupPolicy("bob", "hello", permissions, botUsername);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("denied");
      expect(result.action).toBe("ignore");
    });

    it("should deny creator when groupPolicy is disabled (creator needs mention too)", () => {
      const permissions: GroupPermissions = {
        creator: "alice",
        group: "test-group",
        groupPolicy: "disabled",
        requireMention: false,
        allowFrom: [],
      };

      const result = checkGroupPolicy("alice", "hello", permissions, botUsername);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("denied");
    });
  });

  describe("groupPolicy: allowlist", () => {
    it("should deny sender not in allowlist", () => {
      const permissions: GroupPermissions = {
        creator: "alice",
        group: "test-group",
        groupPolicy: "allowlist",
        requireMention: false,
        allowFrom: ["charlie"], // bob 不在白名单
      };

      const result = checkGroupPolicy("bob", "hello", permissions, botUsername);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("whitelisted");
    });

    it("should allow sender in allowlist", () => {
      const permissions: GroupPermissions = {
        creator: "alice",
        group: "test-group",
        groupPolicy: "allowlist",
        requireMention: false,
        allowFrom: ["bob", "charlie"],
      };

      const result = checkGroupPolicy("bob", "hello", permissions, botUsername);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("whitelisted");
    });

    it("should deny creator when not in allowlist (creator needs mention too)", () => {
      const permissions: GroupPermissions = {
        creator: "alice",
        group: "test-group",
        groupPolicy: "allowlist",
        requireMention: false,
        allowFrom: ["bob"], // alice 不在白名单
      };

      const result = checkGroupPolicy("alice", "hello", permissions, botUsername);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("whitelisted");
    });
  });

  describe("groupPolicy: open", () => {
    it("should allow all senders when groupPolicy is open", () => {
      const permissions: GroupPermissions = {
        creator: "alice",
        group: "test-group",
        groupPolicy: "open",
        requireMention: false,
        allowFrom: [],
      };

      const result = checkGroupPolicy("bob", "hello", permissions, botUsername);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("allowed");
    });
  });

  describe("requireMention", () => {
    it("should deny when requireMention is true and no mention", () => {
      const permissions: GroupPermissions = {
        creator: "alice",
        group: "test-group",
        groupPolicy: "open",
        requireMention: true,
        allowFrom: [],
      };

      const result = checkGroupPolicy("bob", "hello world", permissions, botUsername);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("mention_required");
      expect(result.wasMentioned).toBe(false);
    });

    it("should allow when requireMention is true and has @mention", () => {
      const permissions: GroupPermissions = {
        creator: "alice",
        group: "test-group",
        groupPolicy: "open",
        requireMention: true,
        allowFrom: [],
      };

      const result = checkGroupPolicy(
        "bob",
        "hey @chatbot how are you?",
        permissions,
        botUsername
      );

      expect(result.allowed).toBe(true);
      expect(result.wasMentioned).toBe(true);
    });

    it("should allow all when requireMention is false", () => {
      const permissions: GroupPermissions = {
        creator: "alice",
        group: "test-group",
        groupPolicy: "open",
        requireMention: false,
        allowFrom: [],
      };

      const result = checkGroupPolicy("bob", "hello", permissions, botUsername);

      expect(result.allowed).toBe(true);
    });
  });

  describe("case insensitive", () => {
    it("should handle case insensitive sender names", () => {
      const permissions: GroupPermissions = {
        creator: "alice",
        group: "test-group",
        groupPolicy: "allowlist",
        requireMention: false,
        allowFrom: ["bob"], // lowercase
      };

      const result = checkGroupPolicy("BOB", "hello", permissions, botUsername);

      expect(result.allowed).toBe(true);
    });

    it("should handle case insensitive creator (now subject to policy)", () => {
      const permissions: GroupPermissions = {
        creator: "Alice",
        group: "test-group",
        groupPolicy: "disabled",
        requireMention: false,
        allowFrom: [],
      };

      // Creator is no longer bypassed - subject to groupPolicy
      const result = checkGroupPolicy("ALICE", "hello", permissions, botUsername);

      expect(result.allowed).toBe(false); // disabled policy denies all
    });
  });

  describe("empty sender", () => {
    it("should deny empty sender", () => {
      const permissions: GroupPermissions = {
        creator: "alice",
        group: "test-group",
        groupPolicy: "open",
        requireMention: false,
        allowFrom: [],
      };

      const result = checkGroupPolicy("", "hello", permissions, botUsername);

      expect(result.allowed).toBe(false);
    });
  });
});

describe("applyGroupToolsPolicy", () => {
  describe("tools.allow", () => {
    it("should filter to only allowed tools", () => {
      const allTools = ["messaging", "sessions", "runtime", "fs", "exec"];
      const permissions: GroupPermissions = {
        creator: "alice",
        group: "test-group",
        groupPolicy: "open",
        requireMention: false,
        allowFrom: [],
        tools: { allow: ["messaging", "sessions"] },
      };

      const result = applyGroupToolsPolicy("bob", permissions, allTools);

      expect(result).toEqual(["messaging", "sessions"]);
    });

    it("should return all tools when allow is empty", () => {
      const allTools = ["messaging", "sessions", "runtime"];
      const permissions: GroupPermissions = {
        creator: "alice",
        group: "test-group",
        groupPolicy: "open",
        requireMention: false,
        allowFrom: [],
        tools: { allow: [] },
      };

      const result = applyGroupToolsPolicy("bob", permissions, allTools);

      expect(result).toEqual(allTools);
    });
  });

  describe("tools.deny", () => {
    it("should remove denied tools", () => {
      const allTools = ["messaging", "sessions", "runtime", "fs", "exec"];
      const permissions: GroupPermissions = {
        creator: "alice",
        group: "test-group",
        groupPolicy: "open",
        requireMention: false,
        allowFrom: [],
        tools: { deny: ["fs", "exec"] },
      };

      const result = applyGroupToolsPolicy("bob", permissions, allTools);

      expect(result).toEqual(["messaging", "sessions", "runtime"]);
    });
  });

  describe("tools.allow + tools.deny", () => {
    it("should apply allow first, then deny", () => {
      const allTools = ["messaging", "sessions", "runtime", "fs", "exec"];
      const permissions: GroupPermissions = {
        creator: "alice",
        group: "test-group",
        groupPolicy: "open",
        requireMention: false,
        allowFrom: [],
        tools: {
          allow: ["messaging", "sessions", "runtime", "fs", "exec"],
          deny: ["fs", "exec"],
        },
      };

      const result = applyGroupToolsPolicy("bob", permissions, allTools);

      expect(result).toEqual(["messaging", "sessions", "runtime"]);
    });
  });

  describe("toolsBySender", () => {
    it("should apply sender-specific allow", () => {
      const allTools = ["messaging", "sessions", "runtime", "fs"];
      const permissions: GroupPermissions = {
        creator: "alice",
        group: "test-group",
        groupPolicy: "open",
        requireMention: false,
        allowFrom: [],
        tools: { deny: ["fs"] },
        toolsBySender: {
          david: { alsoAllow: ["fs"] },
        },
      };

      const result = applyGroupToolsPolicy("david", permissions, allTools);

      expect(result).toEqual(["messaging", "sessions", "runtime", "fs"]);
    });

    it("should apply sender-specific deny", () => {
      const allTools = ["messaging", "sessions", "runtime", "fs"];
      const permissions: GroupPermissions = {
        creator: "alice",
        group: "test-group",
        groupPolicy: "open",
        requireMention: false,
        allowFrom: [],
        tools: {},
        toolsBySender: {
          bob: { deny: ["fs"] },
        },
      };

      const result = applyGroupToolsPolicy("bob", permissions, allTools);

      expect(result).toEqual(["messaging", "sessions", "runtime"]);
    });
  });

  describe("no tools config", () => {
    it("should return all tools when no tools config", () => {
      const allTools = ["messaging", "sessions", "runtime", "fs"];
      const permissions: GroupPermissions = {
        creator: "alice",
        group: "test-group",
        groupPolicy: "open",
        requireMention: false,
        allowFrom: [],
      };

      const result = applyGroupToolsPolicy("bob", permissions, allTools);

      expect(result).toEqual(allTools);
    });
  });
});

describe("getGroupPermission", () => {
  it("should return per-group config when exists", () => {
    const config = createMockConfig({
      groupPolicy: "allowlist",
      groupPermissions: {
        "alice/test-group": {
          creator: "alice",
          group: "test-group",
          groupPolicy: "open",
          requireMention: false,
          allowFrom: [],
        },
      },
    });

    const result = getGroupPermission("alice", "test-group", config);

    expect(result.groupPolicy).toBe("open");
    expect(result.requireMention).toBe(false);
  });

  it("should use channel default when no per-group config", () => {
    const config = createMockConfig({
      groupPolicy: "open",
      groupPermissions: {},
    });

    const result = getGroupPermission("alice", "unknown-group", config);

    expect(result.groupPolicy).toBe("open");
    expect(result.requireMention).toBe(true); // 硬编码默认
  });

  it("should use hardcoded defaults when no config at all", () => {
    const config = createMockConfig({});

    const result = getGroupPermission("alice", "test-group", config);

    expect(result.groupPolicy).toBe("allowlist");
    expect(result.requireMention).toBe(true);
    expect(result.allowFrom).toEqual([]);
  });

  it("should merge per-group with defaults", () => {
    const config = createMockConfig({
      groupPolicy: "open",
      groupPermissions: {
        "alice/test-group": {
          creator: "alice",
          group: "test-group",
          // 只指定 groupPolicy，其他用默认值
        },
      },
    });

    const result = getGroupPermission("alice", "test-group", config);

    expect(result.groupPolicy).toBe("open"); // per-group 覆盖
    expect(result.requireMention).toBe(true); // 硬编码默认
    expect(result.allowFrom).toEqual([]); // 硬编码默认
  });

  describe("global requireMention (config-level)", () => {
    it("should use global requireMention when no per-group config", () => {
      const config = createMockConfig({
        groupPolicy: "open",
        requireMention: false,
        groupPermissions: {},
      });

      const result = getGroupPermission("alice", "unknown-group", config);

      expect(result.requireMention).toBe(false); // 使用全局配置
    });

    it("should use global requireMention: true when not specified", () => {
      const config = createMockConfig({
        groupPolicy: "open",
        // requireMention 未指定
        groupPermissions: {},
      });

      const result = getGroupPermission("alice", "unknown-group", config);

      expect(result.requireMention).toBe(true); // 全局默认是 true
    });

    it("should use global requireMention: false when explicitly set", () => {
      const config = createMockConfig({
        groupPolicy: "allowlist",
        requireMention: false,
        groupPermissions: {},
      });

      const result = getGroupPermission("alice", "test-group", config);

      expect(result.requireMention).toBe(false);
    });

    it("should per-group requireMention override global requireMention", () => {
      const config = createMockConfig({
        groupPolicy: "allowlist",
        requireMention: false, // 全局设为 false
        groupPermissions: {
          "alice/test-group": {
            creator: "alice",
            group: "test-group",
            requireMention: true, // per-group 覆盖为 true
          },
        },
      });

      const result = getGroupPermission("alice", "test-group", config);

      expect(result.requireMention).toBe(true); // per-group 优先
    });

    it("should per-group requireMention override global even when global is true", () => {
      const config = createMockConfig({
        groupPolicy: "allowlist",
        requireMention: true, // 全局设为 true
        groupPermissions: {
          "alice/test-group": {
            creator: "alice",
            group: "test-group",
            requireMention: false, // per-group 覆盖为 false
          },
        },
      });

      const result = getGroupPermission("alice", "test-group", config);

      expect(result.requireMention).toBe(false); // per-group 优先
    });

    it("should combine global groupPolicy and per-group requireMention", () => {
      const config = createMockConfig({
        groupPolicy: "open", // 全局 groupPolicy
        requireMention: true, // 全局 requireMention
        groupPermissions: {
          "alice/test-group": {
            creator: "alice",
            group: "test-group",
            requireMention: false, // 只覆盖 requireMention
          },
        },
      });

      const result = getGroupPermission("alice", "test-group", config);

      expect(result.groupPolicy).toBe("open"); // 使用全局
      expect(result.requireMention).toBe(false); // per-group 覆盖
    });

    it("should prioritize: per-group > global > default", () => {
      const config = createMockConfig({
        groupPolicy: "disabled", // 全局
        requireMention: true, // 全局
        groupPermissions: {
          "alice/test-group": {
            creator: "alice",
            group: "test-group",
            requireMention: false, // 最高优先级
          },
        },
      });

      const result = getGroupPermission("alice", "test-group", config);

      expect(result.groupPolicy).toBe("disabled"); // 全局
      expect(result.requireMention).toBe(false); // per-group 最高优先级
    });
  });
});
