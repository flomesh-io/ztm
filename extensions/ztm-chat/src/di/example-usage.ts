// Dependency Injection Usage Example
// Demonstrates how to refactor plugin.ts to use DI container

// ============================================================================
// BEFORE (Direct Imports - Tight Coupling)
// ============================================================================
/*
import { createZTMApiClient } from "../api/ztm-api.js";
import { logger } from "../utils/logger.js";
import { getZTMRuntime } from "../runtime.js";

const apiClient = createZTMApiClient(config);
const runtime = getZTMRuntime();
const log = logger;

// Use services directly...
const result = await apiClient.getChats();
log.info("Chats loaded");
runtime.doSomething();
*/

// ============================================================================
// AFTER (Dependency Injection - Loose Coupling)
// ============================================================================
/*
import {
  container,
  DEPENDENCIES,
  createDependencyKey,
  createLogger,
  createConfigService,
  createApiClientService,
  createRuntimeService,
  type ILogger,
  type IApiClient,
  type IRuntime,
} from "../di/index.js";

// Services are lazy-loaded from container
const logger = container.get<ILogger>(DEPENDENCIES.LOGGER);
const config = container.get<IConfig>(DEPENDENCIES.CONFIG);
const apiClient = container.get<IApiClient>(DEPENDENCIES.API_CLIENT);
const runtime = container.get<IRuntime>(DEPENDENCIES.RUNTIME);

// Use services through container interface...
const result = await apiClient.getChats();
logger.info("Chats loaded");
runtime.doSomething();
*/

// ============================================================================
// TEST USAGE (Mock Injection)
// ============================================================================
/*
// In tests, replace container with mock:
import { container, DEPENDENCIES } from "../di/index.js";
import { vi } from "vitest";

describe("Channel Plugin with DI", () => {
  beforeEach(() => {
    // Reset container and mocks
    container.reset();
    vi.clearAllMocks();

    // Register mock services
    const mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    container.registerInstance(DEPENDENCIES.LOGGER, mockLogger);

    const mockConfig = {
      get: vi.fn(() => mockConfigData),
      isValid: vi.fn(() => true),
    };
    container.registerInstance(DEPENDENCIES.CONFIG, mockConfig);

    const mockApiClient = {
      getChats: vi.fn(() => Promise.resolve(mockChats)),
      sendPeerMessage: vi.fn(() => Promise.resolve(true)),
      // ...
    };
    container.registerInstance(DEPENDENCIES.API_CLIENT, mockApiClient);
  });

  afterEach(() => {
    // Clean up after each test
    container.reset();
  });

  it("should use injected logger", () => {
    const logger = container.get<ILogger>(DEPENDENCIES.LOGGER);
    logger.info("Test message");
    expect(logger.info).toHaveBeenCalledWith("Test message");
  });

  it("should use injected api client", async () => {
    const apiClient = container.get<IApiClient>(DEPENDENCIES.API_CLIENT);
    const chats = await apiClient.getChats();
    expect(apiClient.getChats).toHaveBeenCalled();
    });
});
*/

// ============================================================================
// MIGRATION PATH FOR plugin.ts
// ============================================================================
/*
To migrate plugin.ts to use DI:

1. Add imports:
   import {
     container,
     DEPENDENCIES,
     createDependencyKey,
     createLogger,
     createConfigService,
     createApiClientService,
     createRuntimeService,
     type ILogger,
     type IApiClient,
     type IRuntime,
   } from "../di/index.js";

2. Register services in plugin initialization (before first use):
   container.register(DEPENDENCIES.LOGGER, createLogger("ztm-chat"));
   container.register(DEPENDENCIES.CONFIG, createConfigService());
   container.register(DEPENDENCIES.API_CLIENT, createApiClientService());
   container.register(DEPENDENCIES.RUNTIME, createRuntimeService());

3. Replace direct imports with container.get():
   Before: const log = logger;
   After:  const log = container.get<ILogger>(DEPENDENCIES.LOGGER);

4. For testing: Replace container with mock in beforeEach
   container.registerInstance(DEPENDENCIES.LOGGER, mockLogger);

This migration:
- Eliminates 14 direct import dependencies
- Makes services injectable and testable
- Provides lazy initialization
- Enables service lifecycle management
*/

export {};
