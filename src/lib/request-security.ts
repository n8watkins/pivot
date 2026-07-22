import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

export function rejectCrossOriginMutation(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  let originUrl: URL;
  try { originUrl = new URL(origin); } catch { return NextResponse.json({ error: "Cross-origin mutation rejected." }, { status: 403 }); }
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? requestUrl.protocol.slice(0, -1);
  const publicOrigin = forwardedHost ? `${forwardedProtocol}://${forwardedHost}` : requestUrl.origin;
  if (originUrl.origin === publicOrigin) return null;
  return NextResponse.json({ error: "Cross-origin mutation rejected." }, { status: 403 });
}

export function networkRateLimitKey(request: Request, scope: string) {
  const forwarded = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for");
  const address = forwarded?.split(",")[0]?.trim();
  if (!address) return null;
  return `${scope}:network:${createHash("sha256").update(address).digest("hex").slice(0, 24)}`;
}
