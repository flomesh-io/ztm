// Unit tests for Mesh connectivity functions

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkPortOpen, getPublicKeyFromIdentity, joinMesh } from "./mesh.js";

// Mock state using mutable container
const mockState = {
  childProcessValue: null as any,
  childProcessError: null as Error | null,
  socketEvent: null as string | null,
};

vi.mock("child_process", () => ({
  spawn: vi.fn(() => {
    if (mockState.childProcessError) throw mockState.childProcessError;
    return mockState.childProcessValue;
  }),
}));

// Track event handlers for manual triggering
const socketHandlers: Map<string, () => void> = new Map();

vi.mock("net", () => ({
  Socket: class MockSocket {
    setTimeout = vi.fn((ms: number) => {});
    on = vi.fn(function(this: any, event: string, handler: () => void) {
      socketHandlers.set(event, handler);
      // Auto-trigger if event matches mockState.socketEvent
      if (event === mockState.socketEvent) {
        setTimeout(handler, 0);
      }
    });
    connect = vi.fn();
    destroy = vi.fn();
  },
}));

describe("Mesh connectivity functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.childProcessValue = null;
    mockState.childProcessError = null;
    mockState.socketEvent = null;
    socketHandlers.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("checkPortOpen", () => {
    it("should return true when port is open", async () => {
      mockState.socketEvent = "connect";

      const result = await checkPortOpen("localhost", 7777);

      expect(result).toBe(true);
    });

    it("should return false when port is closed (timeout)", async () => {
      mockState.socketEvent = "timeout";

      const result = await checkPortOpen("localhost", 7777);

      expect(result).toBe(false);
    });

    it("should return false when port is closed (error)", async () => {
      mockState.socketEvent = "error";

      const result = await checkPortOpen("localhost", 7777);

      expect(result).toBe(false);
    });

    it("should handle various hostnames", async () => {
      mockState.socketEvent = "connect";

      await checkPortOpen("example.com", 443);
      await checkPortOpen("192.168.1.1", 8080);

      // No assertion needed - just verify no errors are thrown
    });
  });

  describe("getPublicKeyFromIdentity", () => {
    it("should return public key on successful execution", async () => {
      const mockPublicKey = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA\n-----END PUBLIC KEY-----";

      mockState.childProcessValue = {
        stdout: {
          on: vi.fn(function(this: any, event: string, handler: (data: string) => void) {
            if (event === "data") handler(mockPublicKey);
          }),
        },
        stderr: { on: vi.fn() },
        on: vi.fn(function(this: any, event: string, handler: (code: number) => void) {
          if (event === "close") handler(0);
        }),
      };

      const result = await getPublicKeyFromIdentity();

      expect(result).toBe(mockPublicKey);
    });

    it("should return null on non-zero exit code", async () => {
      mockState.childProcessValue = {
        stdout: { on: vi.fn() },
        stderr: {
          on: vi.fn(function(this: any, event: string, handler: (data: string) => void) {
            if (event === "data") handler("Error: something went wrong\n");
          }),
        },
        on: vi.fn(function(this: any, event: string, handler: (code: number) => void) {
          if (event === "close") handler(1);
        }),
      };

      const result = await getPublicKeyFromIdentity();

      expect(result).toBeNull();
    });

    it("should return null when public key not found in output", async () => {
      mockState.childProcessValue = {
        stdout: {
          on: vi.fn(function(this: any, event: string, handler: (data: string) => void) {
            if (event === "data") handler("Some other output\nNo public key here\n");
          }),
        },
        stderr: { on: vi.fn() },
        on: vi.fn(function(this: any, event: string, handler: (code: number) => void) {
          if (event === "close") handler(0);
        }),
      };

      const result = await getPublicKeyFromIdentity();

      expect(result).toBeNull();
    });

    it("should handle spawn error", async () => {
      // Instead of throwing, return a child that emits error event
      mockState.childProcessValue = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(function(this: any, event: string, handler: (...args: any[]) => void) {
          if (event === "error") {
            setTimeout(() => handler(new Error("spawn ENOENT")), 0);
          } else if (event === "close") {
            setTimeout(() => handler(1), 0);
          }
        }),
      };

      const result = await getPublicKeyFromIdentity();

      expect(result).toBeNull();
    });

    it("should extract public key from mixed output", async () => {
      const mockOutput = `Some header text
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA
-----END PUBLIC KEY-----
Some footer text`;

      mockState.childProcessValue = {
        stdout: {
          on: vi.fn(function(this: any, event: string, handler: (data: string) => void) {
            if (event === "data") handler(mockOutput);
          }),
        },
        stderr: { on: vi.fn() },
        on: vi.fn(function(this: any, event: string, handler: (code: number) => void) {
          if (event === "close") handler(0);
        }),
      };

      const result = await getPublicKeyFromIdentity();

      expect(result).toContain("-----BEGIN PUBLIC KEY-----");
      expect(result).toContain("-----END PUBLIC KEY-----");
    });
  });

  describe("joinMesh", () => {
    it("should return true on successful join", async () => {
      mockState.childProcessValue = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(function(this: any, event: string, handler: (code: number) => void) {
          if (event === "close") handler(0);
        }),
      };

      const result = await joinMesh("test-mesh", "test-endpoint", "/path/to/permit.json");

      expect(result).toBe(true);
    });

    it("should return false on non-zero exit code", async () => {
      mockState.childProcessValue = {
        stdout: { on: vi.fn() },
        stderr: {
          on: vi.fn(function(this: any, event: string, handler: (data: string) => void) {
            if (event === "data") handler("Error: Failed to join mesh\n");
          }),
        },
        on: vi.fn(function(this: any, event: string, handler: (code: number) => void) {
          if (event === "close") handler(1);
        }),
      };

      const result = await joinMesh("test-mesh", "test-endpoint", "/path/to/permit.json");

      expect(result).toBe(false);
    });

    it("should handle spawn error", async () => {
      // Instead of throwing, return a child that emits error event
      mockState.childProcessValue = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(function(this: any, event: string, handler: (...args: any[]) => void) {
          if (event === "error") {
            setTimeout(() => handler(new Error("Command failed")), 0);
          } else if (event === "close") {
            setTimeout(() => handler(1), 0);
          }
        }),
      };

      const result = await joinMesh("test-mesh", "test-endpoint", "/path/to/permit.json");

      expect(result).toBe(false);
    });

    it("should handle special characters in mesh name", async () => {
      mockState.childProcessValue = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(function(this: any, event: string, handler: (code: number) => void) {
          if (event === "close") handler(0);
        }),
      };

      const result = await joinMesh("test_mesh-123", "endpoint-456", "/path/to/permit.json");

      expect(result).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should handle network timeout gracefully", async () => {
      mockState.socketEvent = "timeout";

      const result = await checkPortOpen("unreachable-host", 7777);

      expect(result).toBe(false);
    });

    it("should handle malformed permit path", async () => {
      mockState.childProcessValue = {
        stdout: { on: vi.fn() },
        stderr: {
          on: vi.fn(function(this: any, event: string, handler: (data: string) => void) {
            if (event === "data") handler("Error: Invalid permit file\n");
          }),
        },
        on: vi.fn(function(this: any, event: string, handler: (code: number) => void) {
          if (event === "close") handler(1);
        }),
      };

      const result = await joinMesh("test-mesh", "test-endpoint", "/invalid/path/permit.json");

      expect(result).toBe(false);
    });
  });
});
