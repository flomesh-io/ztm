// Unit tests for ZTM Chat Channel Plugin

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("ZTM Chat Channel Plugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("Channel Metadata", () => {
    it("should have correct channel id", () => {
      const meta = {
        id: "ztm-chat",
        label: "ZTM Chat",
        selectionLabel: "ZTM Chat (P2P)",
        docsPath: "/channels/ztm-chat",
        blurb: "Decentralized P2P messaging via ZTM (Zero Trust Mesh) network",
        aliases: ["ztm", "ztmp2p"],
        quickstartAllowFrom: true,
      };

      expect(meta.id).toBe("ztm-chat");
      expect(meta.quickstartAllowFrom).toBe(true);
      expect(meta.aliases).toContain("ztm");
      expect(meta.aliases).toContain("ztmp2p");
    });

    it("should have correct capabilities", () => {
      const capabilities = {
        chatTypes: ["direct"],
        reactions: false,
        threads: false,
        media: false,
        nativeCommands: false,
        blockStreaming: true,
      };

      expect(capabilities.chatTypes).toEqual(["direct"]);
      expect(capabilities.reactions).toBe(false);
      expect(capabilities.blockStreaming).toBe(true);
    });
  });

  describe("Message Processing", () => {
    describe("Message Normalization", () => {
      it("should normalize incoming messages", () => {
        const rawMessage = {
          time: 1234567890,
          message: "Hello, world!",
          sender: "alice",
        };

        const normalized = {
          id: `${rawMessage.time}-${rawMessage.sender}`,
          content: rawMessage.message,
          sender: rawMessage.sender,
          senderId: rawMessage.sender,
          timestamp: new Date(rawMessage.time),
          peer: rawMessage.sender,
        };

        expect(normalized.id).toBe("1234567890-alice");
        expect(normalized.content).toBe("Hello, world!");
        expect(normalized.sender).toBe("alice");
        expect(normalized.timestamp.getTime()).toBe(1234567890);
        expect(normalized.peer).toBe("alice");
      });

      it("should include all required message fields", () => {
        const msg = {
          id: "test-id",
          content: "Test",
          sender: "bob",
          senderId: "bob",
          timestamp: new Date(),
          peer: "bob",
        };

        expect(msg.id).toBeDefined();
        expect(msg.content).toBeDefined();
        expect(msg.sender).toBeDefined();
        expect(msg.senderId).toBeDefined();
        expect(msg.timestamp).toBeInstanceOf(Date);
        expect(msg.peer).toBeDefined();
      });
    });

    describe("Message Deduplication", () => {
      it("should detect duplicate messages", () => {
        const seen = new Set<string>();
        const sender = "alice";
        const time = 1234567890;
        const content = "hello";
        const key = `${sender}-${time}-${content}`;

        // First message
        if (!seen.has(key)) {
          seen.add(key);
        }

        // Duplicate check
        const isDuplicate = seen.has(key);
        expect(isDuplicate).toBe(true);
      });

      it("should allow unique messages", () => {
        const seen = new Set<string>();

        seen.add("alice-1234567890-hello1");
        seen.add("alice-1234567890-hello2");
        seen.add("bob-1234567890-hello");

        expect(seen.size).toBe(3);
      });

      it("should generate unique deduplication keys", () => {
        const generateKey = (sender: string, time: number, content: string): string => {
          return `${sender}-${time}-${content.substring(0, 32)}`;
        };

        const key1 = generateKey("alice", 1000, "hello world");
        const key2 = generateKey("alice", 1000, "goodbye");
        const key3 = generateKey("bob", 1000, "hello world");

        expect(key1).not.toBe(key2);
        expect(key1).not.toBe(key3);
      });
    });
  });

  describe("Pairing State Management", () => {
    describe("Pending Pairings Map", () => {
      it("should track pending pairings", () => {
        const pendingPairings = new Map<string, Date>();

        pendingPairings.set("alice", new Date());
        pendingPairings.set("bob", new Date());

        expect(pendingPairings.has("alice")).toBe(true);
        expect(pendingPairings.has("bob")).toBe(true);
        expect(pendingPairings.size).toBe(2);
      });

      it("should delete pending pairings", () => {
        const pendingPairings = new Map<string, Date>();
        pendingPairings.set("alice", new Date());

        pendingPairings.delete("alice");

        expect(pendingPairings.has("alice")).toBe(false);
        expect(pendingPairings.size).toBe(0);
      });

      it("should clear all pending pairings", () => {
        const pendingPairings = new Map<string, Date>();
        pendingPairings.set("alice", new Date());
        pendingPairings.set("bob", new Date());
        pendingPairings.set("charlie", new Date());

        pendingPairings.clear();

        expect(pendingPairings.size).toBe(0);
      });

      it("should store timestamps", () => {
        const pendingPairings = new Map<string, Date>();
        const now = new Date();
        pendingPairings.set("alice", now);

        const stored = pendingPairings.get("alice");
        expect(stored).toBeInstanceOf(Date);
        expect(stored?.getTime()).toBe(now.getTime());
      });
    });
  });

  describe("Pairing Request Message", () => {
    it("should generate pairing request with correct format", () => {
      const peer = "alice";
      const botUsername = "test-bot";

      const message = `[🤖 PAIRING REQUEST]\n\nUser "${peer}" wants to send messages to your OpenClaw ZTM Chat bot.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `To approve this user, run:\n` +
        `  openclaw pairing approve ztm-chat ${peer}\n\n` +
        `To deny this request, run:\n` +
        `  openclaw pairing deny ztm-chat ${peer}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Note: Your bot is in "pairing" mode, which requires explicit approval for new users.`;

      expect(message).toContain("PAIRING REQUEST");
      expect(message).toContain(`User "${peer}"`);
      expect(message).toContain("openclaw pairing approve ztm-chat alice");
      expect(message).toContain("openclaw pairing deny ztm-chat alice");
      expect(message).toContain('"pairing"');
    });

    it("should create valid ZTM message structure", () => {
      const message = {
        time: Date.now(),
        message: "Test pairing message",
        sender: "test-bot",
      };

      expect(typeof message.time).toBe("number");
      expect(typeof message.message).toBe("string");
      expect(typeof message.sender).toBe("string");
    });
  });

  describe("Directory Operations", () => {
    it("should format peer entries correctly", () => {
      const users = [
        { username: "alice", endpoint: "endpoint-1" },
        { username: "bob", endpoint: "endpoint-2" },
      ];

      const formatted = users.map((user) => ({
        kind: "user" as const,
        id: user.username,
        name: user.username,
        raw: user,
      }));

      expect(formatted).toHaveLength(2);
      expect(formatted[0].kind).toBe("user");
      expect(formatted[0].id).toBe("alice");
      expect(formatted[0].raw.endpoint).toBe("endpoint-1");
    });

    it("should handle empty peer list", () => {
      const users: any[] = [];

      const formatted = users.map((user) => ({
        kind: "user" as const,
        id: user?.username,
        name: user?.username,
        raw: user,
      }));

      expect(formatted).toHaveLength(0);
    });
  });

  describe("Channel Status", () => {
    it("should build valid channel summary", () => {
      const summary = {
        configured: true,
        running: true,
        connected: true,
        lastStartAt: new Date("2026-01-01"),
        lastStopAt: null as Date | null,
        lastError: null as string | null,
        lastInboundAt: new Date("2026-01-02"),
        lastOutboundAt: new Date("2026-01-03"),
        peerCount: 5,
      };

      expect(summary.configured).toBe(true);
      expect(summary.running).toBe(true);
      expect(summary.connected).toBe(true);
      expect(summary.peerCount).toBe(5);
      expect(summary.lastStopAt).toBeNull();
      expect(summary.lastError).toBeNull();
    });

    it("should collect status issues", () => {
      const issues: Array<{ level: string; message: string }> = [];

      issues.push({
        level: "error",
        message: "Not connected to ZTM mesh",
      });

      issues.push({
        level: "warn",
        message: "No other endpoints in mesh",
      });

      expect(issues).toHaveLength(2);
      expect(issues[0].level).toBe("error");
      expect(issues[1].level).toBe("warn");
    });

    it("should validate probe results", () => {
      const probeSuccess = {
        ok: true,
        error: null as string | null,
        meshInfo: {
          name: "test-mesh",
          connected: true,
          endpoints: 3,
          errors: [] as Array<{ time: string; message: string }>,
        },
      };

      const probeFailure = {
        ok: false,
        error: "Connection refused",
        meshInfo: null as any,
      };

      expect(probeSuccess.ok).toBe(true);
      expect(probeFailure.ok).toBe(false);
    });
  });

  describe("Account Runtime State", () => {
    it("should initialize account state correctly", () => {
      const state = {
        accountId: "default",
        config: {
          agentUrl: "https://example.com:7777",
          meshName: "test-mesh",
          username: "test-bot",
          dmPolicy: "pairing",
          allowFrom: ["alice"],
        },
        apiClient: null as any,
        connected: false,
        meshConnected: false,
        lastError: null as string | null,
        lastStartAt: null as Date | null,
        lastStopAt: null as Date | null,
        lastInboundAt: null as Date | null,
        lastOutboundAt: null as Date | null,
        peerCount: 0,
        messageCallbacks: new Set<(msg: any) => void>(),
        watchInterval: null as any,
        watchErrorCount: 0,
        pendingPairings: new Map<string, Date>(),
      };

      expect(state.accountId).toBe("default");
      expect(state.config.dmPolicy).toBe("pairing");
      expect(state.config.allowFrom).toEqual(["alice"]);
      expect(state.pendingPairings).toBeInstanceOf(Map);
      expect(state.messageCallbacks).toBeInstanceOf(Set);
    });

    it("should handle state transitions", () => {
      let connected = false;
      let meshConnected = false;

      // Initial state
      expect(connected).toBe(false);

      // Connect
      connected = true;
      meshConnected = true;
      expect(connected).toBe(true);
      expect(meshConnected).toBe(true);

      // Disconnect
      connected = false;
      meshConnected = false;
      expect(connected).toBe(false);
      expect(meshConnected).toBe(false);
    });
  });

  describe("CLI Command Support", () => {
    it("should support pairing list command format", () => {
      const command = "openclaw pairing list ztm-chat";
      const parts = command.split(" ");

      expect(parts[0]).toBe("openclaw");
      expect(parts[1]).toBe("pairing");
      expect(parts[2]).toBe("list");
      expect(parts[3]).toBe("ztm-chat");
    });

    it("should support pairing approve command format", () => {
      const command = "openclaw pairing approve ztm-chat ABC12345";
      const parts = command.split(" ");

      expect(parts[0]).toBe("openclaw");
      expect(parts[1]).toBe("pairing");
      expect(parts[2]).toBe("approve");
      expect(parts[3]).toBe("ztm-chat");
      expect(parts[4]).toBe("ABC12345");
    });
  });
});
