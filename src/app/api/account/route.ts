import { NextResponse } from "next/server";
import { auth, isAuthConfigured } from "@/auth";
import { leaveAccountSession } from "@/lib/session";

export async function GET() {
  if (!isAuthConfigured) return NextResponse.json({ configured: false, authenticated: false });
  const session = await auth();
  return NextResponse.json({ configured: true, authenticated: Boolean(session?.user?.githubId), user: session?.user ? { login: session.user.githubLogin, name: session.user.name, image: session.user.image } : null });
}

export async function POST() {
  await leaveAccountSession();
  return NextResponse.json({ ok: true });
}
