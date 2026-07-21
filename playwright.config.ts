import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://[::1]:3101", trace: "retain-on-failure" },
  webServer: { command: "env LOCAL_DB_URL=file:./data/pivot-e2e.db npm run start:sqlite -- --port 3101", url: "http://[::1]:3101", reuseExistingServer: true, timeout: 30_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
