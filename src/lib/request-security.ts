import { NextResponse } from "next/server";

export function rejectCrossOriginMutation(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const originUrl = new URL(origin);
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (originUrl.origin === requestUrl.origin || originUrl.host === forwardedHost) return null;
  return NextResponse.json({ error: "Cross-origin mutation rejected." }, { status: 403 });
}
