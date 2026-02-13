import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createPairingStateStore,
  PairingStateStoreImpl,
  PairingStateData,
  FileSystem,
} from "./pairing-store.js";

const createMockFs = (initialFiles: Map<string, string> = new Map()): FileSystem => {
  const files = new Map(initialFiles);
  return {
    existsSync: vi.fn((path: string) => files.has(path)),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn((path: string) => {
      if (!files.has(path)) throw new Error(`File not found: ${path}`);
      return files.get(path)!;
    }),
    writeFileSync: vi.fn((path: string, data: string) => {
      files.set(path, data);
    }),
  };
};

describe("PairingStateStore", () => {
  let mockFs: FileSystem;
  let mockLogger: { debug: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockFs = createMockFs();
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    };
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createPairingStateStore", () => {
    it("should create a store instance", () => {
      const store = createPairingStateStore("/tmp/test-pairings.json", mockFs, mockLogger as unknown as import("../utils/logger.js").Logger);
      expect(store).toBeDefined();
      expect(typeof store.loadPendingPairings).toBe("function");
      expect(typeof store.savePendingPairing).toBe("function");
      expect(typeof store.deletePendingPairing).toBe("function");
      expect(typeof store.cleanupExpiredPairings).toBe("function");
    });
  });

  describe("loadPendingPairings", () => {
    it("should return empty map when no data exists", () => {
      const store = createPairingStateStore("/tmp/test-pairings.json", mockFs, mockLogger as unknown as import("../utils/logger.js").Logger);
      const pairings = store.loadPendingPairings("account1");
      expect(pairings.size).toBe(0);
    });

    it("should load persisted pairings", () => {
      const initialData: PairingStateData = {
        accounts: {
          account1: {
            alice: "2026-02-12T10:00:00.000Z",
            bob: "2026-02-12T09:00:00.000Z",
          },
        },
      };
      mockFs = createMockFs(new Map([["/tmp/test-pairings.json", JSON.stringify(initialData)]]));
      const store = createPairingStateStore("/tmp/test-pairings.json", mockFs, mockLogger as unknown as import("../utils/logger.js").Logger);

      const pairings = store.loadPendingPairings("account1");
      expect(pairings.size).toBe(2);
      expect(pairings.has("alice")).toBe(true);
      expect(pairings.has("bob")).toBe(true);
    });

    it("should return empty map for non-existent account", () => {
      const initialData: PairingStateData = {
        accounts: {
          account1: {
            alice: "2026-02-12T10:00:00.000Z",
          },
        },
      };
      mockFs = createMockFs(new Map([["/tmp/test-pairings.json", JSON.stringify(initialData)]]));
      const store = createPairingStateStore("/tmp/test-pairings.json", mockFs, mockLogger as unknown as import("../utils/logger.js").Logger);

      const pairings = store.loadPendingPairings("account2");
      expect(pairings.size).toBe(0);
    });
  });

  describe("savePendingPairing", () => {
    it("should save a new pairing", async () => {
      const store = createPairingStateStore("/tmp/test-pairings.json", mockFs, mockLogger as unknown as import("../utils/logger.js").Logger);
      const date = new Date("2026-02-12T10:00:00.000Z");

      store.savePendingPairing("account1", "alice", date);
      store.flush();

      const writeCalls = (mockFs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls;
      expect(writeCalls.length).toBeGreaterThan(0);
      const savedData = JSON.parse(writeCalls[writeCalls.length - 1][1]);
      expect(savedData.accounts.account1.alice).toBe(date.toISOString());
    });

    it("should use current date if not provided", () => {
      const store = createPairingStateStore("/tmp/test-pairings.json", mockFs, mockLogger as unknown as import("../utils/logger.js").Logger);
      const now = new Date();

      store.savePendingPairing("account1", "alice");

      const pairings = store.loadPendingPairings("account1");
      expect(pairings.has("alice")).toBe(true);
      const savedDate = pairings.get("alice")!;
      expect(savedDate.getTime()).toBeGreaterThanOrEqual(now.getTime() - 1000);
    });

    it("should debounce writes", async () => {
      const store = createPairingStateStore("/tmp/test-pairings.json", mockFs, mockLogger as unknown as import("../utils/logger.js").Logger);

      store.savePendingPairing("account1", "alice");
      store.savePendingPairing("account1", "bob");
      store.savePendingPairing("account1", "charlie");

      expect(mockFs.writeFileSync).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1100);

      const writeCalls = (mockFs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls;
      expect(writeCalls.length).toBe(1);
      const savedData = JSON.parse(writeCalls[0][1]);
      expect(Object.keys(savedData.accounts.account1)).toHaveLength(3);
    });
  });

  describe("deletePendingPairing", () => {
    it("should delete an existing pairing", () => {
      const initialData: PairingStateData = {
        accounts: {
          account1: {
            alice: "2026-02-12T10:00:00.000Z",
            bob: "2026-02-12T09:00:00.000Z",
          },
        },
      };
      mockFs = createMockFs(new Map([["/tmp/test-pairings.json", JSON.stringify(initialData)]]));
      const store = createPairingStateStore("/tmp/test-pairings.json", mockFs, mockLogger as unknown as import("../utils/logger.js").Logger);

      store.deletePendingPairing("account1", "alice");
      store.flush();

      const pairings = store.loadPendingPairings("account1");
      expect(pairings.has("alice")).toBe(false);
      expect(pairings.has("bob")).toBe(true);
    });

    it("should handle deleting non-existent pairing gracefully", () => {
      const store = createPairingStateStore("/tmp/test-pairings.json", mockFs, mockLogger as unknown as import("../utils/logger.js").Logger);
      expect(() => store.deletePendingPairing("account1", "nonexistent")).not.toThrow();
    });
  });

  describe("cleanupExpiredPairings", () => {
    it("should remove expired pairings", () => {
      const now = Date.now();
      const initialData: PairingStateData = {
        accounts: {
          account1: {
            alice: new Date(now - 1000).toISOString(),
            bob: new Date(now - 50000).toISOString(),
            charlie: new Date(now - 100000).toISOString(),
          },
        },
      };
      mockFs = createMockFs(new Map([["/tmp/test-pairings.json", JSON.stringify(initialData)]]));
      const store = createPairingStateStore("/tmp/test-pairings.json", mockFs, mockLogger as unknown as import("../utils/logger.js").Logger);

      const cleanedCount = store.cleanupExpiredPairings("account1", 30000);
      store.flush();

      expect(cleanedCount).toBe(2);
      const pairings = store.loadPendingPairings("account1");
      expect(pairings.has("alice")).toBe(true);
      expect(pairings.has("bob")).toBe(false);
      expect(pairings.has("charlie")).toBe(false);
    });

    it("should use 1 hour as default expiration", () => {
      const now = Date.now();
      const initialData: PairingStateData = {
        accounts: {
          account1: {
            alice: new Date(now - 59 * 60 * 1000).toISOString(),
            bob: new Date(now - 61 * 60 * 1000).toISOString(),
          },
        },
      };
      mockFs = createMockFs(new Map([["/tmp/test-pairings.json", JSON.stringify(initialData)]]));
      const store = createPairingStateStore("/tmp/test-pairings.json", mockFs, mockLogger as unknown as import("../utils/logger.js").Logger);

      const cleanedCount = store.cleanupExpiredPairings("account1");

      expect(cleanedCount).toBe(1);
      const pairings = store.loadPendingPairings("account1");
      expect(pairings.has("alice")).toBe(true);
      expect(pairings.has("bob")).toBe(false);
    });

    it("should return 0 when no expired pairings", () => {
      const now = Date.now();
      const initialData: PairingStateData = {
        accounts: {
          account1: {
            alice: new Date(now - 1000).toISOString(),
          },
        },
      };
      mockFs = createMockFs(new Map([["/tmp/test-pairings.json", JSON.stringify(initialData)]]));
      const store = createPairingStateStore("/tmp/test-pairings.json", mockFs, mockLogger as unknown as import("../utils/logger.js").Logger);

      const cleanedCount = store.cleanupExpiredPairings("account1", 10000);

      expect(cleanedCount).toBe(0);
    });

    it("should return 0 for non-existent account", () => {
      const store = createPairingStateStore("/tmp/test-pairings.json", mockFs, mockLogger as unknown as import("../utils/logger.js").Logger);
      const cleanedCount = store.cleanupExpiredPairings("nonexistent");
      expect(cleanedCount).toBe(0);
    });
  });

  describe("flush and dispose", () => {
    it("should flush pending writes immediately", async () => {
      const store = createPairingStateStore("/tmp/test-pairings.json", mockFs, mockLogger as unknown as import("../utils/logger.js").Logger);

      store.savePendingPairing("account1", "alice");
      expect(mockFs.writeFileSync).not.toHaveBeenCalled();

      store.flush();

      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it("should flush on dispose", async () => {
      const store = createPairingStateStore("/tmp/test-pairings.json", mockFs, mockLogger as unknown as import("../utils/logger.js").Logger);

      store.savePendingPairing("account1", "alice");
      store.dispose();

      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle read errors gracefully", () => {
      const failingFs: FileSystem = {
        existsSync: vi.fn(() => true),
        mkdirSync: vi.fn(),
        readFileSync: vi.fn(() => {
          throw new Error("Read error");
        }),
        writeFileSync: vi.fn(),
      };

      const store = createPairingStateStore("/tmp/test-pairings.json", failingFs, mockLogger as unknown as import("../utils/logger.js").Logger);
      const pairings = store.loadPendingPairings("account1");
      expect(pairings.size).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith("Failed to load pairing state, starting fresh");
    });

    it("should handle write errors gracefully", () => {
      const failingFs: FileSystem = {
        existsSync: vi.fn(() => true),
        mkdirSync: vi.fn(),
        readFileSync: vi.fn(() => "{}"),
        writeFileSync: vi.fn(() => {
          throw new Error("Write error");
        }),
      };

      const store = createPairingStateStore("/tmp/test-pairings.json", failingFs, mockLogger as unknown as import("../utils/logger.js").Logger);
      store.savePendingPairing("account1", "alice");
      store.flush();

      expect(mockLogger.warn).toHaveBeenCalledWith("Failed to persist pairing state");
    });
  });

  describe("pairing limit enforcement", () => {
    it("should keep most recent pairings when limit exceeded", () => {
      const store = createPairingStateStore("/tmp/test-pairings.json", mockFs, mockLogger as unknown as import("../utils/logger.js").Logger);
      const now = Date.now();

      for (let i = 0; i < 1002; i++) {
        store.savePendingPairing("account1", `user${i}`, new Date(now - i * 1000));
      }
      store.flush();

      const writeCalls = (mockFs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls;
      const savedData = JSON.parse(writeCalls[writeCalls.length - 1][1]);
      const accountPairings = savedData.accounts.account1;
      expect(Object.keys(accountPairings)).toHaveLength(1000);
    });
  });
});
