import { NextResponse } from "next/server";
import { deletePivot, updatePivot } from "@/lib/domain";
import { pivotInputSchema } from "@/lib/schemas";
import { ensureSession, getDatabase } from "@/lib/session";
import { isRateLimited, rateLimitResponse } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ pivotId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const sessionId = await ensureSession();
  if (await isRateLimited(`pivots:${sessionId}`, 30, { database: getDatabase() })) return rateLimitResponse();
  const { pivotId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = pivotInputSchema.safeParse({ ...body, id: pivotId });
  if (!parsed.success) return NextResponse.json({ error: "A name and at least one action are required." }, { status: 400 });
  if (!await updatePivot(parsed.data)) return NextResponse.json({ error: "Pivot not found." }, { status: 404 });
  return NextResponse.json({ pivot: parsed.data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const sessionId = await ensureSession();
  if (await isRateLimited(`pivots:${sessionId}`, 30, { database: getDatabase() })) return rateLimitResponse();
  const { pivotId } = await context.params;
  if (!await deletePivot(pivotId)) return NextResponse.json({ error: "Pivot not found." }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
