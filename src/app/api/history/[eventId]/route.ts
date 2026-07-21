import { NextResponse } from "next/server";
import { deleteHistoryEvent } from "@/lib/domain";

export async function DELETE(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const deleted = await deleteHistoryEvent(eventId);
  return deleted ? NextResponse.json({ deleted: true }) : NextResponse.json({ error: "History event not found." }, { status: 404 });
}
