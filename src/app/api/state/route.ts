import { NextResponse } from "next/server";
import { getSnapshot, saveSetup } from "@/lib/domain";
import { pivotsInputSchema, setupInputSchema } from "@/lib/schemas";
import { rejectCrossOriginMutation } from "@/lib/request-security";
import { ensureSession, getDatabase } from "@/lib/session";
import { isRateLimited, rateLimitResponse } from "@/lib/rate-limit";

export async function GET() { return NextResponse.json(await getSnapshot(), { headers: { "Cache-Control": "no-store" } }); }

export async function POST(request: Request) {
  const rejected = rejectCrossOriginMutation(request);
  if (rejected) return rejected;
  const sessionId = await ensureSession();
  if (await isRateLimited(`state:${sessionId}`, 20, { database: getDatabase() })) return rateLimitResponse();
  const body = await request.json().catch(() => ({}));
  const pivots = pivotsInputSchema.safeParse(body.pivots);
  if (pivots.success) {
    if (!await saveSetup(pivots.data.map((pivot) => pivot.goal), pivots.data.flatMap((pivot) => pivot.replacements), pivots.data)) return NextResponse.json({ error: "Finish the active action before replacing your setup." }, { status: 409 });
    return NextResponse.json({ saved: true });
  }
  const parsed = setupInputSchema.safeParse({ ...body, goals: body.goals ?? (typeof body.goal === "string" ? [body.goal] : undefined) });
  if (!parsed.success) return NextResponse.json({ error: "Invalid setup" }, { status: 400 });
  if (!await saveSetup(parsed.data.goals, parsed.data.replacements)) return NextResponse.json({ error: "Finish the active action before replacing your setup." }, { status: 409 });
  return NextResponse.json({ saved: true });
}
