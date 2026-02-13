import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Alias to simplify importing docs from monorepo root
      "@docs": path.resolve(__dirname, "../../docs"),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  // Markdown file imports:
  // Use the ?raw suffix to import markdown files as strings
  // Example: import content from '@docs/whats-new/v0.1.0.md?raw'
  // This is a built-in Vite feature and requires no plugins
});
