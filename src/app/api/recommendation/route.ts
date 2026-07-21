import { NextResponse } from "next/server";
import { deterministicFallback, hasHighRiskContext, parseRecommendation, type ReplacementOption } from "@/lib/recommendation";
import { ensureSession } from "@/lib/session";

const inputSchema = { replacements: Array.isArray };

export async function POST(request: Request) {
  await ensureSession();
  const body = await request.json().catch(() => ({}));
  const replacements = (body.replacements ?? []) as ReplacementOption[];
  const context = String(body.context ?? "");
  if (!inputSchema.replacements(replacements) || replacements.length === 0) return NextResponse.json({ error: "At least one replacement is required" }, { status: 400 });
  if (hasHighRiskContext(context)) return NextResponse.json({ safety: "review", route: "support" }, { status: 200 });
  let recommendation = deterministicFallback(replacements);
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(3500), body: JSON.stringify({ contents: [{ parts: [{ text: `Choose only from these approved replacements: ${JSON.stringify(replacements)}. Context: ${context}. Return JSON with replacementId, reason, firstStep, alternatives (max 2 ids), safety (safe|review|blocked).` }] }], generationConfig: { responseMimeType: "application/json" } }) });
      const payload = await response.json();
      const raw = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = raw ? parseRecommendation(JSON.parse(raw), replacements) : null;
      if (parsed) recommendation = parsed;
    } catch { /* Deterministic fallback is the intended failure mode. */ }
  }
  return NextResponse.json({ ...recommendation, source: apiKey ? "gemini-or-fallback" : "fallback" });
}
