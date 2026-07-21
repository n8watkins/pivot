import { NextResponse } from "next/server";
import { recordClosedLoop } from "@/lib/domain";
import { closedLoopInputSchema } from "@/lib/schemas";
import { ensureSession } from "@/lib/session";
import { isRateLimited, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const sessionId = await ensureSession();
  if (isRateLimited(`closed-loop:${sessionId}`, 30)) return rateLimitResponse();
  const body = await request.json().catch(() => ({}));
  const parsed = closedLoopInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid closed-loop event" }, { status: 400 });
  try { return NextResponse.json({ recorded: true, eventId: await recordClosedLoop(parsed.data) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not record event" }, { status: 400 }); }
}
