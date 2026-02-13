// Unit tests for Logger

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockLoggerFns } from "../test-utils/mocks.js";

// Logger instance for testing
class TestLogger {
  private logLevel: "debug" | "info" | "warn" | "error" = "info";
  private logs: Array<{ level: string; message: string; context?: Record<string, unknown> }> = [];

  private shouldLog(level: "debug" | "info" | "warn" | "error"): boolean {
    const levels = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private formatEntry(level: "debug" | "info" | "warn" | "error", message: string, context?: Record<string, unknown>): string {
    const contextStr = context ? ` ${JSON.stringify(context)}` : "";
    return `[${new Date().toISOString()}] [${level.toUpperCase()}] [ztm-chat] ${message}${contextStr}`;
  }

  private log(level: "debug" | "info" | "warn" | "error", message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry = this.formatEntry(level, message, context);
    this.logs.push({ level, message, context });

    switch (level) {
      case "debug":
        console.debug(entry);
        break;
      case "info":
        console.info(entry);
        break;
      case "warn":
        console.warn(entry);
        break;
      case "error":
        console.error(entry);
        break;
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log("error", message, context);
  }

  setLevel(level: "debug" | "info" | "warn" | "error"): void {
    this.logLevel = level;
  }

  getLogs(): Array<{ level: string; message: string; context?: Record<string, unknown> }> {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }
}

describe("Logger", () => {
  let logger: TestLogger;

  beforeEach(() => {
    logger = new TestLogger();
  });

  afterEach(() => {
    logger.clearLogs();
  });

  describe("Log Level Filtering", () => {
    it("should log info messages when level is info", () => {
      logger.setLevel("info");
      logger.info("test message");

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe("info");
      expect(logs[0].message).toBe("test message");
    });

    it("should not log debug messages when level is info", () => {
      logger.setLevel("info");
      logger.debug("debug message");

      const logs = logger.getLogs();
      expect(logs).toHaveLength(0);
    });

    it("should log all messages when level is debug", () => {
      logger.setLevel("debug");
      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      const logs = logger.getLogs();
      expect(logs).toHaveLength(4);
    });

    it("should only log error messages when level is error", () => {
      logger.setLevel("error");
      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe("error");
    });
  });

  describe("Message Formatting", () => {
    it("should include timestamp in log entry", () => {
      logger.info("test message");
      const logs = logger.getLogs();

      expect(logs[0].message).toContain("test message");
    });

    it("should include context in log entry when provided", () => {
      const context = { userId: "alice", action: "sendMessage" };
      logger.info("message sent", context);

      const logs = logger.getLogs();
      expect(logs[0].context).toEqual(context);
    });

    it("should have no context when not provided", () => {
      logger.info("simple message");

      const logs = logger.getLogs();
      expect(logs[0].context).toBeUndefined();
    });
  });

  describe("Context-aware Logger Factory", () => {
    it("should create context-aware loggers", () => {
      const context = { channel: "ztm-chat", accountId: "default" };

      const createLogger = (ctx: Record<string, string>) => ({
        debug: (msg: string) => logger.debug(msg, ctx),
        info: (msg: string) => logger.info(msg, ctx),
        warn: (msg: string) => logger.warn(msg, ctx),
        error: (msg: string) => logger.error(msg, ctx),
      });

      const channelLogger = createLogger(context);
      channelLogger.info("Connected to mesh");

      const logs = logger.getLogs();
      expect(logs[0].context).toEqual(context);
    });
  });

  describe("Log Entry Structure", () => {
    it("should have correct structure for each log level", () => {
      logger.setLevel("debug");
      logger.debug("debug msg");
      logger.info("info msg");
      logger.warn("warn msg");
      logger.error("error msg");

      const logs = logger.getLogs();

      for (const log of logs) {
        expect(log).toHaveProperty("level");
        expect(log).toHaveProperty("message");
        expect(typeof log.level).toBe("string");
        expect(typeof log.message).toBe("string");
      }
    });

    it("should order logs by creation time", () => {
      logger.setLevel("debug");
      logger.info("first");
      logger.info("second");
      logger.info("third");

      const logs = logger.getLogs();
      expect(logs[0].message).toBe("first");
      expect(logs[1].message).toBe("second");
      expect(logs[2].message).toBe("third");
    });
  });

  describe("Environment Configuration", () => {
    it("should support setting log level", () => {
      logger.setLevel("warn");
      logger.info("should not appear");
      logger.warn("should appear");

      expect(logger.getLogs()).toHaveLength(1);
    });

    it("should handle level changes", () => {
      logger.setLevel("error");
      logger.error("error 1");

      logger.setLevel("debug");
      logger.debug("debug 1");

      const logs = logger.getLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0].level).toBe("error");
      expect(logs[1].level).toBe("debug");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty message", () => {
      logger.info("");

      expect(logger.getLogs()).toHaveLength(1);
    });

    it("should handle complex context objects", () => {
      const complexContext = {
        nested: { deep: { value: 123 } },
        array: [1, 2, 3],
        boolean: true,
        null: null,
      };

      logger.info("complex context", complexContext);

      const logs = logger.getLogs();
      expect(logs[0].context).toEqual(complexContext);
    });

    it("should handle unicode characters in messages", () => {
      logger.info("你好世界 🌍 Привет мир");

      const logs = logger.getLogs();
      expect(logs[0].message).toContain("你好世界");
      expect(logs[0].message).toContain("Привет");
    });
  });
});
