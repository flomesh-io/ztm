// Unit tests for ZTMChatConfigSchema validation

import { describe, it, expect } from "vitest";
import { testConfig } from "../test-utils/fixtures.js";
import {
  ZTMChatConfigSchema,
  validateZTMChatConfig,
  type ZTMChatConfig,
} from "./index.js";

describe("ZTMChatConfigSchema", () => {
  describe("agentUrl validation", () => {
    it("should accept valid HTTPS URLs", () => {
      const result = validateZTMChatConfig({
        ...testConfig,
        agentUrl: "https://ztm-agent.example.com:7777",
      });
      expect(result.valid).toBe(true);
    });

    it("should accept valid HTTP URLs", () => {
      const result = validateZTMChatConfig({
        ...testConfig,
        agentUrl: "http://localhost:7777",
      });
      expect(result.valid).toBe(true);
    });

    it("should reject invalid URLs", () => {
      const result = validateZTMChatConfig({
        ...testConfig,
        agentUrl: "not-a-url",
      });
      expect(result.valid).toBe(false);
    });

    it("should reject empty agentUrl", () => {
      const result = validateZTMChatConfig({
        ...testConfig,
        agentUrl: "",
      });
      expect(result.valid).toBe(false);
    });
  });

  describe("permitUrl validation", () => {
    it("should accept valid HTTPS permit URLs", () => {
      const result = validateZTMChatConfig({
        ...testConfig,
        agentUrl: "http://localhost:7777",
      });
      expect(result.valid).toBe(true);
    });

    it("should accept valid HTTP permit URLs", () => {
      const result = validateZTMChatConfig({
        ...testConfig,
        permitUrl: "http://localhost:7779/permit",
      });
      expect(result.valid).toBe(true);
    });

    it("should reject invalid permitUrl", () => {
      const result = validateZTMChatConfig({
        ...testConfig,
        permitUrl: "not-a-url",
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "permitUrl")).toBe(true);
    });

    it("should reject empty permitUrl", () => {
      const result = validateZTMChatConfig({
        ...testConfig,
        permitUrl: "",
      });
      expect(result.valid).toBe(false);
    });
  });

  describe("meshName validation", () => {
    it("should accept valid mesh names", () => {
      const result = validateZTMChatConfig({
        ...testConfig,
        meshName: "my-mesh-123",
      });
      expect(result.valid).toBe(true);
    });

    it("should reject mesh names with special characters", () => {
      const result = validateZTMChatConfig({
        ...testConfig,
        meshName: "my mesh!",
      });
      expect(result.valid).toBe(false);
    });

    it("should reject empty meshName", () => {
      const result = validateZTMChatConfig({
        ...testConfig,
        meshName: "",
      });
      expect(result.valid).toBe(false);
    });
  });

  describe("username validation", () => {
    it("should accept valid usernames", () => {
      const result = validateZTMChatConfig({
        ...testConfig,
        username: "test-bot_123",
      });
      expect(result.valid).toBe(true);
    });

    it("should reject usernames with spaces", () => {
      const result = validateZTMChatConfig({
        ...testConfig,
        username: "test bot",
      });
      expect(result.valid).toBe(false);
    });
  });

  describe("boolean defaults", () => {
    it("should default enableGroups to false", () => {
      const result = validateZTMChatConfig(testConfig);
      expect(result.valid).toBe(true);
      expect(result.config?.enableGroups).toBe(false);
    });

    it("should default autoReply to true", () => {
      const result = validateZTMChatConfig(testConfig);
      expect(result.valid).toBe(true);
      expect(result.config?.autoReply).toBe(true);
    });

    it("should default messagePath to /shared", () => {
      const result = validateZTMChatConfig(testConfig);
      expect(result.valid).toBe(true);
      expect(result.config?.messagePath).toBe("/shared");
    });
  });
});
