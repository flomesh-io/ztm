// Integration tests for Group Policy
// Tests for full permission check flow with real configurations

import { describe, it, expect } from "vitest";
import {
  checkGroupPolicy,
  getGroupPermission,
  applyGroupToolsPolicy,
} from "./group-policy.js";
import type { ZTMChatConfig } from "../types/config.js";
import type { ZTMChatMessage } from "../types/messaging.js";
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

// Helper to create a mock group message
function createMockGroupMessage(params: {
  groupCreator: string;
  groupId: string;
  sender: string;
  content: string;
}): ZTMChatMessage {
  return {
    id: "msg-1",
    sender: params.sender,
    senderId: params.sender,
    peer: params.sender,
    content: params.content,
    timestamp: new Date(),
    isGroup: true,
    groupCreator: params.groupCreator,
    groupId: params.groupId,
  };
}

describe("Group Policy Integration", () => {
  describe("full permission check flow", () => {
    it("should handle full flow: disabled group", () => {
      // 配置：群组被禁用
      const config = createMockConfig({
        groupPolicy: "allowlist",
        groupPermissions: {
          "alice/public": {
            creator: "alice",
            group: "public",
            groupPolicy: "disabled",
            requireMention: false,
            allowFrom: [],
          },
        },
      });

      // 模拟消息流程
      const msg = createMockGroupMessage({
        groupCreator: "alice",
        groupId: "public",
        sender: "bob",
        content: "hello",
      });

      const perm = getGroupPermission(msg.groupCreator!, msg.groupId!, config);
      const result = checkGroupPolicy(msg.sender, msg.content, perm, "chatbot");

      expect(result.allowed).toBe(false);
      expect(result.action).toBe("ignore");
      expect(result.reason).toBe("denied");
    });

    it("should handle full flow: allowlist with whitelisted sender", () => {
      const config = createMockConfig({
        groupPolicy: "allowlist",
        groupPermissions: {
          "alice/team": {
            creator: "alice",
            group: "team",
            groupPolicy: "allowlist",
            requireMention: true,
            allowFrom: ["bob"],
          },
        },
      });

      const msg = createMockGroupMessage({
        groupCreator: "alice",
        groupId: "team",
        sender: "bob",
        content: "hey @chatbot what's up?",
      });

      const perm = getGroupPermission(msg.groupCreator!, msg.groupId!, config);
      const result = checkGroupPolicy(msg.sender, msg.content, perm, "chatbot");

      expect(result.allowed).toBe(true);
      expect(result.action).toBe("process");
      expect(result.reason).toBe("whitelisted");
    });

    it("should handle full flow: open group with mention required", () => {
      const config = createMockConfig({
        groupPolicy: "open",
        groupPermissions: {},
      });

      // 测试没有 mention 的情况
      const msgNoMention = createMockGroupMessage({
        groupCreator: "alice",
        groupId: "public",
        sender: "bob",
        content: "just a message",
      });

      const perm1 = getGroupPermission(
        msgNoMention.groupCreator!,
        msgNoMention.groupId!,
        config
      );
      const result1 = checkGroupPolicy(
        msgNoMention.sender,
        msgNoMention.content,
        perm1,
        "chatbot"
      );

      expect(result1.allowed).toBe(false);
      expect(result1.reason).toBe("mention_required");

      // 测试有 mention 的情况
      const msgWithMention = createMockGroupMessage({
        groupCreator: "alice",
        groupId: "public",
        sender: "bob",
        content: "hey @chatbot hello",
      });

      const perm2 = getGroupPermission(
        msgWithMention.groupCreator!,
        msgWithMention.groupId!,
        config
      );
      const result2 = checkGroupPolicy(
        msgWithMention.sender,
        msgWithMention.content,
        perm2,
        "chatbot"
      );

      expect(result2.allowed).toBe(true);
      expect(result2.reason).toBe("allowed");
    });

    it("should handle creator bypass for all policies", () => {
      const config = createMockConfig({
        groupPolicy: "allowlist",
        groupPermissions: {
          "alice/test-group": {
            creator: "alice",
            group: "test-group",
            groupPolicy: "disabled",
            requireMention: true,
            allowFrom: ["bob"],
          },
        },
      });

      const msg = createMockGroupMessage({
        groupCreator: "alice",
        groupId: "test-group",
        sender: "alice",
        content: "hello",
      });

      const perm = getGroupPermission(msg.groupCreator!, msg.groupId!, config);
      const result = checkGroupPolicy(msg.sender, msg.content, perm, "chatbot");

      // Creator is no longer bypassed - subject to groupPolicy
      expect(result.allowed).toBe(false); // disabled policy denies all
    });

    it("should handle unknown group with channel defaults", () => {
      const config = createMockConfig({
        groupPolicy: "open",
        groupPermissions: {},
      });

      const msg = createMockGroupMessage({
        groupCreator: "alice",
        groupId: "unknown-group",
        sender: "bob",
        content: "hey @chatbot hello", // 需要 mention 因为默认 requireMention 是 true
      });

      const perm = getGroupPermission(
        msg.groupCreator!,
        msg.groupId!,
        config
      );
      const result = checkGroupPolicy(
        msg.sender,
        msg.content,
        perm,
        "chatbot"
      );

      // 使用 channel 默认策略 (open)，但 requireMention 默认是 true
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("allowed");
    });
  });

  describe("tools policy integration", () => {
    it("should filter tools according to group config", () => {
      const config = createMockConfig({
        groupPolicy: "open",
        groupPermissions: {
          "alice/restricted": {
            creator: "alice",
            group: "restricted",
            groupPolicy: "open",
            requireMention: false,
            allowFrom: [],
            tools: { deny: ["fs", "exec"] },
          },
        },
      });

      const allTools = [
        "messaging",
        "sessions",
        "runtime",
        "fs",
        "exec",
        "ui",
      ];
      const perm = getGroupPermission("alice", "restricted", config);
      const filteredTools = applyGroupToolsPolicy("bob", perm, allTools);

      expect(filteredTools).toEqual(["messaging", "sessions", "runtime", "ui"]);
    });

    it("should apply sender-specific tool overrides", () => {
      const config = createMockConfig({
        groupPolicy: "open",
        groupPermissions: {
          "alice/team": {
            creator: "alice",
            group: "team",
            groupPolicy: "open",
            requireMention: false,
            allowFrom: [],
            tools: { deny: ["exec"] },
            toolsBySender: {
              admin: { alsoAllow: ["exec"] },
            },
          },
        },
      });

      const allTools = ["messaging", "sessions", "runtime", "exec"];

      // 普通用户
      const perm1 = getGroupPermission("alice", "team", config);
      const tools1 = applyGroupToolsPolicy("bob", perm1, allTools);
      expect(tools1).toEqual(["messaging", "sessions", "runtime"]);

      // 管理员用户
      const tools2 = applyGroupToolsPolicy("admin", perm1, allTools);
      expect(tools2).toEqual(["messaging", "sessions", "runtime", "exec"]);
    });

    it("should use default tools when no config", () => {
      // 不设置 groupPermissions，使用完全默认
      const config = createMockConfig({});

      // 注意：默认 tools 使用 group: 前缀
      const allTools = [
        "group:messaging",
        "group:sessions",
        "group:runtime",
        "group:fs",
        "exec",
      ];
      const perm = getGroupPermission("alice", "test-group", config);
      const filteredTools = applyGroupToolsPolicy("bob", perm, allTools);

      // 默认只允许 group:messaging 和 group:sessions
      expect(filteredTools).toEqual(["group:messaging", "group:sessions"]);
    });
  });

  describe("edge cases", () => {
    it("should handle empty message content", () => {
      const config = createMockConfig({
        groupPolicy: "open",
        groupPermissions: {
          "alice/test-group": {
            creator: "alice",
            group: "test-group",
            groupPolicy: "open",
            requireMention: true,
            allowFrom: [],
          },
        },
      });

      const perm = getGroupPermission("alice", "test-group", config);
      const result = checkGroupPolicy("bob", "", perm, "chatbot");

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("mention_required");
    });

    it("should handle special characters in group id", () => {
      const config = createMockConfig({
        groupPolicy: "allowlist",
        groupPermissions: {
          "alice/group+with-special@chars": {
            creator: "alice",
            group: "group+with-special@chars",
            groupPolicy: "open",
            requireMention: false,
            allowFrom: [],
          },
        },
      });

      const perm = getGroupPermission(
        "alice",
        "group+with-special@chars",
        config
      );
      const result = checkGroupPolicy("bob", "hello", perm, "chatbot");

      expect(result.allowed).toBe(true);
    });

    it("should handle case variations in mention", () => {
      const config = createMockConfig({
        groupPolicy: "open",
        groupPermissions: {},
      });

      const perm = getGroupPermission("alice", "test-group", config);

      // 各种大小写变体（需要 @ 符号）
      expect(
        checkGroupPolicy("bob", "@CHATBOT hello", perm, "chatbot").allowed
      ).toBe(true);
      expect(
        checkGroupPolicy("bob", "@ChatBot hello", perm, "chatbot").allowed
      ).toBe(true);
      expect(
        checkGroupPolicy("bob", "@chatbot hello", perm, "chatbot").allowed
      ).toBe(true);
    });

    it("should handle non-mention text that looks like username", () => {
      const config = createMockConfig({
        groupPolicy: "open",
        groupPermissions: {},
      });

      const perm = getGroupPermission("alice", "test-group", config);

      // 没有 @ 符号的不应该被识别为 mention
      expect(
        checkGroupPolicy("bob", "hey chatbot how are you?", perm, "chatbot")
          .allowed
      ).toBe(false);
    });
  });
});
