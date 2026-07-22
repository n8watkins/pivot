import { NextResponse } from "next/server";
import { deleteSession, ensureSession, getDatabase } from "@/lib/session";
import { clearMemoryPivotState } from "@/lib/domain";
import { rejectCrossOriginMutation } from "@/lib/request-security";
import { isRateLimited, rateLimitResponse } from "@/lib/rate-limit";

export async function GET() { return NextResponse.json({ sessionId: await ensureSession() }); }
export async function DELETE(request: Request) { const rejected = rejectCrossOriginMutation(request); if (rejected) return rejected; const sessionId = await ensureSession(); if (await isRateLimited(`session:${sessionId}`, 5, { database: getDatabase() })) return rateLimitResponse(); clearMemoryPivotState(sessionId); await deleteSession(); return NextResponse.json({ deleted: true }); }
