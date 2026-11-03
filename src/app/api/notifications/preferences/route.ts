import { NextResponse } from "next/server";
import { getNotificationConfiguration, notificationPreferenceSchema, readNotificationPreference, writeNotificationPreference } from "@/lib/notifications";
import { isRateLimited, rateLimitResponse } from "@/lib/rate-limit";
import { rejectCrossOriginMutation } from "@/lib/request-security";
import { ensureSession, getDatabase } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessionId = await ensureSession();
  const db = getDatabase();
  const configuration = getNotificationConfiguration();
  const preference = db ? await readNotificationPreference(db, sessionId) : { cadence: "off" as const, timezone: "UTC" };
  return NextResponse.json({ ...preference, available: Boolean(db && configuration.configured), publicKey: db ? configuration.publicKey : "" }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const rejected = rejectCrossOriginMutation(request);
  if (rejected) return rejected;
  const sessionId = await ensureSession();
  const db = getDatabase();
  if (await isRateLimited(`notification-preferences:${sessionId}`, 20, { database: db })) return rateLimitResponse();
  const body = await request.json().catch(() => ({}));
  const parsed = notificationPreferenceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Notification preference is invalid." }, { status: 400 });
  if (!db) return parsed.data.cadence === "off" ? NextResponse.json(parsed.data, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "Notifications require persistent storage." }, { status: 503 });
  if (parsed.data.cadence !== "off" && !getNotificationConfiguration().configured) return NextResponse.json({ error: "Notifications are not configured." }, { status: 503 });
  const preference = await writeNotificationPreference(db, sessionId, parsed.data);
  return NextResponse.json(preference, { headers: { "Cache-Control": "no-store" } });
}
