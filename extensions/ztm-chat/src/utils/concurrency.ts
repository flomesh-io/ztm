// Concurrency utilities for ZTM Chat
// Provides Semaphore for limiting concurrent operations

/**
 * Semaphore implementation for concurrency control
 * Limits the number of concurrent operations accessing a resource
 */
export class Semaphore {
  private permits: number;
  private waiters: Array<{ resolve: () => void }> = [];

  constructor(permits: number) {
    if (permits <= 0) {
      throw new Error("Semaphore permits must be greater than 0");
    }
    this.permits = permits;
  }

  /**
   * Acquire a permit, waiting if necessary until one is available
   */
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise((resolve) => {
      this.waiters.push({ resolve });
    });
  }

  /**
   * Release a permit, making it available to waiting acquire calls
   */
  release(): void {
    if (this.waiters.length === 0) {
      this.permits++;
      return;
    }
    // If there are waiters, transfer the permit directly
    const waiter = this.waiters.shift();
    waiter?.resolve();
  }

  /**
   * Execute a function with a permit held, automatically releasing after completion
   */
  async execute<T>(fn: () => Promise<T> | T): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Get current number of available permits
   */
  availablePermits(): number {
    return this.permits;
  }

  /**
   * Get number of waiters queued for permits
   */
  queuedWaiters(): number {
    return this.waiters.length;
  }
}

/**
 * Create a semaphore with the specified number of permits
 */
export function createSemaphore(permits: number): Semaphore {
  return new Semaphore(permits);
}
