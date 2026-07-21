import { NextResponse } from "next/server";
import { getSnapshot, saveSetup } from "@/lib/domain";
import { setupInputSchema } from "@/lib/schemas";

export async function GET() { return NextResponse.json(await getSnapshot()); }

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = setupInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid setup" }, { status: 400 });
  await saveSetup(parsed.data.goal, parsed.data.replacements);
  return NextResponse.json({ saved: true });
}
