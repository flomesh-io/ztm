// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Result Handling - Unified error handling for Result types
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

import type { Result } from "../types/common.js";
import { success, failure } from "../types/common.js";

/**
 * Result handling options
 */
interface HandleResultOptions<T, E extends Error> {
  /** Operation name for logging */
  operation: string;
  /** Account/peer context for logging */
  peer?: string;
  /** Logger instance (optional, logs only if provided) */
  logger?: {
    debug?: (message: string) => void;
    info?: (message: string) => void;
    warn?: (message: string) => void;
    error?: (message: string) => void;
  };
  /** Log level for error case (default: debug) */
  logLevel?: "debug" | "info" | "warn" | "error";
  /** Callback on error */
  onError?: (error: E) => void;
  /** Callback on success */
  onSuccess?: (value: T) => void;
  /** Default value to return on failure (returns null if not specified) */
  defaultValue?: T | null;
}

/**
 * Handle a Result value with unified logging and callbacks.
 * Reduces repetitive `if (!isSuccess(result)) { logger.error(...) }` patterns.
 *
 * @param result - The Result to handle
 * @param options - Configuration for logging and callbacks
 * @returns The value on success, or defaultValue/null on failure
 *
 * @example
 * ```typescript
 * // Basic usage with logging
 * const chats = handleResult(await api.getChats(), {
 *   operation: 'getChats',
 *   peer: accountId,
 *   logger
 * });
 *
 * // With callbacks and default value
 * const value = handleResult(result, {
 *   operation: 'process',
 *   logger,
 *   onSuccess: (v) => metrics.increment('success'),
 *   onError: (e) => metrics.increment('error'),
 *   defaultValue: []
 * });
 * ```
 */
export function handleResult<T, E extends Error = Error>(
  result: Result<T, E>,
  options: HandleResultOptions<T, E>
): T | null {
  if (result.ok && result.value !== undefined) {
    options.onSuccess?.(result.value);
    return result.value;
  }

  const error = (result.error ?? new Error("Result was None")) as E;
  const context = options.peer ? `[${options.peer}] ` : "";
  const message = `${context}${options.operation} failed: ${error.message}`;

  const logLevel = options.logLevel ?? "debug";
  options.logger?.[logLevel]?.(message);
  options.onError?.(error);

  return options.defaultValue ?? null;
}

/**
 * Handle a Result that should succeed or throw.
 * Use this when failure should halt execution.
 *
 * @param result - The Result to handle
 * @param options - Configuration for logging and error message
 * @returns The value on success
 * @throws Error on failure with descriptive message
 *
 * @example
 * ```typescript
 * const meshInfo = mustResult(await api.getMeshInfo(), {
 *   operation: 'getMeshInfo',
 *   peer: accountId,
 *   logger
 * });
 * // meshInfo is guaranteed to be defined here
 * ```
 */
export function mustResult<T, E extends Error = Error>(
  result: Result<T, E>,
  options: {
    operation: string;
    peer?: string;
    logger?: { error?: (message: string) => void };
  }
): T {
  if (result.ok && result.value !== undefined) {
    return result.value;
  }

  const error = result.error ?? new Error("Result was None");
  const context = options.peer ? `[${options.peer}] ` : "";
  const message = `${context}${options.operation} failed: ${error.message}`;

  options.logger?.error?.(message);
  throw error;
}

/**
 * Pipe a Result through a series of synchronous transformations.
 * Short-circuits on failure.
 *
 * @param result - Initial Result
 * @param fns - Functions to apply in sequence
 * @returns Final Result after transformations
 */
export function pipeResult<T, E extends Error = Error>(
  result: Result<T, E>,
  fn: (value: T) => Result<T, E>
): Result<T, E> {
  if (!result.ok || result.value === undefined) {
    return failure(result.error! as E);
  }
  return fn(result.value);
}
