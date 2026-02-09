import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    // SAFETY: Always point to the test database when running tests.
    // This prevents accidental overwrites of the production database.
    env: {
      DATABASE_URL: "file:./data/spectree-test.db",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "dist/", "**/*.d.ts", "**/*.config.*"],
    },
  },
});
