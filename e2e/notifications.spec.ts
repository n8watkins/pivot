import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@libsql/client";
import { e2eCronSecret, e2eDatabase, hasE2EDatabase } from "./env";

const p256dh = "BAkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQk";
const auth = "AwMDAwMDAwMDAwMDAwMDAw";

async function installPushHarness(page: Page, permissionResult: "granted" | "denied", endpoint: string) {
  await page.addInitScript(({ permissionResult: result, endpoint: pushEndpoint, p256dh: encryptionKey, auth: authenticationKey }) => {
    const state = window as typeof window & { __pivotPermissionRequested?: boolean; __pivotSubscribed?: boolean; __pivotUnsubscribed?: boolean };
    let permission: NotificationPermission = "default";
    const createSubscription = () => ({
      endpoint: pushEndpoint,
      expirationTime: null,
      options: {} as PushSubscriptionOptions,
      getKey: () => null,
      toJSON: () => ({ endpoint: pushEndpoint, expirationTime: null, keys: { p256dh: encryptionKey, auth: authenticationKey } }),
      unsubscribe: async () => { state.__pivotUnsubscribed = true; localStorage.removeItem("__pivotPushSubscription"); currentSubscription = null; return true; },
    }) as PushSubscription;
    let currentSubscription: PushSubscription | null = localStorage.getItem("__pivotPushSubscription") === pushEndpoint ? createSubscription() : null;
    const registration = {
      waiting: null,
      installing: null,
      pushManager: {
        getSubscription: async () => currentSubscription,
        subscribe: async () => { state.__pivotSubscribed = true; localStorage.setItem("__pivotPushSubscription", pushEndpoint); currentSubscription = createSubscription(); return currentSubscription; },
      },
      addEventListener() {},
      removeEventListener() {},
      update: async () => undefined,
    } as unknown as ServiceWorkerRegistration;
    Object.defineProperty(window, "PushManager", { configurable: true, value: function PushManager() {} });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        get permission() { return permission; },
        requestPermission: async () => { state.__pivotPermissionRequested = true; permission = result; return result; },
      },
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        controller: {},
        ready: Promise.resolve(registration),
        register: async () => registration,
        getRegistration: async () => registration,
        addEventListener() {},
        removeEventListener() {},
      },
    });
  }, { permissionResult, endpoint, p256dh, auth });
}

async function executeWhenDatabaseIsAvailable(statement: { sql: string; args: string[] }) {
  const db = createClient({ url: e2eDatabase.url!, authToken: e2eDatabase.authToken });
  try {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        return await db.execute(statement);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("SQLITE_BUSY") || attempt === 19) throw error;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    throw new Error("Database did not become available");
  } finally {
    db.close();
  }
}

async function waitForDatabaseRow(statement: { sql: string; args: string[] }) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await executeWhenDatabaseIsAvailable(statement);
    if (result.rows.length) return result;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return executeWhenDatabaseIsAvailable(statement);
}

test("weekly and monthly notification choices persist and opt-out unsubscribes", async ({ page }) => {
  await installPushHarness(page, "granted", `https://push.example.test/${crypto.randomUUID()}`);
  await page.goto("/settings");
  await expect(page.getByRole("radio", { name: /Off/ })).toBeChecked();

  await page.getByRole("radio", { name: /Weekly/ }).click();
  await expect(page.getByRole("status")).toContainText("Weekly check-ins are on.");
  expect(await page.evaluate(() => (window as typeof window & { __pivotPermissionRequested?: boolean }).__pivotPermissionRequested)).toBe(true);
  expect(await page.evaluate(() => (window as typeof window & { __pivotSubscribed?: boolean }).__pivotSubscribed)).toBe(true);
  await page.reload();
  await expect(page.getByRole("radio", { name: /Weekly/ })).toBeChecked();

  await page.getByRole("radio", { name: /Monthly/ }).click();
  await expect(page.getByRole("status")).toContainText("Monthly check-ins are on.");
  await page.reload();
  await expect(page.getByRole("radio", { name: /Monthly/ })).toBeChecked();

  await page.getByRole("radio", { name: /Off/ }).click();
  await expect(page.getByRole("status")).toContainText("Notifications are off.");
  expect(await page.evaluate(() => (window as typeof window & { __pivotUnsubscribed?: boolean }).__pivotUnsubscribed)).toBe(true);
  const preference = await page.evaluate(() => fetch("/api/notifications/preferences").then((response) => response.json()));
  expect(preference.cadence).toBe("off");
});

