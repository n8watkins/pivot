import type { Client } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { z } from "zod";

export const notificationCadenceSchema = z.enum(["off", "weekly", "monthly"]);
export type NotificationCadence = z.infer<typeof notificationCadenceSchema>;

export function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const notificationPreferenceSchema = z.object({
  cadence: notificationCadenceSchema,
  timezone: z.string().trim().min(1).max(100).refine(isValidTimeZone, "Timezone is invalid."),
}).strict();

function isBase64UrlBytes(value: string, expectedBytes: number) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return false;
  try {
    return Buffer.from(value, "base64url").byteLength === expectedBytes;
  } catch {
    return false;
  }
}

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(4096).refine((value) => value.startsWith("https://"), "Push endpoint must use HTTPS."),
  expirationTime: z.number().int().positive().nullable().optional(),
  keys: z.object({
    p256dh: z.string().refine((value) => isBase64UrlBytes(value, 65), "Push encryption key is invalid."),
    auth: z.string().refine((value) => isBase64UrlBytes(value, 16), "Push authentication key is invalid."),
  }).strict(),
}).strict();

export const deletePushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(4096).refine((value) => value.startsWith("https://"), "Push endpoint must use HTTPS.").optional(),
}).strict();

export type NotificationPreference = {
  cadence: NotificationCadence;
  timezone: string;
};

export const defaultNotificationPreference: NotificationPreference = { cadence: "off", timezone: "UTC" };

export function getNotificationConfiguration(environment: Record<string, string | undefined> = process.env) {
  const server = getNotificationServerConfiguration(environment);
  return { configured: server.configured, publicKey: server.configured ? server.publicKey : "" };
}

export function getNotificationServerConfiguration(environment: Record<string, string | undefined> = process.env) {
  const publicKey = environment.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = environment.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = environment.WEB_PUSH_SUBJECT?.trim() ?? "";
  const publicKeyValid = isBase64UrlBytes(publicKey, 65) && Buffer.from(publicKey, "base64url")[0] === 4;
  const privateKeyValid = isBase64UrlBytes(privateKey, 32);
  const subjectValid = subject.startsWith("mailto:") || subject.startsWith("https://");
  const configured = publicKeyValid && privateKeyValid && subjectValid;
  return {
    configured,
    publicKey: configured ? publicKey : "",
    privateKey: configured ? privateKey : "",
    subject: configured ? subject : "",
  };
}

export async function readNotificationPreference(db: Client, sessionId: string): Promise<NotificationPreference> {
  const result = await db.execute({ sql: "SELECT cadence, timezone FROM notification_preferences WHERE session_id = ?", args: [sessionId] });
  const row = result.rows[0];
  const cadence = notificationCadenceSchema.safeParse(row?.cadence);
  const timezone = typeof row?.timezone === "string" && isValidTimeZone(row.timezone) ? row.timezone : "UTC";
  return row && cadence.success ? { cadence: cadence.data, timezone } : defaultNotificationPreference;
}

export async function writeNotificationPreference(db: Client, sessionId: string, preference: NotificationPreference) {
  const parsed = notificationPreferenceSchema.parse(preference);
  const now = new Date().toISOString();
  const transaction = await db.transaction("write");
  try {
    if (parsed.cadence === "off") {
      await transaction.batch([
        { sql: "DELETE FROM notification_deliveries WHERE subscription_id IN (SELECT id FROM push_subscriptions WHERE session_id = ?)", args: [sessionId] },
        { sql: "DELETE FROM push_subscriptions WHERE session_id = ?", args: [sessionId] },
      ]);
    }
    await transaction.execute({
      sql: "INSERT INTO notification_preferences (session_id, cadence, timezone, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET cadence = excluded.cadence, timezone = excluded.timezone, updated_at = excluded.updated_at",
      args: [sessionId, parsed.cadence, parsed.timezone, now],
    });
    await transaction.commit();
    return parsed;
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    transaction.close();
  }
}

export async function savePushSubscription(db: Client, sessionId: string, input: z.infer<typeof pushSubscriptionSchema>) {
  const subscription = pushSubscriptionSchema.parse(input);
  const existing = await db.execute({ sql: "SELECT id FROM push_subscriptions WHERE endpoint = ?", args: [subscription.endpoint] });
  const id = existing.rows[0]?.id ? String(existing.rows[0].id) : randomUUID();
  const now = new Date().toISOString();
  const transaction = await db.transaction("write");
  try {
    if (existing.rows[0]) {
      await transaction.execute({ sql: "DELETE FROM notification_deliveries WHERE subscription_id = ?", args: [id] });
      await transaction.execute({
        sql: "UPDATE push_subscriptions SET session_id = ?, p256dh = ?, auth = ?, expiration_time = ?, updated_at = ? WHERE id = ?",
        args: [sessionId, subscription.keys.p256dh, subscription.keys.auth, subscription.expirationTime ?? null, now, id],
      });
    } else {
      await transaction.execute({
        sql: "INSERT INTO push_subscriptions (id, session_id, endpoint, p256dh, auth, expiration_time, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        args: [id, sessionId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, subscription.expirationTime ?? null, now, now],
      });
    }
    await transaction.commit();
    return id;
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    transaction.close();
  }
}

export async function deletePushSubscriptions(db: Client, sessionId: string, endpoint?: string) {
  const subscriptions = await db.execute(endpoint ? {
    sql: "SELECT id FROM push_subscriptions WHERE session_id = ? AND endpoint = ?",
    args: [sessionId, endpoint],
  } : {
    sql: "SELECT id FROM push_subscriptions WHERE session_id = ?",
    args: [sessionId],
  });
  const ids = subscriptions.rows.map((row) => String(row.id));
  if (!ids.length) return 0;
  const placeholders = ids.map(() => "?").join(", ");
  await db.batch([
    { sql: `DELETE FROM notification_deliveries WHERE subscription_id IN (${placeholders})`, args: ids },
    endpoint ? { sql: "DELETE FROM push_subscriptions WHERE session_id = ? AND endpoint = ?", args: [sessionId, endpoint] } : { sql: "DELETE FROM push_subscriptions WHERE session_id = ?", args: [sessionId] },
  ], "write");
  return ids.length;
}
