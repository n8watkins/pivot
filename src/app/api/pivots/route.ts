import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createPivot } from "@/lib/domain";
import { pivotInputSchema } from "@/lib/schemas";
import { ensureSession } from "@/lib/session";
import { isRateLimited, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const sessionId = await ensureSession();
  if (isRateLimited(`pivots:${sessionId}`, 30)) return rateLimitResponse();
  const body = await request.json().catch(() => ({}));
  const parsed = pivotInputSchema.omit({ id: true }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "A name and at least one action are required." }, { status: 400 });
  const pivot = { id: `pivot-${randomUUID()}`, ...parsed.data };
  await createPivot(pivot);
  return NextResponse.json({ pivot }, { status: 201 });
}
