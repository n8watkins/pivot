import { createClient } from "@libsql/client";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverDueNotifications, getDueNotificationWindow } from "./notification-delivery";
import { migrate } from "./migrations";

const clients: ReturnType<typeof createClient>[] = [];
const temporaryDirectories: string[] = [];
const validP256dh = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 9)]).toString("base64url");
const validAuth = Buffer.alloc(16, 3).toString("base64url");

async function createTestDatabase({ p256dh = validP256dh, endpoint = "https://push.example.test/one", expirationTime = null as number | null } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "pivot-delivery-"));
  temporaryDirectories.push(directory);
  const db = createClient({ url: `file:${join(directory, "delivery.db")}` });
  clients.push(db);
  await migrate(db);
  await db.batch([
    "INSERT INTO anonymous_sessions (id, created_at) VALUES ('delivery-session', '2026-01-01')",
    "INSERT INTO notification_preferences (session_id, cadence, timezone, updated_at) VALUES ('delivery-session', 'weekly', 'America/Los_Angeles', '2026-01-01')",
    { sql: "INSERT INTO push_subscriptions (id, session_id, endpoint, p256dh, auth, expiration_time, created_at, updated_at) VALUES ('delivery-subscription', 'delivery-session', ?, ?, ?, ?, '2026-01-01', '2026-01-01')", args: [endpoint, p256dh, validAuth, expirationTime] },
  ], "write");
  return db;
}

afterEach(() => {
  for (const client of clients.splice(0)) client.close();
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("notification cadence windows", () => {
  it("uses the recipient timezone across standard and daylight time", () => {
    expect(getDueNotificationWindow(new Date("2026-01-05T17:20:00.000Z"), "America/Los_Angeles", "weekly")).toEqual({ periodKey: "2026-01-05" });
    expect(getDueNotificationWindow(new Date("2026-07-20T16:20:00.000Z"), "America/Los_Angeles", "weekly")).toEqual({ periodKey: "2026-07-20" });
    expect(getDueNotificationWindow(new Date("2026-07-20T15:59:00.000Z"), "America/Los_Angeles", "weekly")).toBeNull();
  });

  it("supports non-hour offsets and monthly boundaries", () => {
    expect(getDueNotificationWindow(new Date("2026-08-01T03:30:00.000Z"), "Asia/Kathmandu", "monthly")).toEqual({ periodKey: "2026-08" });
    expect(getDueNotificationWindow(new Date("2026-08-02T03:30:00.000Z"), "Asia/Kathmandu", "monthly")).toBeNull();
    expect(getDueNotificationWindow(new Date("2026-08-01T03:30:00.000Z"), "Invalid/Timezone", "monthly")).toBeNull();
  });
});

describe("notification delivery", () => {
  it("claims each cadence period once so retries cannot duplicate sends", async () => {
    const db = await createTestDatabase();
    const send = vi.fn(async (_subscription, payload: string) => {
      expect(JSON.parse(payload)).toEqual({ tag: "pivot-weekly-2026-07-20", url: "/?screen=history" });
      expect(payload).not.toContain("habit");
      expect(payload).not.toContain("context");
    });
    const now = new Date("2026-07-20T16:20:00.000Z");

    await expect(deliverDueNotifications(db, { now, send })).resolves.toMatchObject({ due: 1, sent: 1, deduplicated: 0 });
    await expect(deliverDueNotifications(db, { now, send })).resolves.toMatchObject({ due: 1, sent: 0, deduplicated: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    const deliveries = await db.execute("SELECT status FROM notification_deliveries");
    expect(deliveries.rows).toEqual([expect.objectContaining({ status: "sent" })]);
  });

  it("removes subscriptions when the provider reports an expired endpoint", async () => {
    const db = await createTestDatabase();
    const expired = Object.assign(new Error("Gone"), { statusCode: 410 });
    const result = await deliverDueNotifications(db, { now: new Date("2026-07-20T16:20:00.000Z"), send: vi.fn(async () => { throw expired; }) });
    expect(result).toMatchObject({ due: 1, expired: 1, sent: 0 });
    const subscriptions = await db.execute("SELECT COUNT(*) AS count FROM push_subscriptions");
    const deliveries = await db.execute("SELECT COUNT(*) AS count FROM notification_deliveries");
    expect(Number(subscriptions.rows[0].count)).toBe(0);
    expect(Number(deliveries.rows[0].count)).toBe(0);
  });

  it("cleans up locally expired and structurally invalid subscriptions", async () => {
    const expiredDb = await createTestDatabase({ endpoint: "https://push.example.test/expired", expirationTime: new Date("2026-07-20T16:19:00.000Z").getTime() });
    const send = vi.fn(async () => undefined);
    await expect(deliverDueNotifications(expiredDb, { now: new Date("2026-07-20T16:20:00.000Z"), send })).resolves.toMatchObject({ expired: 1, subscriptions: 0 });
    expect(send).not.toHaveBeenCalled();

    const invalidDb = await createTestDatabase({ endpoint: "https://push.example.test/invalid", p256dh: "invalid" });
    await expect(deliverDueNotifications(invalidDb, { now: new Date("2026-07-20T16:20:00.000Z"), send })).resolves.toMatchObject({ due: 1, invalid: 1 });
    const subscriptions = await invalidDb.execute("SELECT COUNT(*) AS count FROM push_subscriptions");
    expect(Number(subscriptions.rows[0].count)).toBe(0);
  });
});
