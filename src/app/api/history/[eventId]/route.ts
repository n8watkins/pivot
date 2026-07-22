import { NextResponse } from "next/server";
import { deleteHistoryEvent } from "@/lib/domain";
import { rejectCrossOriginMutation } from "@/lib/request-security";
import { ensureSession, getDatabase } from "@/lib/session";
import { isRateLimited, rateLimitResponse } from "@/lib/rate-limit";

export async function DELETE(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const rejected = rejectCrossOriginMutation(request);
  if (rejected) return rejected;
  const sessionId = await ensureSession();
  if (await isRateLimited(`history:${sessionId}`, 30, { database: getDatabase() })) return rateLimitResponse();
  const { eventId } = await params;
  const deleted = await deleteHistoryEvent(eventId);
  return deleted ? NextResponse.json({ deleted: true }) : NextResponse.json({ error: "History event not found." }, { status: 404 });
}
