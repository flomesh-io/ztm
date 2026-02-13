// ZTM Chat Common Types
// Shared utility types used across modules

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Result Type Pattern - Unified error handling for operations that can fail
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Result type for operations that can succeed or fail.
 * This pattern avoids silent failures, null ambiguity, and unchecked exceptions.
 *
 * @example
 * ```typescript
 * // Success case
 * const success: Result<string> = { ok: true, value: "hello" };
 *
 * // Failure case
 * const failure: Result<string> = { ok: false, error: new Error("failed") };
 * ```
 */
export interface Result<T, E = Error> {
  /** Whether the operation succeeded */
  readonly ok: boolean;
  /** The successful result value (only present when ok is true) */
  readonly value?: T;
  /** The error information (only present when ok is false) */
  readonly error?: E;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Factory Functions - Create Result instances with clear intent
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Create a successful Result with a value */
export function success<T, E extends Error = never>(value: T): Result<T, E> {
  return { ok: true, value } as Result<T, E>;
}

/** Create a failed Result with an error */
export function failure<T = never, E extends Error = Error>(error: E): Result<T, E> {
  return { ok: false, error } as Result<T, E>;
}

/** Alias for backward compatibility */
export const ok = success;
export const err = failure;

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Type Guards - Type-safe way to check Result state at runtime
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Type guard: returns true if the Result is successful */
export function isSuccess<T, E extends Error>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok === true;
}

/** Type guard: returns true if the Result is a failure */
export function isFailure<T, E extends Error>(result: Result<T, E>): result is { ok: false; error: E } {
  return result.ok === false;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Unwrap Methods - Extract value from Result with optional error handling
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Unwrap the Result, returning the value or throwing if failed.
 * Use this when you want to propagate errors as exceptions.
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok && result.value !== undefined) {
    return result.value;
  }
  throw result.error ?? new Error("Result was None");
}

/**
 * Unwrap the Result, returning the value or a default.
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (result.ok && result.value !== undefined) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Unwrap the Result, returning the value or undefined.
 */
export function maybe<T, E>(result: Result<T, E>): T | undefined {
  return result.value;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Mapping Methods - Transform Result values while preserving error state
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Map the success value to a new type.
 * If the Result is a failure, it propagates the error unchanged.
 */
export function map<T, U, E extends Error>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (result.ok && result.value !== undefined) {
    return success(fn(result.value)) as Result<U, E>;
  }
  return failure(result.error!);
}

/**
 * Map the error to a new error type.
 * If the Result is successful, it returns unchanged.
 */
export function mapErr<T, E extends Error, F extends Error>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (result.ok) {
    return { ok: true, value: result.value } as Result<T, F>;
  }
  return failure(fn(result.error!));
}

/**
 * FlatMap (bind): transform and flatten nested Results.
 * Use when the mapping function itself can fail.
 */
export function flatMap<T, U, E extends Error>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (result.ok && result.value !== undefined) {
    return fn(result.value);
  }
  return failure(result.error!);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Async Result - Promise-based variant for async operations
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Async Result type alias for convenience */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Other Common Types
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Connection status for ZTM agents */
export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

/** Message direction (inbound received, outbound sent) */
export type MessageDirection = "inbound" | "outbound";

/** Pairing status for peer authentication */
export type PairingStatus = "none" | "pending" | "approved" | "rejected";
