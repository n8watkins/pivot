import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createPivot } from "@/lib/domain";
import { pivotInputSchema } from "@/lib/schemas";
import { ensureSession, getDatabase } from "@/lib/session";
import { isRateLimited, rateLimitResponse } from "@/lib/rate-limit";
import { rejectCrossOriginMutation } from "@/lib/request-security";

export async function POST(request: Request) {
  const rejected = rejectCrossOriginMutation(request);
  if (rejected) return rejected;
  const sessionId = await ensureSession();
  if (await isRateLimited(`pivots:${sessionId}`, 30, { database: getDatabase() })) return rateLimitResponse();
  const body = await request.json().catch(() => ({}));
  const parsed = pivotInputSchema.omit({ id: true }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "A name and at least one action are required." }, { status: 400 });
  const pivot = { id: `pivot-${randomUUID()}`, ...parsed.data };
  await createPivot(pivot);
  return NextResponse.json({ pivot }, { status: 201 });
}
