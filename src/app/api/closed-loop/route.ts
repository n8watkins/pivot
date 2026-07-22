import { NextResponse } from "next/server";
import { recordClosedLoop } from "@/lib/domain";
import { closedLoopInputSchema } from "@/lib/schemas";
import { ensureSession, getDatabase } from "@/lib/session";
import { isRateLimited, rateLimitResponse } from "@/lib/rate-limit";
import { rejectCrossOriginMutation } from "@/lib/request-security";

export async function POST(request: Request) {
  const rejected = rejectCrossOriginMutation(request);
  if (rejected) return rejected;
  const sessionId = await ensureSession();
  if (await isRateLimited(`closed-loop:${sessionId}`, 30, { database: getDatabase() })) return rateLimitResponse();
  const body = await request.json().catch(() => ({}));
  const parsed = closedLoopInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid closed-loop event" }, { status: 400 });
  try { return NextResponse.json({ recorded: true, eventId: await recordClosedLoop(parsed.data) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not record event" }, { status: 400 }); }
}
