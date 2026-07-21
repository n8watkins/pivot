import { NextResponse } from "next/server";
import { recordClosedLoop } from "@/lib/domain";
import { closedLoopInputSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = closedLoopInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid closed-loop event" }, { status: 400 });
  try { await recordClosedLoop(parsed.data); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not record event" }, { status: 400 }); }
  return NextResponse.json({ recorded: true });
}
