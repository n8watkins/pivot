import { defineConfig, devices } from "@playwright/test";
import webPush from "web-push";

// A throwaway VAPID pair for the local E2E server, generated per run so no key is committed.
// Workers inherit the runner's environment, so every process sees the same pair.
if (!process.env.PIVOT_E2E_VAPID_PUBLIC_KEY || !process.env.PIVOT_E2E_VAPID_PRIVATE_KEY) {
  const keys = webPush.generateVAPIDKeys();
  process.env.PIVOT_E2E_VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.PIVOT_E2E_VAPID_PRIVATE_KEY = keys.privateKey;
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  workers: 1,
  use: { baseURL: "http://[::1]:3101", trace: "retain-on-failure" },
  webServer: {
    command: "npm run start:sqlite -- --port 3101",
    url: "http://[::1]:3101",
    reuseExistingServer: true,
    timeout: 30_000,
    env: {
      LOCAL_DB_URL: "file:./data/pivot-e2e.db",
      ENABLE_GEMINI_RECOMMENDATIONS: "false",
      WEB_PUSH_VAPID_PUBLIC_KEY: process.env.PIVOT_E2E_VAPID_PUBLIC_KEY,
      WEB_PUSH_VAPID_PRIVATE_KEY: process.env.PIVOT_E2E_VAPID_PRIVATE_KEY,
      WEB_PUSH_SUBJECT: "mailto:e2e@pivot.test",
      CRON_SECRET: "pivot-e2e-cron-secret",
    },
  },
  projects: [
    { name: "chromium", testIgnore: /.*\.mobile\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "android-chrome", testMatch: /.*\.mobile\.spec\.ts/, use: { ...devices["Pixel 5"] } },
  ],
});
