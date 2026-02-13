// Unit tests for Semaphore concurrency control

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Semaphore, createSemaphore } from "./concurrency.js";

describe("Semaphore", () => {
  describe("constructor", () => {
    it("should create semaphore with specified permits", () => {
      const semaphore = new Semaphore(5);

      expect(semaphore.availablePermits()).toBe(5);
      expect(semaphore.queuedWaiters()).toBe(0);
    });

    it("should throw error for zero permits", () => {
      expect(() => new Semaphore(0)).toThrow();
    });

    it("should throw error for negative permits", () => {
      expect(() => new Semaphore(-1)).toThrow();
    });
  });

  describe("acquire", () => {
    it("should acquire permit when available", async () => {
      const semaphore = new Semaphore(2);

      await semaphore.acquire();

      expect(semaphore.availablePermits()).toBe(1);
    });

    it("should queue when no permits available", async () => {
      const semaphore = new Semaphore(1);
      let acquire2Complete = false;

      // First acquire
      await semaphore.acquire();

      // Second acquire (should queue)
      semaphore.acquire().then(() => {
        acquire2Complete = true;
      });

      // Check that second acquire hasn't completed yet
      expect(acquire2Complete).toBe(false);
      expect(semaphore.queuedWaiters()).toBe(1);

      // Release first permit
      semaphore.release();

      // Wait a bit for queued acquire to process
      await new Promise(resolve => setTimeout(resolve, 10));

      // Now second acquire should complete
      expect(acquire2Complete).toBe(true);
    });

    it("should handle multiple queued waiters in FIFO order", async () => {
      const semaphore = new Semaphore(1);
      const results: number[] = [];

      // Acquire the only permit
      await semaphore.acquire();

      // Queue multiple acquires - they should complete in FIFO order
      const p1 = semaphore.acquire().then(() => results.push(1));
      const p2 = semaphore.acquire().then(() => results.push(2));
      const p3 = semaphore.acquire().then(() => results.push(3));

      // Release all permits one by one
      semaphore.release();
      await new Promise(resolve => setTimeout(resolve, 10));
      semaphore.release();
      await new Promise(resolve => setTimeout(resolve, 10));
      semaphore.release();

      // Wait for all acquires to complete
      await Promise.all([p1, p2, p3]);

      expect(results).toEqual([1, 2, 3]);
    });

    it("should acquire multiple times on same semaphore", async () => {
      const semaphore = new Semaphore(3);

      await semaphore.acquire();
      await semaphore.acquire();
      await semaphore.acquire();

      expect(semaphore.availablePermits()).toBe(0);
    });
  });

  describe("release", () => {
    it("should increase available permits", async () => {
      const semaphore = new Semaphore(1);

      await semaphore.acquire();
      expect(semaphore.availablePermits()).toBe(0);

      semaphore.release();
      expect(semaphore.availablePermits()).toBe(1);
    });

    it("should transfer permit to queued waiter when available", async () => {
      const semaphore = new Semaphore(1);

      // First acquire uses the only permit
      await semaphore.acquire();
      expect(semaphore.availablePermits()).toBe(0);

      let permitTransferred = false;
      // This should queue since no permits available
      semaphore.acquire().then(() => {
        permitTransferred = true;
      });

      // Wait for acquire to queue
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(semaphore.queuedWaiters()).toBe(1);

      // Release should transfer directly to waiter
      semaphore.release();

      // Wait for the queued acquire to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(permitTransferred).toBe(true);
    });

    it("should increase permits when no waiters", async () => {
      const semaphore = new Semaphore(1);

      await semaphore.acquire();
      expect(semaphore.availablePermits()).toBe(0);

      semaphore.release();
      expect(semaphore.availablePermits()).toBe(1);

      semaphore.release();
      expect(semaphore.availablePermits()).toBe(2);
    });

    it("should release multiple times consecutively", async () => {
      const semaphore = new Semaphore(2);

      await semaphore.acquire();
      await semaphore.acquire();
      expect(semaphore.availablePermits()).toBe(0);

      semaphore.release();
      semaphore.release();
      expect(semaphore.availablePermits()).toBe(2);
    });
  });

  describe("execute", () => {
    it("should execute function with permit held", async () => {
      const semaphore = new Semaphore(1);
      let executed = false;

      await semaphore.execute(async () => {
        expect(semaphore.availablePermits()).toBe(0);
        executed = true;
        return "result";
      });

      expect(executed).toBe(true);
      expect(semaphore.availablePermits()).toBe(1);
    });

    it("should release permit even if function throws", async () => {
      const semaphore = new Semaphore(1);

      await expect(semaphore.execute(() => {
        throw new Error("Test error");
      })).rejects.toThrow("Test error");

      expect(semaphore.availablePermits()).toBe(1);
    });

    it("should wait for permit before executing", async () => {
      const semaphore = new Semaphore(1);
      let executeOrder: string[] = [];

      // First acquire
      const firstAcquire = semaphore.acquire().then(() => {
        executeOrder.push("acquire");
      });

      // Queue execution (should wait for permit)
      const execPromise = semaphore.execute(async () => {
        executeOrder.push("exec");
        return "done";
      });

      executeOrder.push("queue");

      // Release after delay
      setTimeout(() => {
        semaphore.release();
        executeOrder.push("release");
      }, 10);

      await execPromise;
      await firstAcquire;

      // The acquire should complete first, then release, then exec
      expect(executeOrder).toContain("acquire");
      expect(executeOrder).toContain("release");
      expect(executeOrder).toContain("exec");
    });

    it("should support synchronous functions", async () => {
      const semaphore = new Semaphore(1);

      const result = await semaphore.execute(() => {
        return "sync result";
      });

      expect(result).toBe("sync result");
    });

    it("should return result from async function", async () => {
      const semaphore = new Semaphore(1);

      const result = await semaphore.execute(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return "async result";
      });

      expect(result).toBe("async result");
    });
  });

  describe("availablePermits", () => {
    it("should return current available permit count", async () => {
      const semaphore = new Semaphore(5);

      expect(semaphore.availablePermits()).toBe(5);

      // Acquire 2 permits
      await semaphore.acquire();
      await semaphore.acquire();

      expect(semaphore.availablePermits()).toBe(3);
    });

    it("should return correct count after releases", async () => {
      const semaphore = new Semaphore(2);

      await semaphore.acquire();
      expect(semaphore.availablePermits()).toBe(1);

      semaphore.release();
      expect(semaphore.availablePermits()).toBe(2);

      semaphore.release();
      expect(semaphore.availablePermits()).toBe(3);
    });
  });

  describe("queuedWaiters", () => {
    it("should return current queued waiter count", async () => {
      const semaphore = new Semaphore(1);

      expect(semaphore.queuedWaiters()).toBe(0);

      await semaphore.acquire();

      // Queue some waiters
      semaphore.acquire().catch(() => {});
      semaphore.acquire().catch(() => {});

      expect(semaphore.queuedWaiters()).toBe(2);
    });

    it("should return 0 when no waiters", async () => {
      const semaphore = new Semaphore(5);

      expect(semaphore.queuedWaiters()).toBe(0);

      await semaphore.acquire();

      expect(semaphore.queuedWaiters()).toBe(0);
    });
  });
});

describe("createSemaphore", () => {
  it("should create a semaphore instance", () => {
    const semaphore = createSemaphore(3);

    expect(semaphore).toBeInstanceOf(Semaphore);
    expect(semaphore.availablePermits()).toBe(3);
  });

  it("should create semaphore with custom permits", () => {
    const semaphore = createSemaphore(10);
    expect(semaphore.availablePermits()).toBe(10);
  });
});
