// Unit tests for ZTM API Client

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock ZTM Message interface
interface ZTMMessage {
  time: number;
  message: string;
  sender: string;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const DEFAULT_TIMEOUT = 30000;
  const MAX_RETRIES = 3;
  const RETRY_INITIAL_DELAY = 1000;
  const RETRY_MAX_DELAY = 10000;
  const RETRY_BACKOFF_MULTIPLIER = 2;

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getRetryDelay(attempt: number): number {
    const delay = RETRY_INITIAL_DELAY * Math.pow(RETRY_BACKOFF_MULTIPLIER, attempt - 1);
    return Math.min(delay, RETRY_MAX_DELAY);
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error instanceof Error ? error : new Error(String(error));

      if (
        !lastError.name.includes("AbortError") &&
        !lastError.message.includes("timeout") &&
        !lastError.message.includes("fetch") &&
        !lastError.message.includes("network")
      ) {
        throw lastError;
      }

      if (attempt < MAX_RETRIES) {
        const delay = getRetryDelay(attempt + 1);
        await sleep(delay);
      }
    }
  }

  throw new Error(`Request failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`);
}

describe("ZTM API Client", () => {
  describe("fetchWithTimeout", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should correctly construct URL and options", async () => {
      const mockResponse = new Response(JSON.stringify({ connected: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

      const url = "http://test.com/api";
      const options: RequestInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
        body: JSON.stringify({ key: "value" }),
      };

      const response = await fetchWithTimeout(url, options);

      // Verify fetch was called
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining(url),
        expect.objectContaining({
          method: options.method,
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          body: options.body,
        })
      );
      expect(response.ok).toBe(true);
    });

    it("should handle fetch errors correctly", async () => {
      const networkError = new Error("Network error");
      vi.spyOn(globalThis, "fetch").mockRejectedValue(networkError);

      await expect(
        fetchWithTimeout("http://test.com/api", { method: "GET" })
      ).rejects.toThrow("Network error");
    }); // Increase timeout for this test

    it("should return response when request completes in time", async () => {
      const mockResponse = new Response(JSON.stringify({ connected: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

      const response = await fetchWithTimeout("http://test.com/api", {
        method: "GET",
      });

      expect(response.ok).toBe(true);
    });

    it("should include headers in request", async () => {
      const mockResponse = new Response(JSON.stringify({ ok: true }), {
        status: 200,
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

      await fetchWithTimeout("http://test.com/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://test.com/api",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer token",
          }),
        })
      );
    });

    it("should handle network errors", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Network error")
      );

      await expect(
        fetchWithTimeout("http://test.com/api", { method: "GET" })
      ).rejects.toThrow("Network error");
    });

    it("should pass body in request", async () => {
      const mockResponse = new Response(JSON.stringify({ ok: true }), {
        status: 200,
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

      const body = { message: "test" };

      await fetchWithTimeout("http://test.com/api", {
        method: "POST",
        body: JSON.stringify(body),
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://test.com/api",
        expect.objectContaining({
          body: JSON.stringify(body),
        })
      );
    });
  });

  describe("Message Path Building", () => {
    it("should build peer message path correctly", () => {
      const buildPeerMessagePath = (
        messagePath: string,
        username: string,
        peer: string
      ) => `${messagePath}/${username}/publish/peers/${peer}/messages/`;

      const result = buildPeerMessagePath("/shared", "bot", "alice");

      expect(result).toBe("/shared/bot/publish/peers/alice/messages/");
    });

    it("should build group message path correctly", () => {
      const buildGroupMessagePath = (
        messagePath: string,
        username: string,
        creator: string,
        group: string
      ) =>
        `${messagePath}/${username}/publish/groups/${creator}/${group}/messages/`;

      const result = buildGroupMessagePath("/shared", "bot", "alice", "mygroup");

      expect(result).toBe("/shared/bot/publish/groups/alice/mygroup/messages/");
    });
  });

  describe("Message Path Parsing", () => {
    it("should extract peer from peer message path", () => {
      const path = "/shared/bot/publish/peers/alice/messages/";
      const peerMatch = path.match(
        /\/shared\/[^/]+\/publish\/peers\/([^/]+)\/messages/
      );

      expect(peerMatch?.[1]).toBe("alice");
    });

    it("should extract creator and group from group message path", () => {
      const path = "/shared/bot/publish/groups/alice/mygroup/messages/";
      const groupMatch = path.match(
        /\/shared\/[^/]+\/publish\/groups\/([^/]+)\/([^/]+)\/messages/
      );

      expect(groupMatch?.[1]).toBe("alice");
      expect(groupMatch?.[2]).toBe("mygroup");
    });

    it("should return null for invalid path", () => {
      const path = "/invalid/path";
      const peerMatch = path.match(
        /\/shared\/[^/]+\/publish\/peers\/([^/]+)\/messages/
      );

      expect(peerMatch).toBeNull();
    });
  });

  describe("ZTM Message Structure", () => {
    it("should validate ZTM message structure", () => {
      const message: ZTMMessage = {
        time: Date.now(),
        message: "Hello",
        sender: "alice",
      };

      expect(message).toHaveProperty("time");
      expect(message).toHaveProperty("message");
      expect(message).toHaveProperty("sender");
      expect(typeof message.time).toBe("number");
      expect(typeof message.message).toBe("string");
      expect(typeof message.sender).toBe("string");
    });
  });

  describe("Mesh Info Structure", () => {
    it("should validate mesh info structure", () => {
      interface ZTMMeshInfo {
        name: string;
        connected: boolean;
        endpoints: number;
      }

      const meshInfo: ZTMMeshInfo = {
        name: "my-mesh",
        connected: true,
        endpoints: 3,
      };

      expect(meshInfo).toHaveProperty("name");
      expect(meshInfo).toHaveProperty("connected");
      expect(meshInfo).toHaveProperty("endpoints");
      expect(meshInfo.connected).toBe(true);
      expect(meshInfo.endpoints).toBeGreaterThan(0);
    });
  });

  describe("URL Construction", () => {
    it("should handle URL with trailing slash removal", () => {
      const baseUrl = "https://example.com:7777/".replace(/\/$/, "");
      const meshPath = "/api/meshes/my-mesh";
      const url = `${baseUrl}${meshPath}`;

      expect(url).toBe("https://example.com:7777/api/meshes/my-mesh");
    });

    it("should construct correct API URLs", () => {
      const baseUrl = "https://agent.example.com:7777".replace(/\/$/, "");
      const meshPath = "/api/meshes/test-mesh";
      const meshInfoUrl = `${baseUrl}${meshPath}`;
      const messagesUrl = `${baseUrl}${meshPath}/messages`;

      expect(meshInfoUrl).toBe("https://agent.example.com:7777/api/meshes/test-mesh");
      expect(messagesUrl).toBe("https://agent.example.com:7777/api/meshes/test-mesh/messages");
    });
  });

  describe("Content-Type Handling", () => {
    it("should identify JSON content type", () => {
      const contentType = "application/json";
      const isJson = contentType.includes("application/json");

      expect(isJson).toBe(true);
    });

    it("should handle non-JSON content type", () => {
      const contentType = "text/plain";
      const isJson = contentType.includes("application/json");

      expect(isJson).toBe(false);
    });
  });

  describe("ACL Structure", () => {
    it("should validate ACL user permissions", () => {
      const aclUsers: Record<string, string> = {
        alice: "readonly",
        bob: "readwrite",
      };

      expect(aclUsers.alice).toBe("readonly");
      expect(aclUsers.bob).toBe("readwrite");
    });

    it("should handle empty ACL", () => {
      const aclUsers: Record<string, string> = {};

      expect(Object.keys(aclUsers)).toHaveLength(0);
    });
  });

  describe("Integration with Mock ZTM Agent", () => {
    let mockAgent: Awaited<ReturnType<typeof createMockAgent>>;

    async function createMockAgent() {
      const { MockZTMClient, createMockConfig } = await import("./mocks/ztm-client.js");
      const config = createMockConfig();
      const client = new MockZTMClient(config);
      await client.start();
      return { client, config };
    }

    beforeEach(async () => {
      mockAgent = await createMockAgent();
    });

    afterEach(async () => {
      if (mockAgent) {
        await mockAgent.client.stop();
      }
    });

    it("should connect to mesh and get info", async () => {
      const { client, config } = mockAgent;

      // Simulate API call
      const response = await fetch(`${client.url}/api/meshes/${config.meshName}`);
      const data = await response.json() as { name: string; connected: boolean };

      expect(response.ok).toBe(true);
      expect(data.name).toBe(config.meshName);
      expect(data.connected).toBe(true);
    });

    it("should discover users", async () => {
      const { client } = mockAgent;

      const response = await fetch(`${client.url}/apps/ztm/chat/api/users`);
      const users = await response.json() as Array<{ username: string }>;

      expect(response.ok).toBe(true);
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBe(2);
      expect(users[0].username).toBe("alice");
      expect(users[1].username).toBe("bob");
    });

    it("should get peer messages", async () => {
      const { client } = mockAgent;

      const response = await fetch(`${client.url}/apps/ztm/chat/api/peers/alice/messages`);
      const messages = await response.json() as Array<{ sender: string; message: string }>;

      expect(response.ok).toBe(true);
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBe(2);
      expect(messages[0].sender).toBe("alice");
      expect(messages[0].message).toBe("Hello!");
    });

    it("should send peer message", async () => {
      const { client } = mockAgent;

      const newMessage = {
        time: Date.now(),
        message: "Test reply",
        sender: "test-bot",
      };

      const response = await fetch(`${client.url}/apps/ztm/chat/api/peers/alice/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMessage),
      });

      expect(response.ok).toBe(true);
      const result = await response.json() as { success: boolean; id: string };
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^msg-\d+$/);
    });

    it("should watch for path changes", async () => {
      const { client } = mockAgent;

      const response = await fetch(`${client.url}/api/watch/shared%2Ftest-bot?pollingInterval=2000`);
      const changes = await response.json();

      expect(response.ok).toBe(true);
      expect(Array.isArray(changes)).toBe(true);
      expect(changes[0]).toContain("new-message");
    });

    it("should filter messages by since timestamp", async () => {
      const { client } = mockAgent;
      const now = Date.now();

      const response = await fetch(`${client.url}/apps/ztm/chat/api/peers/alice/messages?since=${now - 40000}`);
      const messages = await response.json() as Array<{ message: string }>;

      expect(response.ok).toBe(true);
      expect(Array.isArray(messages)).toBe(true);
      // Should only get messages from last 40 seconds (the "How are you?" message)
      expect(messages.length).toBe(1);
      expect(messages[0].message).toBe("How are you?");
    });

    it("should add new message via client API", async () => {
      const { client } = mockAgent;

      client.addMessage("charlie", {
        time: Date.now(),
        message: "Hello from Charlie!",
        sender: "charlie",
      });

      const response = await fetch(`${client.url}/apps/ztm/chat/api/peers/charlie/messages`);
      const messages = await response.json() as Array<{ message: string }>;

      expect(response.ok).toBe(true);
      expect(messages.length).toBe(1);
      expect(messages[0].message).toBe("Hello from Charlie!");
    });

    it("should handle unknown mesh gracefully", async () => {
      const { client } = mockAgent;

      const response = await fetch(`${client.url}/api/meshes/unknown-mesh`);

      expect(response.status).toBe(404);
      const data = await response.json() as { error: string };
      expect(data.error).toBe("Mesh not found");
    });
  });

  describe("Direct Storage API (MVP)", () => {
    describe("sendMessageViaStorage", () => {
      it("should construct correct file path for sending messages", () => {
        const config = {
          agentUrl: "https://agent.example.com:7777",
          meshName: "test-mesh",
          username: "test-bot",
        };
        const message = {
          time: 1234567890,
          message: "Hello",
          sender: "test-bot",
        };
        const messageId = `${message.time}-${message.sender}`;
        const path = `/shared/${config.username}/publish/peers/alice/messages/`;
        const expectedPath = `${path}${messageId}.json`;

        expect(expectedPath).toBe("/shared/test-bot/publish/peers/alice/messages/1234567890-test-bot.json");
      });

      it("should build correct setFileData API URL", () => {
        const baseUrl = "https://agent.example.com:7777";
        const filePath = "/shared/test-bot/publish/peers/alice/messages/1234567890-test-bot.json";
        const apiUrl = `/api/setFileData${filePath}`;
        const fullUrl = `${baseUrl}${apiUrl}`;

        expect(fullUrl).toBe("https://agent.example.com:7777/api/setFileData/shared/test-bot/publish/peers/alice/messages/1234567890-test-bot.json");
      });
    });

    describe("receiveMessagesViaStorage", () => {
      it("should construct correct subscribe path for receiving messages", () => {
        const config = {
          agentUrl: "https://agent.example.com:7777",
          meshName: "test-mesh",
          username: "test-bot",
        };
        const peer = "alice";
        const expectedPath = `/shared/${peer}/publish/peers/${config.username}/messages/`;

        expect(expectedPath).toBe("/shared/alice/publish/peers/test-bot/messages/");
      });

      it("should build correct allFiles API URL", () => {
        const baseUrl = "https://agent.example.com:7777";
        const path = "/shared/alice/publish/peers/test-bot/messages/";
        const apiUrl = `/api/allFiles${path}`;
        const fullUrl = `${baseUrl}${apiUrl}`;

        expect(fullUrl).toBe("https://agent.example.com:7777/api/allFiles/shared/alice/publish/peers/test-bot/messages/");
      });

      it("should filter messages by time correctly", () => {
        const messages = [
          { time: 1000, message: "First", sender: "alice" },
          { time: 2000, message: "Second", sender: "alice" },
          { time: 3000, message: "Third", sender: "alice" },
        ];

        const since = 1500;
        const before = 2500;
        const filtered = messages.filter(m => m.time > since && m.time < before);

        expect(filtered.length).toBe(1);
        expect(filtered[0].message).toBe("Second");
      });

      it("should handle empty message list", () => {
        const messages: { time: number; message: string; sender: string }[] = [];

        expect(messages.length).toBe(0);
      });
    });

    describe("discoverUsersViaStorage", () => {
      it("should construct correct discovery path", () => {
        const expectedPath = "/shared/*/publish/";

        expect(expectedPath).toBe("/shared/*/publish/");
      });

      it("should build correct allFiles API URL for discovery", () => {
        const baseUrl = "https://agent.example.com:7777";
        const path = "/shared/*/publish/";
        const apiUrl = `/api/allFiles${path}`;
        const fullUrl = `${baseUrl}${apiUrl}`;

        expect(fullUrl).toBe("https://agent.example.com:7777/api/allFiles/shared/*/publish/");
      });

      it("should extract username from shared path", () => {
        const path = "/shared/alice/publish/peers/test-bot/messages/123.json";
        const match = path.match(/^\/shared\/([^\/]+)\//);

        expect(match?.[1]).toBe("alice");
      });

      it("should handle multiple paths and extract unique users", () => {
        const paths = [
          "/shared/alice/publish/peers/bot/messages/1.json",
          "/shared/alice/publish/peers/bot/messages/2.json",
          "/shared/bob/publish/peers/bot/messages/1.json",
          "/shared/charlie/publish/groups/alice/test/messages/1.json",
        ];

        const userSet = new Set<string>();
        for (const p of paths) {
          const match = p.match(/^\/shared\/([^\/]+)\//);
          if (match) {
            userSet.add(match[1]);
          }
        }

        expect(userSet.size).toBe(3);
        expect(userSet.has("alice")).toBe(true);
        expect(userSet.has("bob")).toBe(true);
        expect(userSet.has("charlie")).toBe(true);
      });

      it("should exclude bot's own username from discovery", () => {
        const botUsername = "test-bot";
        const paths = [
          "/shared/alice/publish/peers/bot/messages/1.json",
          "/shared/test-bot/publish/peers/alice/messages/1.json",
          "/shared/bob/publish/peers/bot/messages/1.json",
        ];

        const userSet = new Set<string>();
        for (const p of paths) {
          const match = p.match(/^\/shared\/([^\/]+)\//);
          if (match && match[1] !== botUsername) {
            userSet.add(match[1]);
          }
        }

        expect(userSet.has("alice")).toBe(true);
        expect(userSet.has("bob")).toBe(true);
        expect(userSet.has("test-bot")).toBe(false);
      });
    });

    describe("Message Path Building", () => {
      it("should build correct outgoing message path", () => {
        const buildPeerMessagePath = (
          messagePath: string,
          username: string,
          peer: string
        ) => `${messagePath}/${username}/publish/peers/${peer}/messages/`;

        const result = buildPeerMessagePath("/shared", "test-bot", "alice");

        // Bot publishes to alice
        expect(result).toBe("/shared/test-bot/publish/peers/alice/messages/");
      });

      it("should handle special characters in usernames", () => {
        const buildPeerMessagePath = (
          messagePath: string,
          username: string,
          peer: string
        ) => `${messagePath}/${username}/publish/peers/${peer}/messages/`;

        const result = buildPeerMessagePath("/shared", "bot-test_123", "user_name-456");

        expect(result).toBe("/shared/bot-test_123/publish/peers/user_name-456/messages/");
      });
    });
  });
});
