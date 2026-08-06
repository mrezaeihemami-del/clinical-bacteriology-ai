import { defineConfig, devices } from "@playwright/test";

const apiPort = process.env.PORT ?? "3001";
const webPort = process.env.WEB_PORT ?? "5173";
const apiUrl = process.env.VITE_API_TARGET ?? `http://localhost:${apiPort}`;
const webUrl = `http://localhost:${webPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: webUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "npm run dev -w @cbai/server",
      url: `${apiUrl}/api/health/ready`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run dev -w @cbai/web",
      url: webUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
