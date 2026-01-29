import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Enable global test APIs (describe, it, expect, etc.)
    globals: true,

    // Use Node.js environment for MCP tests
    environment: "node",

    // Test file patterns
    include: ["tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}"],

    // Exclude patterns
    exclude: ["**/node_modules/**", "**/dist/**"],

    // Test timeout
    testTimeout: 30000,

    // Hook timeout for setup/teardown
    hookTimeout: 30000,

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
