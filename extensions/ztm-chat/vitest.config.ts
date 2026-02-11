import { defineConfig } from 'vitest/config';
import type { UserConfig } from 'vitest/config';

const testConfig: UserConfig = {
  test: {
    testTimeout: 30000, // 30 seconds default timeout
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Run tests in single thread to avoid race conditions
      },
    },
  },
};

const coverageConfig = {
  provider: 'v8' as const,
  reporter: ['text', 'json', 'html', 'lcov'] as const,
  include: [
    'src/**/*.ts',
  ],
  exclude: [
    'src/**/*.test.ts',
    'src/**/*.spec.ts',
    'src/types/**',  // Type definitions don't need coverage
    'src/mocks/**',
    'src/**/index.ts',  // Barrel exports don't need coverage
  ],
  // Set coverage targets (we'll work towards these)
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 75,
    statements: 80,
  },
  // Per-file thresholds for new modules
  perFile: true,
};

export default defineConfig({
  ...testConfig,
  ...coverageConfig,
});
