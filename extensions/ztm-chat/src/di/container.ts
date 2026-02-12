// Dependency Injection Container
// Provides centralized dependency management and enables testability

import type { ZTMChatConfig } from "../types/config.js";
import type { ZTMApiClient } from "../types/api.js";
import type { ZTMMessage } from "../types/api.js";
import type { PluginRuntime } from "openclaw/plugin-sdk";

// ============================================================================
// DEPENDENCY KEYS
// ============================================================================

/**
 * Symbol-based dependency keys prevent naming conflicts
 * Each service has a unique symbol for type-safe lookup
 */
export const DEPENDENCIES = {
  LOGGER: Symbol("ztm:logger"),
  CONFIG: Symbol("ztm:config"),
  API_CLIENT: Symbol("ztm:api-client"),
  RUNTIME: Symbol("ztm:runtime"),
  CHANNEL_STATE: Symbol("ztm:channel-state"),
  MESH_CONNECTIVITY: Symbol("ztm:mesh-connectivity"),
  PERMIT_HANDLER: Symbol("ztm:permit-handler"),
  INBOUND_PROCESSOR: Symbol("ztm:inbound-processor"),
  WATCHER: Symbol("ztm:watcher"),
  POLLING_WATCHER: Symbol("ztm:polling-watcher"),
  MESSAGE_DISPATCHER: Symbol("ztm:message-dispatcher"),
  DEDUP_CACHE: Symbol("ztm:dedup-cache"),
} as const;

/**
 * Type-safe dependency key type
 */
export type DependencyKey<T> = symbol & { __brand: T };

/**
 * Create a typed dependency key
 */
export function createDependencyKey<T>(symbol: symbol): DependencyKey<T> {
  return symbol as DependencyKey<T>;
}

// ============================================================================
// SERVICE INTERFACES
// ============================================================================

/**
 * Logger service interface
 */
export interface ILogger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

/**
 * Config service interface
 */
export interface IConfig {
  get(): ZTMChatConfig;
  isValid(): boolean;
}

/**
 * API client service interface
 */
export interface IApiClient {
  getChats(): Promise<unknown>;
  sendPeerMessage(peer: string, message: ZTMMessage): Promise<unknown>;
  discoverUsers(): Promise<unknown>;
  getMeshInfo(): Promise<unknown>;
  // Add other API methods as needed
}

/**
 * Runtime service interface
 */
export interface IRuntime {
  get(): PluginRuntime;
  isInitialized(): boolean;
}

// ============================================================================
// CONTAINER IMPLEMENTATION
// ============================================================================

/**
 * Simple dependency injection container
 *
 * Features:
 * - Type-safe service registration and retrieval
 * - Lazy initialization (factories)
 * - Singleton enforcement per service
 * - Test-friendly (can be reset between tests)
 */
export class DIContainer {
  private static instance: DIContainer | null = null;
  private services = new Map<symbol, {
    factory: () => unknown;
    instance: unknown | null;
  }>();

  /**
   * Get the singleton container instance
   */
  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  /**
   * Reset the container (for testing)
   * Clears all service instances - call in test beforeEach
   */
  static reset(): void {
    if (DIContainer.instance) {
      DIContainer.instance.services.clear();
    }
    DIContainer.instance = null;
  }

  /**
   * Register a service factory
   * @param key The dependency key
   * @param factory Function that creates the service instance
   */
  register<T>(key: DependencyKey<T>, factory: () => T): void {
    if (this.services.has(key)) {
      throw new Error(`Service ${key.toString()} already registered`);
    }
    this.services.set(key, { factory, instance: null });
  }

  /**
   * Register an existing instance (useful for mocks in tests)
   * @param key The dependency key
   * @param instance The service instance
   */
  registerInstance<T>(key: DependencyKey<T>, instance: T): void {
    if (this.services.has(key)) {
      throw new Error(`Service ${key.toString()} already registered`);
    }
    this.services.set(key, { factory: () => instance, instance });
  }

  /**
   * Get a service instance
   * Creates instance on first access (lazy initialization)
   * @param key The dependency key
   * @returns The service instance
   * @throws Error if service not registered
   */
  get<T>(key: DependencyKey<T>): T {
    const entry = this.services.get(key);
    if (!entry) {
      throw new Error(`Service ${key.toString()} not registered. Available keys: ${Array.from(this.services.keys()).join(", ")}`);
    }

    // Lazy initialization: create instance on first access
    if (entry.instance === null) {
      entry.instance = entry.factory();
      this.services.set(key, { ...entry, instance: entry.instance });
    }

    return entry.instance as T;
  }

  /**
   * Check if a service instance exists (has been created)
   * @param key The dependency key
   * @returns true if instance has been created
   */
  has<T>(key: DependencyKey<T>): boolean {
    const entry = this.services.get(key);
    return entry?.instance !== null ?? false;
  }

  /**
   * Check if a service is registered
   * @param key The dependency key
   * @returns true if service is registered
   */
  isRegistered<T>(key: DependencyKey<T>): boolean {
    return this.services.has(key);
  }
}

// ============================================================================
// GLOBAL CONTAINER INSTANCE
// ============================================================================

/**
 * Default container instance
 * Can be replaced with test container in tests
 */
export const container: DIContainer = DIContainer.getInstance();
