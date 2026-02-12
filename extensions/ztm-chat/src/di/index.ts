// Dependency Injection Module
// Barrel exports for DI container and service factories

export {
  DEPENDENCIES,
  createDependencyKey,
  DIContainer,
  container,
  type DependencyKey,
  type ILogger,
  type IConfig,
  type IApiClient,
  type IRuntime,
} from "./container.js";

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
 */
export function createLogger(serviceName: string): () => ILogger {
  return () => {
    if (!_logger) {
      _logger = require("../utils/logger.js");
    }
    return _logger.createLogger(serviceName);
  };
}

/**
 * Config service factory
 */
export function createConfigService(): IConfig {
  return {
    get: () => {
      if (!_configModule) {
        _configModule = require("../config/index.js");
      }
      return _configModule.getEffectiveChannelConfig();
    },
    isValid: () => {
      if (!_configModule) {
        _configModule = require("../config/index.js");
      }
      return _configModule.isConfigured();
    },
  };
}

/**
 * API client factory
 */
export function createApiClientService(): IApiClient {
  return {
    getChats: async () => {
      if (!_apiClientModule) {
        _apiClientModule = require("../api/ztm-api.js");
      }
      const client = _apiClientModule.createZTMApiClient();
      return await client.getChats();
    },
    sendPeerMessage: async (peer: string, message: any) => {
      if (!_apiClientModule) {
        _apiClientModule = require("../api/ztm-api.js");
      }
      const client = _apiClientModule.createZTMApiClient();
      return await client.sendPeerMessage(peer, message);
    },
    discoverUsers: async () => {
      if (!_apiClientModule) {
        _apiClientModule = require("../api/ztm-api.js");
      }
      const client = _apiClientModule.createZTMApiClient();
      return await client.discoverUsers();
    },
    getMeshInfo: async () => {
      if (!_apiClientModule) {
        _apiClientModule = require("../api/ztm-api.js");
      }
      const client = _apiClientModule.createZTMApiClient();
      return await client.getMeshInfo();
    },
  };
}

/**
 * Runtime service factory
 */
export function createRuntimeService(): IRuntime {
  return {
    get: () => {
      if (!_runtimeModule) {
        _runtimeModule = require("../runtime.js");
      }
      return _runtimeModule.getZTMRuntime();
    },
    isInitialized: () => {
      if (!_runtimeModule) {
        _runtimeModule = require("../runtime.js");
      }
      return _runtimeModule.isRuntimeInitialized();
    },
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
