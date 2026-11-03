import type { Client } from "@libsql/client";
import { randomUUID } from "node:crypto";
import * as webPush from "web-push";
import { deletePushSubscriptions, getNotificationServerConfiguration, isValidTimeZone, notificationCadenceSchema, pushSubscriptionSchema, type NotificationCadence } from "./notifications";

type DueWindow = { periodKey: string };

type DeliveryCandidate = {
  subscriptionId: string;
  sessionId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationTime: number | null;
  cadence: NotificationCadence;
  timezone: string;
  due: DueWindow;
};

export type PushSender = (subscription: webPush.PushSubscription, payload: string) => Promise<void>;

export type NotificationDeliveryResult = {
  subscriptions: number;
  due: number;
  sent: number;
  deduplicated: number;
  expired: number;
  invalid: number;
  failed: number;
};

function localDateParts(now: Date, timezone: string) {
  if (!isValidTimeZone(timezone)) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { year: value("year"), month: value("month"), day: value("day"), weekday: value("weekday"), hour: Number(value("hour")) };
}

export function getDueNotificationWindow(now: Date, timezone: string, cadence: NotificationCadence): DueWindow | null {
  if (cadence === "off") return null;
  const local = localDateParts(now, timezone);
  if (!local || local.hour !== 9) return null;
  if (cadence === "weekly" && local.weekday !== "Mon") return null;
  if (cadence === "monthly" && local.day !== "01") return null;
  return { periodKey: cadence === "weekly" ? `${local.year}-${local.month}-${local.day}` : `${local.year}-${local.month}` };
}

export function createWebPushSender(environment: Record<string, string | undefined> = process.env): PushSender {
  const configuration = getNotificationServerConfiguration(environment);
  if (!configuration.configured) throw new Error("Web Push is not configured.");
  return async (subscription, payload) => {
    await webPush.sendNotification(subscription, payload, {
      TTL: 60 * 60 * 24,
      urgency: "low",
      timeout: 10_000,
      vapidDetails: {
        subject: configuration.subject,
        publicKey: configuration.publicKey,
        privateKey: configuration.privateKey,
      },
    });
  };
}

function isUniqueConstraint(error: unknown) {
  return Boolean(error && typeof error === "object" && (("code" in error && String(error.code).startsWith("SQLITE_CONSTRAINT")) || ("message" in error && String(error.message).includes("UNIQUE constraint failed"))));
}

function providerStatus(error: unknown) {
  return error && typeof error === "object" && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : null;
}

async function claimDelivery(db: Client, candidate: DeliveryCandidate, now: Date) {
  const id = randomUUID();
  try {
    await db.execute({
      sql: "INSERT INTO notification_deliveries (id, subscription_id, cadence, period_key, scheduled_for, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)",
      args: [id, candidate.subscriptionId, candidate.cadence, candidate.due.periodKey, now.toISOString(), now.toISOString()],
    });
    return id;
  } catch (error) {
    if (isUniqueConstraint(error)) return null;
    throw error;
  }
}

async function removeExpiredSubscriptions(db: Client, now: Date) {
  const expired = await db.execute({ sql: "SELECT id FROM push_subscriptions WHERE expiration_time IS NOT NULL AND expiration_time <= ?", args: [now.getTime()] });
  const ids = expired.rows.map((row) => String(row.id));
  if (!ids.length) return 0;
  const placeholders = ids.map(() => "?").join(", ");
  await db.batch([
    { sql: `DELETE FROM notification_deliveries WHERE subscription_id IN (${placeholders})`, args: ids },
    { sql: `DELETE FROM push_subscriptions WHERE id IN (${placeholders})`, args: ids },
  ], "write");
  return ids.length;
}

async function runWithConcurrency<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      await task(item);
    }
  }));
}

export async function deliverDueNotifications(db: Client, { now = new Date(), send = createWebPushSender() }: { now?: Date; send?: PushSender } = {}): Promise<NotificationDeliveryResult> {
  const result: NotificationDeliveryResult = { subscriptions: 0, due: 0, sent: 0, deduplicated: 0, expired: 0, invalid: 0, failed: 0 };
  result.expired += await removeExpiredSubscriptions(db, now);
  const rows = await db.execute("SELECT s.id as subscriptionId, s.session_id as sessionId, s.endpoint, s.p256dh, s.auth, s.expiration_time as expirationTime, p.cadence, p.timezone FROM push_subscriptions s JOIN notification_preferences p ON p.session_id = s.session_id WHERE p.cadence IN ('weekly', 'monthly')");
  result.subscriptions = rows.rows.length;
  const candidates: DeliveryCandidate[] = [];
  for (const row of rows.rows) {
    const cadence = notificationCadenceSchema.safeParse(row.cadence);
    if (!cadence.success) continue;
    const timezone = String(row.timezone);
    const due = getDueNotificationWindow(now, timezone, cadence.data);
    if (!due) continue;
    result.due += 1;
    candidates.push({
      subscriptionId: String(row.subscriptionId),
      sessionId: String(row.sessionId),
      endpoint: String(row.endpoint),
      p256dh: String(row.p256dh),
      auth: String(row.auth),
      expirationTime: row.expirationTime === null ? null : Number(row.expirationTime),
      cadence: cadence.data,
      timezone,
      due,
    });
  }

  await runWithConcurrency(candidates, 10, async (candidate) => {
    const subscription = pushSubscriptionSchema.safeParse({ endpoint: candidate.endpoint, expirationTime: candidate.expirationTime, keys: { p256dh: candidate.p256dh, auth: candidate.auth } });
    if (!subscription.success) {
      await deletePushSubscriptions(db, candidate.sessionId, candidate.endpoint);
      result.invalid += 1;
      return;
    }
    const deliveryId = await claimDelivery(db, candidate, now);
    if (!deliveryId) {
      result.deduplicated += 1;
      return;
    }
    const payload = JSON.stringify({ tag: `pivot-${candidate.cadence}-${candidate.due.periodKey}`, url: "/?screen=history" });
    try {
      await send(subscription.data, payload);
      await db.execute({ sql: "UPDATE notification_deliveries SET status = 'sent', sent_at = ? WHERE id = ?", args: [new Date().toISOString(), deliveryId] });
      result.sent += 1;
    } catch (error) {
      const status = providerStatus(error);
      if (status === 404 || status === 410) {
        await deletePushSubscriptions(db, candidate.sessionId, candidate.endpoint);
        result.expired += 1;
        return;
      }
      await db.execute({ sql: "UPDATE notification_deliveries SET status = 'failed', error_code = ? WHERE id = ?", args: [status ? String(status) : "send-failed", deliveryId] });
      result.failed += 1;
    }
  });
  return result;
}
