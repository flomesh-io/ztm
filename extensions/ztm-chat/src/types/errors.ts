// ZTM Chat Error Types
// Specialized error types for ZTM Chat operations with rich context information
// Follows the Result<T, E> error handling pattern

import type { ZTMMessage } from "./api.js";
import type { ZTMPeer, ZTMUserInfo } from "./api.js";
import { success, failure, type Result } from "./common.js";

// ═════════════════════════════════════════════════════════════════════════════
// Base Error Classes - Provide context and cause for failures
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Base error class for all ZTM Chat operations.
 * Provides structured error information including context and cause.
 */
export abstract class ZtmError extends Error {
  constructor(
    public readonly context: Record<string, unknown> = {},
    public readonly cause?: Error
  ) {
    super(cause?.message ?? "Unknown ZTM error");
    this.name = this.constructor.name;

    // Preserve stack trace if available
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get a plain object representation of the error for serialization.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      cause: this.cause?.message,
    };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Message Sending Errors
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Error thrown when sending a peer message fails.
 * Includes message metadata for debugging and retry decisions.
 */
export class ZtmSendError extends ZtmError {
  constructor({
    peer,
    messageTime,
    contentPreview,
    cause,
  }: {
    /** The peer username the message was sent to */
    peer: string;
    /** Timestamp of the message that failed */
    messageTime: number;
    /** Optional preview of message content (for logging) */
    contentPreview?: string;
    /** The underlying error cause */
    cause?: Error;
  }) {
    super(
      {
        peer,
        messageTime,
        contentPreview: contentPreview?.slice(0, 100),
        attemptedAt: new Date().toISOString(),
      },
      cause
    );
    this.message = `Failed to send message to ${peer} at ${messageTime}` +
      (cause ? `: ${cause.message}` : "");
  }
}

/**
 * Error thrown when message file write operation fails.
 * Separated from ZtmSendError to clearly distinguish storage operation failures
 * from message sending failures.
 */
export class ZtmWriteError extends ZtmError {
  constructor({
    peer,
    messageTime,
    filePath,
    cause,
  }: {
    peer: string;
    messageTime: number;
    filePath: string;
    cause?: Error;
  }) {
    super(
      {
        peer,
        messageTime,
        filePath,
        attemptedAt: new Date().toISOString(),
      },
      cause
    );
    this.message = `Failed to write message file for ${peer} at ${messageTime}: ${filePath}` +
      (cause ? `: ${cause.message}` : "");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Message Reading Errors
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Error thrown when reading messages from a peer fails.
 */
export class ZtmReadError extends ZtmError {
  constructor({
    peer,
    operation = "read",
    filePath,
    cause,
  }: {
    /** The peer whose messages were being read */
    peer: string;
    /** The type of read operation */
    operation?: "read" | "list" | "parse";
    /** Optional file path that failed */
    filePath?: string;
    /** The underlying error cause */
    cause?: Error;
  }) {
    super(
      {
        peer,
        operation,
        filePath,
        attemptedAt: new Date().toISOString(),
      },
      cause
    );
    this.message = `Failed to ${operation} messages from ${peer}` +
      (filePath ? ` (file: ${filePath})` : "") +
      (cause ? `: ${cause.message}` : "");
  }
}

/**
 * Error thrown when parsing message file content fails.
 */
export class ZtmParseError extends ZtmError {
  constructor({
    peer,
    filePath,
    parseDetails,
    cause,
  }: {
    peer: string;
    filePath: string;
    parseDetails?: string;
    cause?: Error;
  }) {
    super(
      {
        peer,
        filePath,
        parseDetails,
        attemptedAt: new Date().toISOString(),
      },
      cause
    );
    this.name = "ZtmParseError";
    this.message = `Failed to parse message file from ${peer}: ${filePath}` +
      (parseDetails ? ` (${parseDetails})` : "") +
      (cause ? `: ${cause.message}` : "");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// User/Peer Discovery Errors
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Error thrown when user/peer discovery operation fails.
 */
export class ZtmDiscoveryError extends ZtmError {
  constructor({
    operation = "discoverUsers",
    source,
    cause,
  }: {
    /** The type of discovery operation */
    operation?: "discoverUsers" | "discoverPeers" | "scanStorage";
    /** The source of the discovery attempt */
    source?: string;
    /** The underlying error cause */
    cause?: Error;
  }) {
    super(
      {
        operation,
        source,
        attemptedAt: new Date().toISOString(),
      },
      cause
    );
    this.message = `Failed to ${operation}` +
      (source ? ` from ${source}` : "") +
      (cause ? `: ${cause.message}` : "");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// API Communication Errors
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Error thrown when ZTM Agent API communication fails.
 */
export class ZtmApiError extends ZtmError {
  constructor({
    method,
    path,
    statusCode,
    statusText,
    responseBody,
    cause,
  }: {
    /** HTTP method that was attempted */
    method: string;
    /** API path that was requested */
    path: string;
    /** HTTP status code if available */
    statusCode?: number;
    /** HTTP status text if available */
    statusText?: string;
    /** Response body if available */
    responseBody?: string;
    /** The underlying error cause */
    cause?: Error;
  }) {
    super(
      {
        method,
        path,
        statusCode,
        statusText,
        responseBodyPreview: responseBody?.slice(0, 500),
        attemptedAt: new Date().toISOString(),
      },
      cause
    );
    this.name = "ZtmApiError";
    this.message = `ZTM API error: ${method} ${path}` +
      (statusCode ? ` - ${statusCode} ${statusText}` : "") +
      (cause ? `: ${cause.message}` : "");
  }
}

/**
 * Error thrown when API request times out.
 */
export class ZtmTimeoutError extends ZtmError {
  constructor({
    method,
    path,
    timeoutMs,
    cause,
  }: {
    method: string;
    path: string;
    timeoutMs: number;
    cause?: Error;
  }) {
    super({ method, path, timeoutMs, attemptedAt: new Date().toISOString() }, cause);
    this.name = "ZtmTimeoutError";
    this.message = `ZTM API timeout: ${method} ${path} exceeded ${timeoutMs}ms` +
      (cause ? `: ${cause.message}` : "");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Runtime/Configuration Errors
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Error thrown when runtime is not properly initialized.
 */
export class ZtmRuntimeError extends ZtmError {
  constructor({
    operation,
    reason,
  }: {
    operation: string;
    reason: string;
  }) {
    super({ operation, reason });
    this.name = "ZtmRuntimeError";
    this.message = `Runtime not initialized for ${operation}: ${reason}`;
  }
}

/**
 * Error thrown when configuration is invalid.
 */
export class ZtmConfigError extends ZtmError {
  constructor({
    field,
    value,
    reason,
  }: {
    field: string;
    value?: unknown;
    reason: string;
  }) {
    super({ field, value, reason });
    this.name = "ZtmConfigError";
    this.message = `Invalid ZTM configuration for ${field}: ${reason}` +
      (value !== undefined ? ` (got: ${String(value)})` : "");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Error Helper Functions - Convenient creation of failed Results
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Create a failed Result from an Error.
 * Useful for converting caught exceptions to Result types.
 */
export function toFailure<T, E extends Error>(error: E): Result<T, E> {
  return failure<T, E>(error);
}

/**
 * Safely execute a function that might throw, returning a Result.
 */
export function tryCatch<T, E extends Error = Error>(
  fn: () => T,
  errorConstructor?: new (message: string, cause?: Error) => E
): Result<T, E> {
  try {
    return success(fn()) as Result<T, E>;
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error));
    if (errorConstructor) {
      return failure(new errorConstructor(cause.message, cause));
    }
    return failure(cause as E);
  }
}

/**
 * Safely execute an async function that might throw, returning an AsyncResult.
 */
export async function tryCatchAsync<T, E extends Error = Error>(
  fn: () => Promise<T>,
  errorConstructor?: new (message: string, cause?: Error) => E
): Promise<Result<T, E>> {
  try {
    return success(await fn()) as Result<T, E>;
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error));
    if (errorConstructor) {
      return failure(new errorConstructor(cause.message, cause));
    }
    return failure(cause as E);
  }
}
