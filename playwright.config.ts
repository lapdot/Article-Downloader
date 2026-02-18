import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/gui-e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://localhost:8787",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run gui",
    url: "http://localhost:8787",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
