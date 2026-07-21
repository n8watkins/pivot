import { NextResponse } from "next/server";
import { getSnapshot, saveSetup } from "@/lib/domain";

export async function GET() { return NextResponse.json(await getSnapshot()); }

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.goal !== "string" || !Array.isArray(body.replacements) || body.replacements.length < 3 || body.replacements.length > 5) return NextResponse.json({ error: "Invalid setup" }, { status: 400 });
  await saveSetup(body.goal, body.replacements);
  return NextResponse.json({ saved: true });
}
