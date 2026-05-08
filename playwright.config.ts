import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/gui-e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://localhost:8788",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run build && npm run gui:build && node dist/gui/bridge/server.js --port=8788",
    url: "http://localhost:8788",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
