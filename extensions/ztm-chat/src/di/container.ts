// Dependency Injection Container
// Provides centralized dependency management and enables testability

import type { ZTMChatConfig } from "../types/config.js";
import type { ZTMApiClient } from "../types/api.js";
import type { ZTMMessage } from "../types/api.js";
import type { Result, AsyncResult } from "../types/common.js";
import type { PluginRuntime } from "openclaw/plugin-sdk";

// ============================================================================
// DEPENDENCY KEYS
// ============================================================================

/**
 * Symbol-based dependency keys prevent naming conflicts
 * Each service has a unique symbol for type-safe lookup
 */
const _loggerKey = Symbol("ztm:logger");
const _configKey = Symbol("ztm:config");
const _apiClientKey = Symbol("ztm:api-client");
const _apiClientFactoryKey = Symbol("ztm:api-client-factory");
const _runtimeKey = Symbol("ztm:runtime");
const _channelStateKey = Symbol("ztm:channel-state");
const _meshConnectivityKey = Symbol("ztm:mesh-connectivity");
const _permitHandlerKey = Symbol("ztm:permit-handler");
const _inboundProcessorKey = Symbol("ztm:inbound-processor");
const _watcherKey = Symbol("ztm:watcher");
const _pollingWatcherKey = Symbol("ztm:polling-watcher");
const _messageDispatcherKey = Symbol("ztm:message-dispatcher");

export const DEPENDENCIES = {
  LOGGER: createDependencyKey<ILogger>(_loggerKey),
  CONFIG: createDependencyKey<IConfig>(_configKey),
  API_CLIENT: createDependencyKey<IApiClient>(_apiClientKey),
  API_CLIENT_FACTORY: createDependencyKey<IApiClientFactory>(_apiClientFactoryKey),
  RUNTIME: createDependencyKey<IRuntime>(_runtimeKey),
  CHANNEL_STATE: createDependencyKey<unknown>(_channelStateKey),
  MESH_CONNECTIVITY: createDependencyKey<unknown>(_meshConnectivityKey),
  PERMIT_HANDLER: createDependencyKey<unknown>(_permitHandlerKey),
  INBOUND_PROCESSOR: createDependencyKey<unknown>(_inboundProcessorKey),
  WATCHER: createDependencyKey<unknown>(_watcherKey),
  POLLING_WATCHER: createDependencyKey<unknown>(_pollingWatcherKey),
  MESSAGE_DISPATCHER: createDependencyKey<unknown>(_messageDispatcherKey),
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
 * Methods return AsyncResult (Promise<Result<...>>) for proper error handling
 */
export interface IApiClient {
  getChats: AsyncResult<unknown, Error>;
  sendPeerMessage(peer: string, message: ZTMMessage): AsyncResult<unknown, Error>;
  discoverUsers: AsyncResult<unknown, Error>;
  getMeshInfo: AsyncResult<unknown, Error>;
}

/**
 * API client factory interface
 * Returns a function that can create API clients with custom configuration
 */
export interface IApiClientFactory {
  (config: ZTMChatConfig, deps?: unknown): ZTMApiClient;
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
    return entry?.instance !== null;
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
