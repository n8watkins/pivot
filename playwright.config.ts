import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://[::1]:3101", trace: "retain-on-failure" },
  webServer: {
    command: "npm run start:sqlite -- --port 3101",
    url: "http://[::1]:3101",
    reuseExistingServer: true,
    timeout: 30_000,
    env: {
      LOCAL_DB_URL: "file:./data/pivot-e2e.db",
      WEB_PUSH_VAPID_PUBLIC_KEY: "BAcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc",
      WEB_PUSH_VAPID_PRIVATE_KEY: "e2e-private-key",
      WEB_PUSH_SUBJECT: "mailto:e2e@pivot.test",
      CRON_SECRET: "pivot-e2e-cron-secret",
    },
  },
  projects: [
    { name: "chromium", testIgnore: /.*\.mobile\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "android-chrome", testMatch: /.*\.mobile\.spec\.ts/, use: { ...devices["Pixel 5"] } },
  ],
});
