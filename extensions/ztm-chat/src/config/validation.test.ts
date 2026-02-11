// Unit tests for config validation and resolution

import { describe, it, expect } from "vitest";
import {
  validateZTMChatConfig,
  resolveZTMChatConfig,
} from "./index.js";

describe("validateZTMChatConfig", () => {
  it("should return valid for complete config", () => {
    const result = validateZTMChatConfig({
      agentUrl: "https://ztm-agent.example.com:7777",
      meshName: "my-mesh",
      permitUrl: "https://ztm-portal.flomesh.io:7779/permit",
      username: "test-bot",
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.config).toBeDefined();
  });

  it("should return errors for missing required fields", () => {
    const result = validateZTMChatConfig({
      agentUrl: "",
      meshName: "",
      username: "",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should return error for invalid URL", () => {
    const result = validateZTMChatConfig({
      agentUrl: "not-a-valid-url",
      meshName: "my-mesh",
      username: "test-bot",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes("url"))).toBe(true);
  });

  it("should provide user-friendly error messages", () => {
    const result = validateZTMChatConfig({
      agentUrl: "invalid",
      meshName: "",
      username: "",
    });

    expect(result.errors[0]).toContain("agentUrl");
  });

  it("should list all validation errors", () => {
    const result = validateZTMChatConfig({
      agentUrl: "invalid-url",
      permitUrl: "invalid-url",
      meshName: "",
      username: "",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(4);
    expect(result.errors.some(e => e.includes("agentUrl"))).toBe(true);
    expect(result.errors.some(e => e.includes("permitUrl"))).toBe(true);
    expect(result.errors.some(e => e.includes("meshName"))).toBe(true);
    expect(result.errors.some(e => e.includes("username"))).toBe(true);
  });
});

describe("resolveZTMChatConfig", () => {
  it("should return default values for empty input", () => {
    const result = resolveZTMChatConfig({});

    expect(result.agentUrl).toBe("http://localhost:7777");
    expect(result.permitUrl).toBe("https://ztm-portal.flomesh.io:7779/permit");
    expect(result.meshName).toBe("openclaw-mesh");
    expect(result.username).toBe("openclaw-bot");
    expect(result.enableGroups).toBe(false);
    expect(result.autoReply).toBe(true);
    expect(result.messagePath).toBe("/shared");
  });

  it("should preserve provided values", () => {
    const input = {
      agentUrl: "https://my-agent.example.com:7777",
      permitUrl: "https://my-permit.example.com:7779/permit",
      meshName: "my-mesh",
      username: "my-bot",
      enableGroups: true,
      autoReply: false,
    };

    const result = resolveZTMChatConfig(input);

    expect(result.agentUrl).toBe("https://my-agent.example.com:7777");
    expect(result.permitUrl).toBe("https://my-permit.example.com:7779/permit");
    expect(result.meshName).toBe("my-mesh");
    expect(result.username).toBe("my-bot");
    expect(result.enableGroups).toBe(true);
    expect(result.autoReply).toBe(false);
  });

  it("should trim whitespace from string values", () => {
    const result = resolveZTMChatConfig({
      agentUrl: "  https://example.com  ",
      meshName: "  my-mesh  ",
      username: "  bot  ",
    });

    expect(result.agentUrl).toBe("https://example.com");
    expect(result.meshName).toBe("my-mesh");
    expect(result.username).toBe("bot");
  });

  it("should handle null/undefined values", () => {
    const result = resolveZTMChatConfig({
      agentUrl: null,
      meshName: undefined,
      username: null,
    });

    expect(result.agentUrl).toBe("http://localhost:7777");
    expect(result.meshName).toBe("openclaw-mesh");
    expect(result.username).toBe("openclaw-bot");
  });
});
