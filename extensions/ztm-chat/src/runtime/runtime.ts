// ZTM Runtime - Manages ZTM network connection and message handling
// Refactored to use Dependency Injection + Singleton pattern for testability

import type { PluginRuntime } from "openclaw/plugin-sdk";

// ============================================================================
// RUNTIME PROVIDER INTERFACE
// ============================================================================

/**
 * Interface for runtime provider - enables dependency injection
 */
export interface RuntimeProvider {
  /**
   * Get the current runtime instance
   * @throws Error if runtime not initialized
   */
  getRuntime(): PluginRuntime;

  /**
   * Set a new runtime instance
   * @param runtime The runtime to use
   */
  setRuntime(runtime: PluginRuntime): void;

  /**
   * Check if runtime is initialized
   */
  isInitialized(): boolean;
}

// ============================================================================
// RUNTIME MANAGER (Singleton)
// ============================================================================

/**
 * Singleton manager for ZTM runtime
 * Provides testable runtime management with dependency injection capability
 */
class RuntimeManager implements RuntimeProvider {
  private static instance: RuntimeManager | null = null;
  private runtime: PluginRuntime | null = null;

  /**
   * Get the singleton instance
   * Creates instance on first call, returns existing instance thereafter
   */
  static getInstance(): RuntimeManager {
    if (!RuntimeManager.instance) {
      RuntimeManager.instance = new RuntimeManager();
    }
    return RuntimeManager.instance;
  }

  /**
   * Reset the singleton instance (for testing purposes)
   * Call this in test beforeEach to clean state between tests
   */
  static reset(): void {
    RuntimeManager.instance = null;
  }

  /**
   * Set the runtime instance
   * @param runtime The runtime to use
   */
  setRuntime(runtime: PluginRuntime): void {
    this.runtime = runtime;
  }

  /**
   * Get the current runtime instance
   * @throws Error if runtime not initialized
   */
  getRuntime(): PluginRuntime {
    if (!this.runtime) {
      throw new Error("ZTM runtime not initialized - call setZTMRuntime first");
    }
    return this.runtime;
  }

  /**
   * Check if runtime is initialized
   */
  isInitialized(): boolean {
    return this.runtime !== null;
  }
}

// ============================================================================
// CONVENIENCE EXPORTS (Backward Compatible)
// ============================================================================

/**
 * Default runtime provider instance
 * Can be replaced with a mock for testing
 */
export const runtimeProvider: RuntimeProvider = RuntimeManager.getInstance();

/**
 * Set the ZTM runtime
 * @param next The runtime to use
 */
export function setZTMRuntime(next: PluginRuntime): void {
  runtimeProvider.setRuntime(next);
}

/**
 * Get the ZTM runtime
 * @returns The current runtime instance
 * @throws Error if runtime not initialized
 */
export function getZTMRuntime(): PluginRuntime {
  return runtimeProvider.getRuntime();
}

/**
 * Check if runtime is initialized
 * @returns true if runtime has been set
 */
export function isRuntimeInitialized(): boolean {
  return runtimeProvider.isInitialized();
}


