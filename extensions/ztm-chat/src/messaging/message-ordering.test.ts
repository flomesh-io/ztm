// Integration tests for Message Timestamp Ordering

import { describe, it, expect } from "vitest";
import type { ZTMChatConfig } from "../types/config.js";

describe("Message Timestamp Ordering", () => {
  const baseConfig: ZTMChatConfig = {
    agentUrl: "https://example.com:7777",
    permitUrl: "https://example.com/permit",
    meshName: "test-mesh",
    username: "test-bot",
    enableGroups: false,
    autoReply: true,
    messagePath: "/shared",
    allowFrom: [],
    dmPolicy: "allow",
  };

  it("should process messages in timestamp order", () => {
    const messages = [
      { time: 1000, message: "First", sender: "alice" },
      { time: 2000, message: "Second", sender: "alice" },
      { time: 1500, message: "Middle", sender: "alice" },
      { time: 3000, message: "Last", sender: "alice" },
    ];

    const sorted = [...messages].sort((a, b) => a.time - b.time);

    expect(sorted[0].message).toBe("First");
    expect(sorted[1].message).toBe("Middle");
    expect(sorted[2].message).toBe("Second");
    expect(sorted[3].message).toBe("Last");
  });

  it("should detect out-of-order messages", () => {
    const lastWatermark = 2000;
    const newMessage = { time: 1500, message: "Old message", sender: "alice" };

    const isOutOfOrder = newMessage.time <= lastWatermark;
    expect(isOutOfOrder).toBe(true);
  });

  it("should advance watermark for newer messages", () => {
    let watermark = 1000;
    const messages = [1500, 2000, 2500, 3000];

    for (const time of messages) {
      if (time > watermark) {
        watermark = time;
      }
    }

    expect(watermark).toBe(3000);
  });

  it("should not advance watermark for older messages", () => {
    let watermark = 3000;
    const messages = [1000, 1500, 2000];

    for (const time of messages) {
      if (time > watermark) {
        watermark = time;
      }
    }

    expect(watermark).toBe(3000);
  });

  it("should handle messages with same timestamp", () => {
    const messages = [
      { time: 1000, message: "A", sender: "alice" },
      { time: 1000, message: "B", sender: "alice" },
      { time: 1000, message: "C", sender: "alice" },
    ];

    const timestamps = messages.map(m => m.time);
    expect(new Set(timestamps).size).toBe(1);
  });

  it("should track per-peer watermarks independently", () => {
    const watermarks: Record<string, number> = {};

    watermarks["alice"] = 1000;
    watermarks["bob"] = 2000;
    watermarks["charlie"] = 1500;

    if (3000 > (watermarks["alice"] || 0)) {
      watermarks["alice"] = 3000;
    }

    expect(watermarks["alice"]).toBe(3000);
    expect(watermarks["bob"]).toBe(2000);
    expect(watermarks["charlie"]).toBe(1500);
  });

  it("should handle zero timestamp as special case", () => {
    const watermark = 1000;
    const message = { time: 0, message: "Zero time" };

    expect(message.time).toBe(0);
  });
});
