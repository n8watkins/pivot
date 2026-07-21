import { NextResponse } from "next/server";
import { getSnapshot, saveSetup } from "@/lib/domain";
import { pivotInputSchema } from "@/lib/schemas";

type RouteContext = { params: Promise<{ pivotId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { pivotId } = await context.params;
  const snapshot = await getSnapshot();
  if (!snapshot.pivots.some((pivot) => pivot.id === pivotId)) return NextResponse.json({ error: "Pivot not found." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const parsed = pivotInputSchema.safeParse({ ...body, id: pivotId });
  if (!parsed.success) return NextResponse.json({ error: "A name and at least one action are required." }, { status: 400 });
  const pivots = snapshot.pivots.map((pivot) => pivot.id === pivotId ? parsed.data : pivot);
  await saveSetup(pivots.map((item) => item.goal), pivots.flatMap((item) => item.replacements), pivots);
  return NextResponse.json({ pivot: parsed.data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { pivotId } = await context.params;
  const snapshot = await getSnapshot();
  if (!snapshot.pivots.some((pivot) => pivot.id === pivotId)) return NextResponse.json({ error: "Pivot not found." }, { status: 404 });
  const pivots = snapshot.pivots.filter((pivot) => pivot.id !== pivotId);
  await saveSetup(pivots.map((item) => item.goal), pivots.flatMap((item) => item.replacements), pivots);
  return NextResponse.json({ deleted: true });
}
