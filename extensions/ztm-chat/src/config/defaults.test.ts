// Unit tests for default config and probe config

import { describe, it, expect } from "vitest";
import {
  getDefaultConfig,
  isConfigMinimallyValid,
  createProbeConfig,
  type ZTMChatConfig,
} from "./index.js";

describe("getDefaultConfig", () => {
  it("should return default configuration", () => {
    const result = getDefaultConfig();

    expect(result.agentUrl).toBe("http://localhost:7777");
    expect(result.permitUrl).toBe("https://ztm-portal.flomesh.io:7779/permit");
    expect(result.meshName).toBe("openclaw-mesh");
    expect(result.username).toBe("openclaw-bot");
    expect(result.enableGroups).toBe(true);
    expect(result.autoReply).toBe(true);
    expect(result.messagePath).toBe("/shared");
    expect(result.dmPolicy).toBe("pairing");
    expect(result.allowFrom).toBeUndefined();
  });
});

describe("isConfigMinimallyValid", () => {
  it("should return true for valid config", () => {
    const config = {
      agentUrl: "https://example.com",
      meshName: "my-mesh",
      username: "test-bot",
    } as Partial<ZTMChatConfig>;

    expect(isConfigMinimallyValid(config)).toBe(true);
  });

  it("should return false for missing agentUrl", () => {
    const config = {
      agentUrl: "",
      meshName: "my-mesh",
      username: "test-bot",
    } as Partial<ZTMChatConfig>;

    expect(isConfigMinimallyValid(config)).toBe(false);
  });

  it("should return false for missing username", () => {
    const config = {
      agentUrl: "https://example.com",
      meshName: "my-mesh",
      username: "",
    } as Partial<ZTMChatConfig>;

    expect(isConfigMinimallyValid(config)).toBe(false);
  });
});

describe("createProbeConfig", () => {
  it("should create a valid probe config", () => {
    const result = createProbeConfig({
      agentUrl: "https://example.com:7777",
    });

    expect(result.agentUrl).toBe("https://example.com:7777");
    expect(result.permitUrl).toBe("https://ztm-portal.flomesh.io:7779/permit");
    expect(result.meshName).toBe("openclaw-mesh");
    expect(result.username).toBe("probe");
  });

  it("should use defaults for missing fields", () => {
    const result = createProbeConfig({});

    expect(result.agentUrl).toBe("http://localhost:7777");
    expect(result.permitUrl).toBe("https://ztm-portal.flomesh.io:7779/permit");
    expect(result.meshName).toBe("openclaw-mesh");
    expect(result.username).toBe("probe");
    expect(result.dmPolicy).toBe("pairing");
  });

  it("should preserve provided values", () => {
    const result = createProbeConfig({
      agentUrl: "https://custom.example.com",
      permitUrl: "https://custom-permit.example.com:7779/permit",
      meshName: "custom-mesh",
      username: "custom-user",
      enableGroups: true,
      autoReply: false,
      dmPolicy: "allow",
    });

    expect(result.agentUrl).toBe("https://custom.example.com");
    expect(result.permitUrl).toBe("https://custom-permit.example.com:7779/permit");
    expect(result.meshName).toBe("custom-mesh");
    expect(result.username).toBe("custom-user");
    expect(result.enableGroups).toBe(true);
    expect(result.autoReply).toBe(false);
    expect(result.dmPolicy).toBe("allow");
  });

  it("should preserve allowFrom from config", () => {
    const result = createProbeConfig({
      agentUrl: "https://example.com",
      allowFrom: ["alice", "bob"],
    });

    expect(result.allowFrom).toEqual(["alice", "bob"]);
  });
});
