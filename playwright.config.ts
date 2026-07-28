import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    channel: "chrome",
    colorScheme: "light",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm --filter @inshell/thought dev",
      url: "http://127.0.0.1:5174/thought/",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @inshell/home dev",
      url: "http://127.0.0.1:5173/",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