test("permission denial keeps notifications off and stores no subscription", async ({ page }) => {
  await installPushHarness(page, "denied", `https://push.example.test/${crypto.randomUUID()}`);
  await page.goto("/settings");
  await page.getByRole("radio", { name: /Weekly/ }).click();
  await expect(page.getByRole("status")).toContainText("permission was not granted");
  expect(await page.evaluate(() => (window as typeof window & { __pivotSubscribed?: boolean }).__pivotSubscribed)).not.toBe(true);
  const preference = await page.evaluate(() => fetch("/api/notifications/preferences").then((response) => response.json()));
  expect(preference.cadence).toBe("off");
});

test("subscription API rejects malformed encryption material", async ({ request }) => {
  const response = await request.post("/api/notifications/subscription", { data: { endpoint: "https://push.example.test/invalid", keys: { p256dh: "short", auth: "short" } } });
  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("key") });
});

test("deleting all data removes notification preferences, subscriptions, and deliveries", async ({ page }) => {
  test.skip(!hasE2EDatabase, "needs direct access to the deployment's database");
  await installPushHarness(page, "granted", `https://push.example.test/${crypto.randomUUID()}`);
  await page.goto("/settings");
  await page.getByRole("radio", { name: /Weekly/ }).click();
  await expect(page.getByRole("status")).toContainText("Weekly check-ins are on.");
  const sessionId = await page.evaluate(() => fetch("/api/session").then((response) => response.json()).then((value) => value.sessionId as string));
  const before = await waitForDatabaseRow({ sql: "SELECT id FROM push_subscriptions WHERE session_id = ?", args: [sessionId] });
  expect(before.rows).toHaveLength(1);
  const subscriptionId = String(before.rows[0].id);
  await executeWhenDatabaseIsAvailable({ sql: "INSERT INTO notification_deliveries (id, subscription_id, cadence, period_key, scheduled_for, status, created_at) VALUES (?, ?, 'weekly', '2026-W30', '2026-07-20T16:00:00.000Z', 'sent', '2026-07-20T16:00:00.000Z')", args: [crypto.randomUUID(), subscriptionId] });

  await page.getByRole("button", { name: "Delete all my data" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete all your data?" });
  await dialog.getByLabel(/Type “delete” to confirm/).fill("delete");
  await dialog.getByRole("button", { name: "Delete all my data" }).click();
  await page.waitForURL("**/onboarding");

  for (const table of ["notification_preferences", "push_subscriptions"]) {
    const result = await executeWhenDatabaseIsAvailable({ sql: `SELECT COUNT(*) AS count FROM ${table} WHERE session_id = ?`, args: [sessionId] });
    expect(Number(result.rows[0].count)).toBe(0);
  }
  const deliveries = await executeWhenDatabaseIsAvailable({ sql: "SELECT COUNT(*) AS count FROM notification_deliveries WHERE subscription_id = ?", args: [subscriptionId] });
  expect(Number(deliveries.rows[0].count)).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem("__pivotPushSubscription"))).toBeNull();
});

test("notification messages never contain private Pivot content", async ({ request }) => {
  const worker = await request.get("/sw.js");
  const source = await worker.text();
  expect(source).toContain('body: "Your Pivot check-in is ready."');
  expect(source).not.toContain("contextNote");
  expect(source).not.toContain("pivotGoal");
});

test("notification scheduler requires the dedicated cron secret", async ({ request }) => {
  test.skip(!hasE2EDatabase, "delivery needs persistent storage");
  const unauthorized = await request.get("/api/cron/notifications");
  expect(unauthorized.status()).toBe(401);
  expect(unauthorized.headers()["cache-control"]).toContain("no-store");

  const authorized = await request.get("/api/cron/notifications", { headers: { Authorization: `Bearer ${e2eCronSecret}` } });
  expect(authorized.ok()).toBeTruthy();
  await expect(authorized.json()).resolves.toMatchObject({ ok: true, sent: expect.any(Number), deduplicated: expect.any(Number), expired: expect.any(Number) });
});
