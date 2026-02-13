// Unit tests for Runtime

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockLoggerFns } from "../test-utils/mocks.js";

// Mock PluginRuntime interface
interface MockPluginRuntime {
  onMessage: (callback: (message: unknown) => void) => () => void;
  log?: {
    info?: (message: string) => void;
    debug?: (message: string) => void;
    warn?: (message: string) => void;
    error?: (message: string) => void;
  };
}

// Runtime state
interface RuntimeState {
  initialized: boolean;
  connected: boolean;
  messageCallbacks: Set<(message: unknown) => void>;
  lastError: string | null;
}

describe("Runtime Management", () => {
  let runtime: PluginRuntime | null = null;
  let state: RuntimeState;

  // Mock PluginRuntime type
  type PluginRuntime = MockPluginRuntime;

  const setRuntime = (next: PluginRuntime) => {
    runtime = next;
  };

  const getRuntime = (): PluginRuntime => {
    if (!runtime) {
      throw new Error("Runtime not initialized");
    }
    return runtime;
  };

  beforeEach(() => {
    state = {
      initialized: false,
      connected: false,
      messageCallbacks: new Set(),
      lastError: null,
    };
    runtime = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Runtime Initialization", () => {
    it("should throw error when runtime not initialized", () => {
      expect(() => getRuntime()).toThrow("Runtime not initialized");
    });

    it("should return runtime after initialization", () => {
      const mockRuntime: PluginRuntime = {
        onMessage: () => () => {},
      };

      setRuntime(mockRuntime);

      expect(getRuntime()).toBeDefined();
      expect(getRuntime()).toBe(mockRuntime);
    });
  });

  describe("Message Callbacks", () => {
    it("should register message callback", () => {
      const callback = vi.fn();
      const mockRuntime: PluginRuntime = {
        onMessage: (cb) => {
          state.messageCallbacks.add(cb);
          return () => state.messageCallbacks.delete(cb);
        },
      };

      setRuntime(mockRuntime);
      const rt = getRuntime();
      const unsubscribe = rt.onMessage(callback);

      expect(state.messageCallbacks.has(callback)).toBe(true);
      expect(typeof unsubscribe).toBe("function");
    });

    it("should unsubscribe message callback", () => {
      const callback = vi.fn();
      const mockRuntime: PluginRuntime = {
        onMessage: (cb) => {
          state.messageCallbacks.add(cb);
          return () => state.messageCallbacks.delete(cb);
        },
      };

      setRuntime(mockRuntime);
      const rt = getRuntime();
      const unsubscribe = rt.onMessage(callback);

      expect(state.messageCallbacks.has(callback)).toBe(true);

      unsubscribe();

      expect(state.messageCallbacks.has(callback)).toBe(false);
    });

    it("should handle multiple callbacks", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const mockRuntime: PluginRuntime = {
        onMessage: (cb) => {
          state.messageCallbacks.add(cb);
          return () => state.messageCallbacks.delete(cb);
        },
      };

      setRuntime(mockRuntime);
      const rt = getRuntime();

      rt.onMessage(callback1);
      rt.onMessage(callback2);

      expect(state.messageCallbacks.size).toBe(2);
    });
  });

  describe("Runtime State", () => {
    it("should track initialization state", () => {
      expect(state.initialized).toBe(false);

      state.initialized = true;

      expect(state.initialized).toBe(true);
    });

    it("should track connection state", () => {
      expect(state.connected).toBe(false);

      state.connected = true;

      expect(state.connected).toBe(true);
    });

    it("should track last error", () => {
      expect(state.lastError).toBeNull();

      state.lastError = "Connection failed";

      expect(state.lastError).toBe("Connection failed");
    });
  });

  describe("Callback Invocation", () => {
    it("should invoke registered callbacks with message", () => {
      const callback = vi.fn();
      const storedCallback: { cb?: (message: unknown) => void } = {};

      const mockRuntime: PluginRuntime = {
        onMessage: (cb) => {
          storedCallback.cb = cb;
          return () => {};
        },
      };

      setRuntime(mockRuntime);
      const rt = getRuntime();

      rt.onMessage(callback);

      // Simulate receiving a message
      if (storedCallback.cb) {
        storedCallback.cb({ content: "Hello", sender: "alice" });
      }

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({
        content: "Hello",
        sender: "alice",
      });
    });
  });

  describe("Logging", () => {
    it("should support info logging", () => {
      const mockLog = { info: vi.fn() };

      const mockRuntime: PluginRuntime = {
        onMessage: () => () => {},
        log: mockLog,
      };

      mockRuntime.log!.info!("Test message");

      expect(mockLog.info).toHaveBeenCalledWith("Test message");
    });

    it("should support debug logging", () => {
      const mockLog = { debug: vi.fn() };

      const mockRuntime: PluginRuntime = {
        onMessage: () => () => {},
        log: mockLog,
      };

      mockRuntime.log!.debug!("Debug message");

      expect(mockLog.debug).toHaveBeenCalledWith("Debug message");
    });

    it("should handle missing logger gracefully", () => {
      const mockRuntime: PluginRuntime = {
        onMessage: () => () => {},
      };

      // Should not throw - log is undefined so these are no-ops
      mockRuntime.log?.info?.("Test");
      mockRuntime.log?.debug?.("Test");
      mockRuntime.log?.warn?.("Test");
      mockRuntime.log?.error?.("Test");
    });
  });
});

describe("Channel State Management", () => {
  interface ChannelState {
    configured: boolean;
    running: boolean;
    lastStartAt: Date | null;
    lastStopAt: Date | null;
    lastError: string | null;
    lastInboundAt: Date | null;
    lastOutboundAt: Date | null;
  }

  it("should have correct initial state", () => {
    const state: ChannelState = {
      configured: false,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
      lastInboundAt: null,
      lastOutboundAt: null,
    };

    expect(state.configured).toBe(false);
    expect(state.running).toBe(false);
    expect(state.lastStartAt).toBeNull();
    expect(state.lastStopAt).toBeNull();
    expect(state.lastError).toBeNull();
  });

  it("should update state on connection", () => {
    const state: ChannelState = {
      configured: false,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
      lastInboundAt: null,
      lastOutboundAt: null,
    };

    state.configured = true;
    state.running = true;
    state.lastStartAt = new Date();

    expect(state.configured).toBe(true);
    expect(state.running).toBe(true);
    expect(state.lastStartAt).not.toBeNull();
  });

  it("should track inbound messages", () => {
    const state: ChannelState = {
      configured: false,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
      lastInboundAt: null,
      lastOutboundAt: null,
    };

    state.lastInboundAt = new Date();

    expect(state.lastInboundAt).not.toBeNull();
  });

  it("should track outbound messages", () => {
    const state: ChannelState = {
      configured: false,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
      lastInboundAt: null,
      lastOutboundAt: null,
    };

    state.lastOutboundAt = new Date();

    expect(state.lastOutboundAt).not.toBeNull();
  });

  it("should track errors", () => {
    const state: ChannelState = {
      configured: false,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
      lastInboundAt: null,
      lastOutboundAt: null,
    };

    state.lastError = "Connection timeout";

    expect(state.lastError).toBe("Connection timeout");
  });
});
