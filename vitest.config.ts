import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test files pattern
    include: ['tests/**/*.test.ts'],

    // Global test setup
    setupFiles: ['tests/setup.ts'],

    // Enable globals (describe, it, expect)
    globals: true,

    // Environment
    environment: 'node',

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/__tests__/**',
        'node_modules/**',
      ],
    },

    // Timeout for tests
    testTimeout: 30000,

    // Hooks timeout
    hookTimeout: 30000,

    // Reporter
    reporters: ['verbose'],

    // Pool options for parallel tests
    pool: 'threads',
  },

  // ESM resolution
  resolve: {
    alias: {
      '@': './src',
    },
  },
});
