// Where the suite runs. By default Playwright starts a local production build
// on a fresh SQLite file (see playwright.config.ts). PLAYWRIGHT_BASE_URL points
// it at a deployment that is already running instead, such as the Worker on
// workers.dev or `npm run preview:worker`.
export const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, "");

// The database the specs inspect directly. A deployment under test sets
// PIVOT_E2E_DB_URL (and PIVOT_E2E_DB_AUTH_TOKEN) to its own throwaway database.
export const e2eDatabase = {
  url: process.env.PIVOT_E2E_DB_URL ?? (externalBaseURL ? undefined : "file:./data/pivot-e2e.db"),
  authToken: process.env.PIVOT_E2E_DB_AUTH_TOKEN,
};

// False for a deployment without a database the suite can reach, which skips
// the specs that read rows directly or need persistent storage.
export const hasE2EDatabase = Boolean(e2eDatabase.url);

export const e2eCronSecret = process.env.PIVOT_E2E_CRON_SECRET ?? "pivot-e2e-cron-secret";
