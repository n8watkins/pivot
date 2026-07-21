import { NextResponse } from "next/server";
import { recordClosedLoop } from "@/lib/domain";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.replacementId !== "string" || typeof body.outcome !== "string") return NextResponse.json({ error: "Invalid closed-loop event" }, { status: 400 });
  await recordClosedLoop({
    replacementId: body.replacementId,
    intensity: Number(body.intensity) || 1,
    contextType: typeof body.contextType === "string" ? body.contextType.slice(0, 80) : "",
    reason: typeof body.reason === "string" ? body.reason.slice(0, 180) : "",
    firstStep: typeof body.firstStep === "string" ? body.firstStep.slice(0, 240) : "",
    source: typeof body.source === "string" ? body.source : "fallback",
    outcome: body.outcome.slice(0, 120),
    helpful: Boolean(body.helpful),
  });
  return NextResponse.json({ recorded: true });
}
