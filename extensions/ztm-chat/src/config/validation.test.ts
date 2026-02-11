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
    expect(result.errors.some((e) => e.field === "agentUrl")).toBe(true);
    expect(result.errors.some((e) => e.reason === "invalid_format")).toBe(
      true
    );
  });

  it("should provide user-friendly error messages", () => {
    const result = validateZTMChatConfig({
      agentUrl: "invalid",
      meshName: "",
      username: "",
    });

    expect(result.errors[0].field).toBe("agentUrl");
    expect(result.errors[0].message).toContain("agentUrl");
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
    expect(result.errors.some((e) => e.field === "agentUrl")).toBe(true);
    expect(result.errors.some((e) => e.field === "permitUrl")).toBe(true);
    expect(result.errors.some((e) => e.field === "meshName")).toBe(true);
    expect(result.errors.some((e) => e.field === "username")).toBe(true);
  });

  it("should include error reason types", () => {
    const result = validateZTMChatConfig({
      agentUrl: "",
      meshName: "valid-mesh",
      permitUrl: "https://example.com",
      username: "valid-user",
    });

    const agentUrlError = result.errors.find(
      (e) => e.field === "agentUrl"
    );
    expect(agentUrlError).toBeDefined();
    expect(agentUrlError!.reason).toBe("required");
  });

  it("should include invalid value in error", () => {
    const result = validateZTMChatConfig({
      agentUrl: "not-a-url",
      meshName: "valid-mesh",
      permitUrl: "https://example.com",
      username: "valid-user",
    });

    const agentUrlError = result.errors.find(
      (e) => e.field === "agentUrl"
    );
    expect(agentUrlError).toBeDefined();
    expect(agentUrlError!.value).toBe("not-a-url");
  });

  it("should handle root type mismatch", () => {
    const result = validateZTMChatConfig("not-an-object");
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("root");
    expect(result.errors[0].reason).toBe("type_mismatch");
  });

  it("should handle null input", () => {
    const result = validateZTMChatConfig(null);
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("root");
  });

  it("should validate dmPolicy type", () => {
    const result = validateZTMChatConfig({
      agentUrl: "https://example.com",
      meshName: "valid-mesh",
      permitUrl: "https://example.com",
      username: "valid-user",
      dmPolicy: "invalid-policy",
    });

    expect(result.valid).toBe(false);
    const dmPolicyError = result.errors.find((e) => e.field === "dmPolicy");
    expect(dmPolicyError).toBeDefined();
    expect(dmPolicyError!.reason).toBe("type_mismatch");
  });

  it("should validate apiTimeout range", () => {
    const result = validateZTMChatConfig({
      agentUrl: "https://example.com",
      meshName: "valid-mesh",
      permitUrl: "https://example.com",
      username: "valid-user",
      apiTimeout: 500,
    });

    expect(result.valid).toBe(false);
    const timeoutError = result.errors.find(
      (e) => e.field === "apiTimeout"
    );
    expect(timeoutError).toBeDefined();
    expect(timeoutError!.reason).toBe("out_of_range");
  });

  it("should validate meshName length", () => {
    const result = validateZTMChatConfig({
      agentUrl: "https://example.com",
      meshName: "a".repeat(100),
      permitUrl: "https://example.com",
      username: "valid-user",
    });

    expect(result.valid).toBe(false);
    const meshError = result.errors.find((e) => e.field === "meshName");
    expect(meshError).toBeDefined();
    expect(meshError!.reason).toBe("out_of_range");
  });

  it("should validate username length", () => {
    const result = validateZTMChatConfig({
      agentUrl: "https://example.com",
      meshName: "valid-mesh",
      permitUrl: "https://example.com",
      username: "a".repeat(100),
    });

    expect(result.valid).toBe(false);
    const userError = result.errors.find((e) => e.field === "username");
    expect(userError).toBeDefined();
    expect(userError!.reason).toBe("out_of_range");
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
      permitUrl: "https://my-permit.example.com:7779",
      meshName: "my-mesh",
      username: "my-bot",
      enableGroups: true,
      autoReply: false,
    };

    const result = resolveZTMChatConfig(input);

    expect(result.agentUrl).toBe("https://my-agent.example.com:7777");
    expect(result.permitUrl).toBe("https://my-permit.example.com:7779");
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
