import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    // Logic tests run in Node. Component tests opt in to a browser-like
    // environment with a `// @vitest-environment jsdom` comment.
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
