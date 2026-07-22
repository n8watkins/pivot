import { NextResponse } from "next/server";
import { auth, isAuthConfigured } from "@/auth";
import { ensureSession, getDatabase, leaveAccountSession } from "@/lib/session";
import { rejectCrossOriginMutation } from "@/lib/request-security";
import { isRateLimited, rateLimitResponse } from "@/lib/rate-limit";

export async function GET() {
  if (!isAuthConfigured) return NextResponse.json({ configured: false, authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  const session = await auth();
  return NextResponse.json({ configured: true, authenticated: Boolean(session?.user?.githubId), user: session?.user ? { login: session.user.githubLogin, name: session.user.name, image: session.user.image } : null }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const rejected = rejectCrossOriginMutation(request);
  if (rejected) return rejected;
  const sessionId = await ensureSession();
  if (await isRateLimited(`account:${sessionId}`, 10, { database: getDatabase() })) return rateLimitResponse();
  await leaveAccountSession();
  return NextResponse.json({ ok: true });
}
