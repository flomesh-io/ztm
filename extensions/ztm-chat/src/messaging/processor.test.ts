// Unit tests for Message Processor

import { describe, it, expect } from "vitest";
import {
  isValidMessage,
  createMessageId,
  parseMessageContent,
} from "./processor.js";

describe("Message Processor", () => {
  describe("isValidMessage", () => {
    it("should return true for valid messages", () => {
      expect(isValidMessage({ time: 123, message: "Hi", sender: "bob" })).toBe(true);
    });

    it("should return false for missing time", () => {
      expect(isValidMessage({ message: "Hi", sender: "bob" })).toBe(false);
    });

    it("should return false for missing message", () => {
      expect(isValidMessage({ time: 123, sender: "bob" })).toBe(false);
    });

    it("should return false for missing sender", () => {
      expect(isValidMessage({ time: 123, message: "Hi" })).toBe(false);
    });

    it("should return false for empty sender", () => {
      // Empty string for sender should fail validation (sender.length > 0)
      expect(isValidMessage({ time: 123, message: "Hi", sender: "" })).toBe(false);
    });

    it("should return false for non-object", () => {
      expect(isValidMessage(null)).toBe(false);
      expect(isValidMessage(undefined)).toBe(false);
      expect(isValidMessage("string")).toBe(false);
      expect(isValidMessage(123)).toBe(false);
    });
  });

  describe("createMessageId", () => {
    it("should create unique ID from timestamp and sender", () => {
      const id1 = createMessageId(123456, "alice");
      const id2 = createMessageId(123456, "bob");

      expect(id1).toBe("123456-alice");
      expect(id2).toBe("123456-bob");
    });

    it("should handle zero timestamp", () => {
      const id = createMessageId(0, "test");
      expect(id).toBe("0-test");
    });

    it("should handle special characters in sender", () => {
      const id = createMessageId(123456, "user@example.com");
      expect(id).toBe("123456-user@example.com");
    });
  });

  describe("parseMessageContent", () => {
    it("should return string as-is", () => {
      expect(parseMessageContent("Hello")).toBe("Hello");
    });

    it("should extract text from object with text field", () => {
      expect(parseMessageContent({ text: "Hello" })).toBe("Hello");
    });

    it("should extract message from object with message field", () => {
      expect(parseMessageContent({ message: "Hello" })).toBe("Hello");
    });

    it("should prefer text field over message field", () => {
      expect(parseMessageContent({ text: "Hello", message: "World" })).toBe("Hello");
    });

    it("should JSON stringify complex objects", () => {
      const obj = { data: { nested: "value" } };
      const result = parseMessageContent(obj);

      expect(result).toBe(JSON.stringify(obj));
    });

    it("should convert null to empty string", () => {
      expect(parseMessageContent(null)).toBe("");
    });

    it("should convert undefined to empty string", () => {
      expect(parseMessageContent(undefined)).toBe("");
    });

    it("should convert numbers to string", () => {
      expect(parseMessageContent(123)).toBe("123");
    });

    it("should handle empty object", () => {
      expect(parseMessageContent({})).toBe("{}");
    });

    it("should handle array", () => {
      expect(parseMessageContent([1, 2, 3])).toBe("[1,2,3]");
    });
  });
});
