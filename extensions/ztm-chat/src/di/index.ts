// Dependency Injection Module
// Barrel exports for DI container and service factories

import type {
  DependencyKey,
  ILogger,
  IConfig,
  IApiClient,
  IApiClientFactory,
  IRuntime,
} from "./container";

import type { ZTMChatConfig } from "../types/config.js";
import type { Result, AsyncResult } from "../types/common.js";

export {
  DEPENDENCIES,
  createDependencyKey,
  DIContainer,
  container,
  type DependencyKey,
  type ILogger,
  type IConfig,
  type IApiClient,
  type IApiClientFactory,
  type IRuntime,
} from "./container";

// ============================================================================
// SERVICE FACTORIES
// ============================================================================

/**
 * Factory functions to create service instances
 * These factories are registered with the container and support lazy initialization
 */

// Import actual implementations (lazy import)
let _logger: any = null;
let _configModule: any = null;
let _apiClientModule: any = null;
let _runtimeModule: any = null;

/**
 * Logger factory
 * Returns a factory function that creates a logger instance
 */
export function createLogger(serviceName: string): () => ILogger {
  // Return a function that creates or returns the cached logger
  return () => {
    if (!_logger) {
      _logger = require("../utils/logger.js");
    }
    return _logger.createLogger(serviceName);
  };
}

/**
 * Config service factory
 * Returns a factory function for DI container registration
 */
export function createConfigService(): () => IConfig {
  return () => {
    if (!_configModule) {
      _configModule = require("../config/index.js");
    }
    return {
      get: () => _configModule.getEffectiveChannelConfig(),
      isValid: () => _configModule.isConfigured(),
    };
  };
}

/**
 * API client factory
 * Returns a factory function for DI container registration
 * Methods directly return promises for compatibility
 */
export function createApiClientService(): () => IApiClient {
  return (): IApiClient => {
    if (!_apiClientModule) {
      _apiClientModule = require("../api/ztm-api.js");
    }
    const client = _apiClientModule.createZTMApiClient();
    return {
      getChats: client.getChats(),
      sendPeerMessage: client.sendPeerMessage,
      sendGroupMessage: client.sendGroupMessage,
      discoverUsers: client.discoverUsers(),
      getMeshInfo: client.getMeshInfo(),
    };
  };
}

/**
 * Runtime service factory
 * Returns a factory function for DI container registration
 */
export function createRuntimeService(): () => IRuntime {
  return () => {
    if (!_runtimeModule) {
      _runtimeModule = require("../runtime/runtime.js");
    }
    return {
      get: () => _runtimeModule.getZTMRuntime(),
      isInitialized: () => _runtimeModule.isRuntimeInitialized(),
    };
  };
}

/**
 * API client factory
 * Returns a factory function for DI container registration
 */
export function createApiClientFactory(): () => IApiClientFactory {
  return () => (config: ZTMChatConfig, deps: unknown = undefined) => {
    if (!_apiClientModule) {
      _apiClientModule = require("../api/ztm-api.js");
    }
    return _apiClientModule.createZTMApiClient(config, deps);
  };
}

/**
 * Reset all lazy imports (for testing)
 * Call this in test beforeEach to reset module cache
 */
export function resetLazyImports(): void {
  _logger = null;
  _configModule = null;
  _apiClientModule = null;
  _runtimeModule = null;
}
