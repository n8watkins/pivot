import { NextResponse } from "next/server";
import { deleteEvent, ensureSession, getDatabase, recordEvent } from "@/lib/session";
import { eventInputSchema } from "@/lib/schemas";
import { isRateLimited, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const sessionId = await ensureSession();
  if (await isRateLimited(`events:${sessionId}`, 60, { database: getDatabase() })) return rateLimitResponse();
  const body = await request.json().catch(() => ({}));
  const parsed = eventInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  return NextResponse.json({ eventId: await recordEvent(parsed.data.type, parsed.data.payload) });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Event id is required" }, { status: 400 });
  await deleteEvent(id);
  return NextResponse.json({ deleted: true });
}
