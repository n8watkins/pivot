import { NextResponse } from "next/server";
import { getRuntimeCapabilities } from "@/lib/config";
import { initializeDatabase } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const capabilities = getRuntimeCapabilities();
  try {
    await initializeDatabase();
    const status = capabilities.authPartiallyConfigured ? "degraded" : "ok";
    return NextResponse.json({ status, ...capabilities }, { status: status === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable", ...capabilities }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
