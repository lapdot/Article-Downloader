import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/gui-e2e/**"],
    setupFiles: ["tests/setup/network-guard.ts"],
  },
});
