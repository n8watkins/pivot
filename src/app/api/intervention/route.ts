import { NextResponse } from "next/server";
import { startIntervention } from "@/lib/domain";
import { ensureSession, getDatabase } from "@/lib/session";
import { isRateLimited, rateLimitResponse } from "@/lib/rate-limit";
import { interventionInputSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const sessionId = await ensureSession();
  if (await isRateLimited(`intervention:${sessionId}`, 30, { database: getDatabase() })) return rateLimitResponse();
  const body = await request.json().catch(() => ({}));
  const parsed = interventionInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Pivot and replacement are required" }, { status: 400 });
  try { return NextResponse.json({ active: await startIntervention(parsed.data) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start intervention" }, { status: 400 }); }
}
