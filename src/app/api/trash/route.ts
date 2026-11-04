import { NextResponse } from "next/server";
import { z } from "zod";
import { finalizeDeletedItem, restoreDeletedItem } from "@/lib/domain";
import { isRateLimited, rateLimitResponse } from "@/lib/rate-limit";
import { rejectCrossOriginMutation } from "@/lib/request-security";
import { ensureSession, getDatabase } from "@/lib/session";
import { trashKinds } from "@/lib/trash";

// The two endings of a "Deleted · Undo" toast: restore brings the soft-deleted item back,
// finalize removes it for good once the toast has closed.
const trashActionSchema = z.object({
  action: z.enum(["restore", "finalize"]),
  kind: z.enum(trashKinds as [string, ...string[]]).transform((kind) => kind as (typeof trashKinds)[number]),
  id: z.string().trim().min(1).max(200),
});

export async function POST(request: Request) {
  const rejected = rejectCrossOriginMutation(request);
  if (rejected) return rejected;
  const sessionId = await ensureSession();
  if (await isRateLimited(`trash:${sessionId}`, 60, { database: getDatabase() })) return rateLimitResponse();
  const parsed = trashActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That request is invalid." }, { status: 400 });
  const { action, kind, id } = parsed.data;
  if (action === "finalize") {
    await finalizeDeletedItem(kind, id);
    return NextResponse.json({ finalized: true });
  }
  const restored = await restoreDeletedItem(kind, id);
  return restored ? NextResponse.json({ restored: true }) : NextResponse.json({ error: "It can no longer be restored." }, { status: 410 });
}
