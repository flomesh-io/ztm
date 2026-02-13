// ZTM Chat Plugin Logger
// Structured logging with level support

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Logger interface for dependency injection
 */
export interface Logger {
  debug: (message: string, context?: Record<string, unknown>) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
}

interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  channel: string;
  message: string;
  context?: Record<string, unknown>;
}

class ZTMChatLogger {
  private static instance: ZTMChatLogger;
  private logLevel: LogLevel = "info";
  private channel = "ztm-chat";

  private constructor() {
    // Read log level from environment
    const envLevel = process.env["ZTM_CHAT_LOG_LEVEL"];
    if (envLevel && ["debug", "info", "warn", "error"].includes(envLevel)) {
      this.logLevel = envLevel as LogLevel;
    }
  }

  static getInstance(): ZTMChatLogger {
    if (!ZTMChatLogger.instance) {
      ZTMChatLogger.instance = new ZTMChatLogger();
    }
    return ZTMChatLogger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private formatEntry(entry: LogEntry): string {
    const contextStr = entry.context
      ? ` ${JSON.stringify(entry.context)}`
      : "";
    return `[${entry.timestamp.toISOString()}] [${entry.level.toUpperCase()}] [${entry.channel}] ${entry.message}${contextStr}`;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      channel: this.channel,
      message,
      context,
    };

    const formatted = this.formatEntry(entry);

    switch (level) {
      case "debug":
        console.debug(formatted);
        break;
      case "info":
        console.info(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "error":
        console.error(formatted);
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

  errorWithException(error: unknown, message: string): void {
    const context = {
      exception: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };
    this.log("error", message, context);
  }

  setChannel(channel: string): void {
    this.channel = channel;
  }

  setLevel(level: LogLevel): void {
    if (["debug", "info", "warn", "error"].includes(level)) {
      this.logLevel = level;
    }
  }
}

// Singleton instance
export const logger: Logger = ZTMChatLogger.getInstance();

// Default logger for dependency injection
export const defaultLogger: Logger = logger;

// Context-aware logger factory
export function createLogger(context: Record<string, string>): {
  debug: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
} {
  return {
    debug: (msg) => logger.debug(msg, context),
    info: (msg) => logger.info(msg, context),
    warn: (msg) => logger.warn(msg, context),
    error: (msg) => logger.error(msg, context),
  };
}
