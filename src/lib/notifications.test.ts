import { createClient } from "@libsql/client";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "./migrations";
import {
  deletePushSubscriptions,
  getNotificationConfiguration,
  notificationPreferenceSchema,
  pushSubscriptionSchema,
  readNotificationPreference,
  savePushSubscription,
  writeNotificationPreference,
} from "./notifications";

const clients: ReturnType<typeof createClient>[] = [];
const temporaryDirectories: string[] = [];
const validPublicKey = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 7)]).toString("base64url");
const validP256dh = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 9)]).toString("base64url");
const validAuth = Buffer.alloc(16, 3).toString("base64url");

async function createTestDatabase() {
  const directory = mkdtempSync(join(tmpdir(), "pivot-notifications-"));
  temporaryDirectories.push(directory);
  const db = createClient({ url: `file:${join(directory, "notifications.db")}` });
  clients.push(db);
  await migrate(db);
  await db.execute("INSERT INTO anonymous_sessions (id, created_at) VALUES ('notification-session', '2026-01-01')");
  return db;
}

afterEach(() => {
  for (const client of clients.splice(0)) client.close();
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("notification validation", () => {
  it("accepts supported cadences and real IANA timezones", () => {
    expect(notificationPreferenceSchema.parse({ cadence: "weekly", timezone: "America/Los_Angeles" })).toEqual({ cadence: "weekly", timezone: "America/Los_Angeles" });
    expect(notificationPreferenceSchema.safeParse({ cadence: "daily", timezone: "UTC" }).success).toBe(false);
    expect(notificationPreferenceSchema.safeParse({ cadence: "monthly", timezone: "Moon/Base" }).success).toBe(false);
  });

  it("rejects insecure endpoints and malformed encryption keys", () => {
    expect(pushSubscriptionSchema.safeParse({ endpoint: "http://push.example.test/id", keys: { p256dh: validP256dh, auth: validAuth } }).success).toBe(false);
    expect(pushSubscriptionSchema.safeParse({ endpoint: "https://push.example.test/id", keys: { p256dh: "short", auth: validAuth } }).success).toBe(false);
    expect(pushSubscriptionSchema.safeParse({ endpoint: "https://push.example.test/id", keys: { p256dh: validP256dh, auth: validAuth } }).success).toBe(true);
  });

  it("only exposes a complete, structurally valid VAPID configuration", () => {
    expect(getNotificationConfiguration({ WEB_PUSH_VAPID_PUBLIC_KEY: "invalid", WEB_PUSH_VAPID_PRIVATE_KEY: "private", WEB_PUSH_SUBJECT: "mailto:privacy@example.com" })).toEqual({ configured: false, publicKey: "" });
    expect(getNotificationConfiguration({ WEB_PUSH_VAPID_PUBLIC_KEY: validPublicKey, WEB_PUSH_VAPID_PRIVATE_KEY: "private", WEB_PUSH_SUBJECT: "mailto:privacy@example.com" })).toEqual({ configured: true, publicKey: validPublicKey });
  });
});

describe("notification persistence", () => {
  it("migrates preferences, subscriptions, and deduplicated deliveries", async () => {
    const db = await createTestDatabase();
    const tables = await db.execute("SELECT name FROM sqlite_master WHERE type = 'table'");
    expect(tables.rows.map((row) => row.name)).toEqual(expect.arrayContaining(["notification_preferences", "push_subscriptions", "notification_deliveries"]));

    await writeNotificationPreference(db, "notification-session", { cadence: "weekly", timezone: "America/Los_Angeles" });
    await expect(readNotificationPreference(db, "notification-session")).resolves.toEqual({ cadence: "weekly", timezone: "America/Los_Angeles" });
  });

  it("owns subscriptions by session and removes delivery data on opt-out", async () => {
    const db = await createTestDatabase();
    const subscriptionId = await savePushSubscription(db, "notification-session", { endpoint: "https://push.example.test/one", expirationTime: null, keys: { p256dh: validP256dh, auth: validAuth } });
    await db.execute({ sql: "INSERT INTO notification_deliveries (id, subscription_id, cadence, period_key, scheduled_for, status, created_at) VALUES ('delivery-one', ?, 'weekly', '2026-W30', '2026-07-20T16:00:00.000Z', 'sent', '2026-07-20T16:00:00.000Z')", args: [subscriptionId] });

    expect(await deletePushSubscriptions(db, "another-session", "https://push.example.test/one")).toBe(0);
    await writeNotificationPreference(db, "notification-session", { cadence: "off", timezone: "America/Los_Angeles" });
    const subscriptions = await db.execute("SELECT COUNT(*) AS count FROM push_subscriptions");
    const deliveries = await db.execute("SELECT COUNT(*) AS count FROM notification_deliveries");
    expect(Number(subscriptions.rows[0].count)).toBe(0);
    expect(Number(deliveries.rows[0].count)).toBe(0);
  });
});
