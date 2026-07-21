import { NextResponse } from "next/server";
import { deleteContextTag, saveContextTag } from "@/lib/domain";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.label !== "string" || body.label.trim().length < 2 || body.label.trim().length > 40) return NextResponse.json({ error: "Tag must be between 2 and 40 characters." }, { status: 400 });
  await saveContextTag(body.label);
  return NextResponse.json({ saved: true });
}

export async function DELETE(request: Request) {
  const label = new URL(request.url).searchParams.get("label");
  if (!label) return NextResponse.json({ error: "Tag is required." }, { status: 400 });
  await deleteContextTag(label);
  return NextResponse.json({ deleted: true });
}
