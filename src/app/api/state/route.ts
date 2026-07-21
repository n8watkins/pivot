import { NextResponse } from "next/server";
import { getSnapshot, saveSetup } from "@/lib/domain";
import { pivotsInputSchema, setupInputSchema } from "@/lib/schemas";

export async function GET() { return NextResponse.json(await getSnapshot()); }

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const pivots = pivotsInputSchema.safeParse(body.pivots);
  if (pivots.success) {
    await saveSetup(pivots.data.map((pivot) => pivot.goal), pivots.data.flatMap((pivot) => pivot.replacements), pivots.data);
    return NextResponse.json({ saved: true });
  }
  const parsed = setupInputSchema.safeParse({ ...body, goals: body.goals ?? (typeof body.goal === "string" ? [body.goal] : undefined) });
  if (!parsed.success) return NextResponse.json({ error: "Invalid setup" }, { status: 400 });
  await saveSetup(parsed.data.goals, parsed.data.replacements);
  return NextResponse.json({ saved: true });
}
