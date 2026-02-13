// File operations API for ZTM Chat

import type { ZTMChatConfig } from "../types/config.js";
import { success, type Result } from "../types/common.js";
import {
  ZtmError,
  ZtmReadError,
} from "../types/errors.js";
import type { ZtmLogger, RequestHandler, ApiResult } from "./request.js";

// Maximum number of tracked files to prevent memory leaks
const MAX_TRACKED_FILES = 500;

/**
 * Create file operations API
 */
export function createFileApi(
  config: ZTMChatConfig,
  request: RequestHandler,
  logger: ZtmLogger
) {
  // Track both time and size for each file to detect changes in append-only files
  interface FileMetadata {
    time: number;
    size: number;
  }
  const lastSeenFiles = new Map<string, FileMetadata>();

  // Clean up oldest entries when reaching the limit to prevent memory leaks
  function trimFileMetadata(): void {
    while (lastSeenFiles.size > MAX_TRACKED_FILES) {
      const firstKey = lastSeenFiles.keys().next().value;
      if (firstKey) {
        lastSeenFiles.delete(firstKey);
      } else {
        break;
      }
    }
  }

  // Type guard for file metadata from API response
  function isFileMeta(obj: unknown): obj is { time?: number; size?: number } {
    return typeof obj === "object" && obj !== null;
  }

  return {
    /**
     * Seed file metadata from external source
     */
    seedFileMetadata(metadata: Record<string, { time: number; size: number }>): void {
      for (const [filePath, meta] of Object.entries(metadata)) {
        const current = lastSeenFiles.get(filePath);
        if (!current || meta.time > current.time || meta.size > current.size) {
          lastSeenFiles.set(filePath, meta);
        }
      }
      trimFileMetadata();
    },

    /**
     * Export file metadata for external use
     */
    exportFileMetadata(): Record<string, { time: number; size: number }> {
      const result: Record<string, { time: number; size: number }> = {};
      for (const [filePath, metadata] of lastSeenFiles) {
        result[filePath] = metadata;
      }
      return result;
    },
  };
}
