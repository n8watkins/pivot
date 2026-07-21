import { NextResponse } from "next/server";
import { startIntervention } from "@/lib/domain";
import { ensureSession } from "@/lib/session";
import { isRateLimited, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const sessionId = await ensureSession();
  if (isRateLimited(`intervention:${sessionId}`, 30)) return rateLimitResponse();
  const body = await request.json().catch(() => ({}));
  if (typeof body.replacementId !== "string") return NextResponse.json({ error: "Replacement is required" }, { status: 400 });
  try { return NextResponse.json({ active: await startIntervention(body.replacementId) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start intervention" }, { status: 400 }); }
}
