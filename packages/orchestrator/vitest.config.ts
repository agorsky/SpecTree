import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    // Don't fail on unhandled rejections during fake timer cleanup
    dangerouslyIgnoreUnhandledErrors: true,
  },
});
