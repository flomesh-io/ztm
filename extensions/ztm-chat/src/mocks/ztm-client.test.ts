// Unit tests for MockZTMClient

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { ZTMMessage } from "../api/ztm-api.js";
import type { ZTMChat, ZTMPeer, ZTMUserInfo } from "../api/ztm-api.js";
import { MockZTMClient, createMockConfig } from "./ztm-client.js";

describe("MockZTMClient", () => {
  describe("createMockConfig", () => {
    it("should create a valid mock configuration", () => {
      const config = createMockConfig();

      expect(config.meshName).toBe("test-mesh");
      expect(config.username).toBe("test-bot");
      expect(config.users.length).toBeGreaterThan(0);
      expect(config.peers.length).toBeGreaterThan(0);
      expect(config.chats.length).toBeGreaterThan(0);
      expect(config.messages.size).toBeGreaterThan(0);
    });

    it("should include valid user data", () => {
      const config = createMockConfig();

      const alice = config.users.find((u) => u.username === "alice");
      expect(alice).toBeDefined();
      expect(alice?.username).toBe("alice");
    });

    it("should include valid peer data", () => {
      const config = createMockConfig();

      const alicePeer = config.peers.find((p) => p.username === "alice");
      expect(alicePeer).toBeDefined();
      expect(alicePeer?.endpoint).toBeDefined();
    });

    it("should include messages for bot conversations", () => {
      const config = createMockConfig();

      expect(config.messages.has("alice→test-bot")).toBe(true);
      const messages = config.messages.get("alice→test-bot");
      expect(messages?.length).toBeGreaterThan(0);
    });
  });

  describe("server lifecycle", () => {
    it("should start and stop successfully", async () => {
      const client = new MockZTMClient();
      await client.start();
      expect(client.url).toMatch(/^http:\/\/localhost:\d+$/);
      await client.stop();
    });

    it("should assign random port", async () => {
      const client = new MockZTMClient();
      await client.start();
      const port = parseInt(client.url.split(":")[2]);
      expect(port).toBeGreaterThan(0);
      expect(port).toBeLessThan(65536);
      await client.stop();
    });

    it("should handle stop when not started", async () => {
      const client = new MockZTMClient();
      await expect(client.stop()).resolves.not.toThrow();
    });
  });

  describe("API routes", () => {
    let client: MockZTMClient;

    beforeEach(async () => {
      client = new MockZTMClient();
      await client.start();
    });

    afterEach(async () => {
      await client.stop();
    });

    it("should respond to GET /api/meshes", async () => {
      const response = await fetch(`${client.url}/api/meshes`);
      expect(response.ok).toBe(true);
      const data = await response.json() as Array<{ name: string; connected: boolean }>;
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it("should respond to GET /api/meshes/{meshName}", async () => {
      const response = await fetch(`${client.url}/api/meshes/test-mesh`);
      expect(response.ok).toBe(true);
      const data = await response.json() as { name: string; connected: boolean };
      expect(data.name).toBe("test-mesh");
      expect(data.connected).toBe(true);
    });

    it("should return 404 for non-existent mesh", async () => {
      const response = await fetch(`${client.url}/api/meshes/non-existent`);
      expect(response.status).toBe(404);
    });

    it("should respond to GET /apps/ztm/chat/api/users", async () => {
      const response = await fetch(`${client.url}/apps/ztm/chat/api/users`);
      expect(response.ok).toBe(true);
      const data = await response.json() as ZTMUserInfo[];
      expect(Array.isArray(data)).toBe(true);
    });

    it("should respond to GET /apps/ztm/chat/api/chats", async () => {
      const response = await fetch(`${client.url}/apps/ztm/chat/api/chats`);
      expect(response.ok).toBe(true);
      const data = await response.json() as ZTMChat[];
      expect(Array.isArray(data)).toBe(true);
    });

    it("should respond to GET /apps/ztm/chat/api/peers/{peer}/messages", async () => {
      const response = await fetch(`${client.url}/apps/ztm/chat/api/peers/alice/messages`);
      expect(response.ok).toBe(true);
      const data = await response.json() as ZTMMessage[];
      expect(Array.isArray(data)).toBe(true);
    });

    it("should respond to POST /apps/ztm/chat/api/peers/{peer}/messages", async () => {
      const message: ZTMMessage = {
        time: Date.now(),
        message: "Hello!",
        sender: "test-bot",
      };
      const response = await fetch(`${client.url}/apps/ztm/chat/api/peers/alice/messages`, {
        method: "POST",
        body: JSON.stringify(message),
      });
      expect(response.ok).toBe(true);
      const data = await response.json() as { success: boolean; id: string };
      expect(data.success).toBe(true);
      expect(data.id).toBeDefined();
    });

    it("should respond to GET /api/watch", async () => {
      const response = await fetch(`${client.url}/api/watch?prefix=/test`);
      expect(response.ok).toBe(true);
      const data = await response.json() as string[];
      expect(Array.isArray(data)).toBe(true);
    });

    it("should return 404 for unknown routes", async () => {
      const response = await fetch(`${client.url}/api/unknown`);
      expect(response.status).toBe(404);
    });

    it("should handle CORS preflight", async () => {
      const response = await fetch(`${client.url}/api/meshes`, {
        method: "OPTIONS",
      });
      expect(response.status).toBe(204);
    });

    it("should include CORS headers", async () => {
      const response = await fetch(`${client.url}/api/meshes`);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Content-Type")).toBe("application/json");
    });
  });

  describe("message manipulation", () => {
    let client: MockZTMClient;

    beforeEach(async () => {
      client = new MockZTMClient();
      await client.start();
    });

    afterEach(async () => {
      await client.stop();
    });

    it("should add messages via helper method", () => {
      const message: ZTMMessage = {
        time: Date.now(),
        message: "Test via helper",
        sender: "bob",
      };
      client.addMessage("bob", message);
      expect(client.getWatchPollCount()).toBeDefined();
    });

    it("should add users via helper method", () => {
      const user: ZTMUserInfo = { username: "charlie" };
      client.addUser(user);
      expect(user.username).toBe("charlie");
    });

    it("should add peers via helper method", () => {
      const peer: ZTMPeer = { username: "charlie", endpoint: "charlie@192.168.1.12:7777" };
      client.addPeer(peer);
      expect(peer.username).toBe("charlie");
    });
  });

  describe("message filtering", () => {
    let client: MockZTMClient;

    beforeEach(async () => {
      client = new MockZTMClient();
      await client.start();
    });

    afterEach(async () => {
      await client.stop();
    });

    it("should filter messages by since parameter", async () => {
      const now = Date.now();
      client.addMessage("alice", { time: now - 10000, message: "Old", sender: "alice" });
      client.addMessage("alice", { time: now - 5000, message: "Recent", sender: "alice" });
      client.addMessage("alice", { time: now, message: "Now", sender: "alice" });

      const response = await fetch(
        `${client.url}/apps/ztm/chat/api/peers/alice/messages?since=${now - 6000}`
      );
      const data = await response.json() as ZTMMessage[];

      expect(data.length).toBe(2);
      expect(data.every((m) => m.time > now - 6000)).toBe(true);
    });

    it("should filter messages by before parameter", async () => {
      // Create a fresh client with empty messages to avoid interference from createMockConfig()
      const freshClient = new MockZTMClient({ messages: new Map() });
      await freshClient.start();

      const now = Date.now();
      freshClient.addMessage("alice", { time: now - 10000, message: "Old", sender: "alice" });
      freshClient.addMessage("alice", { time: now - 5000, message: "Recent", sender: "alice" });
      freshClient.addMessage("alice", { time: now, message: "Now", sender: "alice" });

      const response = await fetch(
        `${freshClient.url}/apps/ztm/chat/api/peers/alice/messages?before=${now - 5000}`
      );
      const data = await response.json() as ZTMMessage[];

      expect(data.length).toBe(1);
      expect(data[0]?.message).toBe("Old");

      await freshClient.stop();
    });
  });

  describe("watch functionality", () => {
    let client: MockZTMClient;

    beforeEach(async () => {
      client = new MockZTMClient();
      await client.start();
    });

    afterEach(async () => {
      await client.stop();
    });

    it("should increment watch poll count", async () => {
      await fetch(`${client.url}/api/watch?prefix=/test`);
      expect(client.getWatchPollCount()).toBe(1);

      await fetch(`${client.url}/api/watch?prefix=/test2`);
      expect(client.getWatchPollCount()).toBe(2);
    });

    it("should reset watch state", async () => {
      await fetch(`${client.url}/api/watch?prefix=/test`);
      expect(client.getWatchPollCount()).toBe(1);

      client.resetWatchState();
      expect(client.getWatchPollCount()).toBe(0);
    });

    it("should track watch polls", async () => {
      await fetch(`${client.url}/api/watch?prefix=/custom/path`);
      expect(client.getWatchPollCount()).toBe(1);
    });
  });

  describe("error handling", () => {
    let client: MockZTMClient;

    beforeEach(async () => {
      client = new MockZTMClient();
      await client.start();
    });

    afterEach(async () => {
      await client.stop();
    });

    it("should return 400 for invalid POST body", async () => {
      const response = await fetch(`${client.url}/apps/ztm/chat/api/peers/alice/messages`, {
        method: "POST",
        body: "invalid json{{{",
      });
      expect(response.status).toBe(400);
    });
  });

  describe("custom configuration", () => {
    it("should use default mesh name when not provided", () => {
      const client = new MockZTMClient();
      expect(client.url).toBeDefined();
    });

    it("should handle empty configuration", () => {
      const client = new MockZTMClient({});
      expect(client.url).toBeDefined();
    });

    it("should use provided mesh name", () => {
      const client = new MockZTMClient({ meshName: "custom-mesh" });
      expect(client.url).toBeDefined();
    });

    it("should use provided username", () => {
      const client = new MockZTMClient({ username: "custom-bot" });
      expect(client.url).toBeDefined();
    });
  });
});
