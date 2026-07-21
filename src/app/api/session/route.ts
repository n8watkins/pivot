import { NextResponse } from "next/server";
import { deleteSession, ensureSession } from "@/lib/session";

export async function GET() { return NextResponse.json({ sessionId: await ensureSession() }); }
export async function DELETE() { await deleteSession(); return NextResponse.json({ deleted: true }); }
