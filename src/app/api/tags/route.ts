import { NextResponse } from "next/server";
import { deleteContextTag, saveContextTag } from "@/lib/domain";
import { ensureSession, getDatabase } from "@/lib/session";
import { isRateLimited, rateLimitResponse } from "@/lib/rate-limit";
import { contextTagSchema } from "@/lib/schemas";
import { defaultContextTags } from "@/components/pivot/data";

export async function POST(request: Request) {
  const sessionId = await ensureSession();
  if (await isRateLimited(`tags:${sessionId}`, 30, { database: getDatabase() })) return rateLimitResponse();
  const body = await request.json().catch(() => ({}));
  const parsed = contextTagSchema.safeParse(body.label);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Tag is invalid." }, { status: 400 });
  if (defaultContextTags.some((tag) => tag.toLowerCase() === parsed.data.toLowerCase())) return NextResponse.json({ error: "That tag is already available." }, { status: 409 });
  await saveContextTag(parsed.data);
  return NextResponse.json({ saved: true, label: parsed.data });
}

export async function DELETE(request: Request) {
  const sessionId = await ensureSession();
  if (await isRateLimited(`tags:${sessionId}`, 30, { database: getDatabase() })) return rateLimitResponse();
  const label = new URL(request.url).searchParams.get("label");
  const parsed = contextTagSchema.safeParse(label);
  if (!parsed.success) return NextResponse.json({ error: "Tag is invalid." }, { status: 400 });
  await deleteContextTag(parsed.data);
  return NextResponse.json({ deleted: true });
}
