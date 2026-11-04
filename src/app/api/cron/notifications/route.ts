import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { deliverDueNotifications } from "@/lib/notification-delivery";
import { getNotificationServerConfiguration } from "@/lib/notifications";
import { getDatabase, initializeDatabase } from "@/lib/session";
import { purgeDeleted } from "@/lib/trash";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.byteLength === expected.byteLength && timingSafeEqual(provided, expected);
}

// Soft-deleted items whose Undo toast never reported back (a closed tab) are removed here.
async function purgeExpiredDeletions() {
  try {
    const db = getDatabase();
    if (!db) return;
    await initializeDatabase();
    await purgeDeleted(db);
  } catch {
    // The next hourly run tries again; check-in delivery must not depend on it.
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  await purgeExpiredDeletions();
  if (!getNotificationServerConfiguration().configured) return NextResponse.json({ error: "Web Push is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const db = getDatabase();
  if (!db) return NextResponse.json({ error: "Persistent storage is required." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  try {
    await initializeDatabase();
    const result = await deliverDueNotifications(db);
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Notification delivery failed." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
