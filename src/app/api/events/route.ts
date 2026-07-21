import { NextResponse } from "next/server";
import { deleteEvent, recordEvent } from "@/lib/session";
import { eventInputSchema } from "@/lib/schemas";

export async function POST(request: Request) {
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
