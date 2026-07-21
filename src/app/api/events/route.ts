import { NextResponse } from "next/server";
import { deleteEvent, recordEvent } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const type = typeof body.type === "string" ? body.type : "unknown";
  const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
  return NextResponse.json({ eventId: await recordEvent(type, payload) });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Event id is required" }, { status: 400 });
  await deleteEvent(id);
  return NextResponse.json({ deleted: true });
}
