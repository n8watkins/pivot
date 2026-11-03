import { NextResponse } from "next/server";
import { deletePushSubscriptionSchema, deletePushSubscriptions, getNotificationConfiguration, pushSubscriptionSchema, savePushSubscription } from "@/lib/notifications";
import { isRateLimited, rateLimitResponse } from "@/lib/rate-limit";
import { rejectCrossOriginMutation } from "@/lib/request-security";
import { ensureSession, getDatabase } from "@/lib/session";

export async function POST(request: Request) {
  const rejected = rejectCrossOriginMutation(request);
  if (rejected) return rejected;
  const sessionId = await ensureSession();
  const db = getDatabase();
  if (await isRateLimited(`notification-subscriptions:${sessionId}`, 20, { database: db })) return rateLimitResponse();
  if (!db || !getNotificationConfiguration().configured) return NextResponse.json({ error: "Notifications are not configured." }, { status: 503 });
  const parsed = pushSubscriptionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Push subscription is invalid." }, { status: 400 });
  const id = await savePushSubscription(db, sessionId, parsed.data);
  return NextResponse.json({ saved: true, id }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const rejected = rejectCrossOriginMutation(request);
  if (rejected) return rejected;
  const sessionId = await ensureSession();
  const db = getDatabase();
  if (await isRateLimited(`notification-subscriptions:${sessionId}`, 20, { database: db })) return rateLimitResponse();
  if (!db) return NextResponse.json({ deleted: true, count: 0 }, { headers: { "Cache-Control": "no-store" } });
  const body = await request.json().catch(() => ({}));
  const parsed = deletePushSubscriptionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Push subscription is invalid." }, { status: 400 });
  const count = await deletePushSubscriptions(db, sessionId, parsed.data.endpoint);
  return NextResponse.json({ deleted: true, count }, { headers: { "Cache-Control": "no-store" } });
}
