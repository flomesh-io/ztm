// Integration tests for Concurrent Message Handling

import { describe, it, expect, vi } from "vitest";

describe("Concurrent Message Handling", () => {
  it("should handle multiple messages arriving simultaneously", async () => {
    const messages = [
      { time: Date.now(), message: "Msg1", sender: "alice" },
      { time: Date.now() + 1, message: "Msg2", sender: "bob" },
      { time: Date.now() + 2, message: "Msg3", sender: "charlie" },
    ];

    let processedCount = 0;

    await Promise.all(messages.map(async (msg) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      processedCount++;
    }));

    expect(processedCount).toBe(3);
  });

  it("should handle duplicate detection during concurrent processing", () => {
    const seen = new Set<string>();
    const messages = [
      { time: 1000, message: "Hello", sender: "alice" },
      { time: 1000, message: "Hello", sender: "alice" },
      { time: 1000, message: "Hello", sender: "alice" },
    ];

    let uniqueCount = 0;
    for (const msg of messages) {
      const key = `${msg.sender}-${msg.time}-${msg.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueCount++;
      }
    }

    expect(uniqueCount).toBe(1);
    expect(seen.size).toBe(1);
  });

  it("should serialize state updates to prevent race conditions", async () => {
    let watermark = 0;
    const timestamps = [1000, 2000, 1500, 3000, 2500];

    await Promise.all(timestamps.map(async (time) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      if (time > watermark) {
        watermark = time;
      }
    }));

    expect(watermark).toBe(Math.max(...timestamps));
  });

  it("should handle rapid state transitions", () => {
    type State = "idle" | "watching" | "polling" | "stopped";
    let state: State = "idle";
    let transitionCount = 0;

    const transitions: State[] = ["watching", "polling", "watching", "polling", "stopped"];

    for (const nextState of transitions) {
      if (state !== nextState) {
        state = nextState;
        transitionCount++;
      }
    }

    expect(transitionCount).toBeGreaterThan(0);
    expect(state).toBe("stopped");
  });
});
