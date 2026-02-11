// ZTM Chat Common Types
// Shared utility types used across modules

// Result type for operations that can fail
export interface Result<T, E = Error> {
  ok: boolean;
  data?: T;
  error?: E;
}

// Helper to create successful result
export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

// Helper to create error result
export function err<E = Error>(error: E): Result<never, E> {
  return { ok: false, error };
}

// Async result type
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

// Connection status
export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

// Message direction
export type MessageDirection = "inbound" | "outbound";

// Pairing status
export type PairingStatus = "none" | "pending" | "approved" | "rejected";
