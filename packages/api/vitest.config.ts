import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Enable global test APIs (describe, it, expect, etc.)
    globals: true,

    // Use Node.js environment for API tests
    environment: "node",

    // Global setup file that runs before tests
    // This sets up JWT_SECRET and optionally connects to the test database
    // Unit tests can mock the database and don't need DATABASE_URL
    // Integration tests need DATABASE_URL pointing to spectree_test
    setupFiles: ["./tests/setup.ts"],

    // Test file patterns
    include: ["tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}"],

    // Exclude patterns
    exclude: ["**/node_modules/**", "**/dist/**"],

    // Test timeout (integration tests may need more time)
    testTimeout: 30000,

    // Hook timeout for setup/teardown
    hookTimeout: 30000,

    // Run tests sequentially to avoid database conflicts
    sequence: {
      shuffle: false,
    },

    // Pool configuration
    // Using forks with singleFork for integration tests that share database
    // This ensures tests don't run in parallel and conflict on DB operations
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.d.ts",
        "**/*.config.*",
        "tests/**",
        "src/generated/**",
      ],
    },

    // Reporter configuration
    reporters: ["default"],
  },

  // Resolve configuration
  resolve: {
    // Ensure .js extensions work for TypeScript imports
    extensions: [".ts", ".js", ".json"],
  },
});
