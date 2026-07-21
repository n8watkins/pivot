import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSnapshot, saveSetup } from "@/lib/domain";
import { pivotInputSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = pivotInputSchema.omit({ id: true }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "A name and at least one action are required." }, { status: 400 });
  const snapshot = await getSnapshot();
  const pivot = { id: `pivot-${randomUUID()}`, ...parsed.data };
  const pivots = [...snapshot.pivots, pivot];
  await saveSetup(pivots.map((item) => item.goal), pivots.flatMap((item) => item.replacements), pivots);
  return NextResponse.json({ pivot }, { status: 201 });
}
