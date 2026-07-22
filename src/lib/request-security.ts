import { NextResponse } from "next/server";

export function rejectCrossOriginMutation(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  if (origin === new URL(request.url).origin) return null;
  return NextResponse.json({ error: "Cross-origin mutation rejected." }, { status: 403 });
}
