import { defineConfig, devices } from "@playwright/test";

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
      WEB_PUSH_VAPID_PUBLIC_KEY: "BK2TfgABZLfJhWiR5_CjiCGn5ye868whRRt3KN4hyhCvD_Gunorb9U6RBs6SI5UFs-ah_6wufhLANn9BWhocv3w",
      WEB_PUSH_VAPID_PRIVATE_KEY: "_VPTqVTIuwOwHyvb7VGVn7IzMqyhpodP34m0FszZA34",
      WEB_PUSH_SUBJECT: "mailto:e2e@pivot.test",
      CRON_SECRET: "pivot-e2e-cron-secret",
    },
  },
  projects: [
    { name: "chromium", testIgnore: /.*\.mobile\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "android-chrome", testMatch: /.*\.mobile\.spec\.ts/, use: { ...devices["Pixel 5"] } },
  ],
});
