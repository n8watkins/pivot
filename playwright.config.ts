import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:3001", trace: "retain-on-failure" },
  webServer: { command: "npm run start:sqlite -- --port 3001", url: "http://127.0.0.1:3001", reuseExistingServer: true, timeout: 30_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
