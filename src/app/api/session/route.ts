import { NextResponse } from "next/server";
import { deleteSession, ensureSession } from "@/lib/session";
import { clearMemoryPivotState } from "@/lib/domain";

export async function GET() { return NextResponse.json({ sessionId: await ensureSession() }); }
export async function DELETE() { const sessionId = await ensureSession(); clearMemoryPivotState(sessionId); await deleteSession(); return NextResponse.json({ deleted: true }); }
