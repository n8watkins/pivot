import { NextResponse } from "next/server";
import { deterministicFallback, hasHighRiskContext, hasUnsupportedContext, interpretGeminiPayload, type ReplacementOption } from "@/lib/recommendation";
import { ensureSession, getDatabase } from "@/lib/session";
import { getSnapshot } from "@/lib/domain";
import { recommendationInputSchema } from "@/lib/schemas";
import { isRateLimited, rateLimitResponse } from "@/lib/rate-limit";
import { networkRateLimitKey, rejectCrossOriginMutation } from "@/lib/request-security";

function supportResponse() { return NextResponse.json({ safety: "review", route: "support" }, { status: 200 }); }

export async function POST(request: Request) {
  const rejected = rejectCrossOriginMutation(request);
  if (rejected) return rejected;
  const sessionId = await ensureSession();
  const body = await request.json().catch(() => ({}));
  const parsedInput = recommendationInputSchema.safeParse(body);
  if (!parsedInput.success) return NextResponse.json({ error: "Invalid recommendation input" }, { status: 400 });
  // Safety routing comes first and does not depend on stored data or rate limits.
  const context = parsedInput.data.context;
  if (hasHighRiskContext(context)) return supportResponse();
  if (hasUnsupportedContext(context)) return NextResponse.json({ safety: "review", route: "specialized" }, { status: 200 });
  // Rate limits apply to recommendations only, never to showing crisis resources.
  const database = getDatabase();
  if (await isRateLimited(`recommendation:${sessionId}`, 20, { database })) return rateLimitResponse();
  const networkKey = networkRateLimitKey(request, "recommendation");
  if (networkKey && await isRateLimited(networkKey, 40, { database })) return rateLimitResponse();
  const snapshot = await getSnapshot();
  if (getDatabase() && snapshot.replacements.length === 0) return NextResponse.json({ error: "Complete setup before requesting a recommendation" }, { status: 409 });
  const pivot = snapshot.pivots.find((item) => item.id === parsedInput.data.pivotId);
  if (getDatabase() && !pivot) return NextResponse.json({ error: "Pivot not found" }, { status: 404 });
  const replacements = (pivot?.replacements ?? parsedInput.data.replacements) as ReplacementOption[];
  const history = snapshot.history.filter((event) => event.pivotId === parsedInput.data.pivotId).map((event) => ({ replacementId: event.replacementId, helpful: event.helpful, contextType: event.contextType }));
  const rankingContext = { tag: parsedInput.data.tag, intensity: parsedInput.data.intensity, hour: parsedInput.data.hour };
  let source: "gemini" | "fallback" = "fallback";
  let recommendation = deterministicFallback(replacements, history, rankingContext);
  const apiKey = process.env.GEMINI_API_KEY;
  const geminiEnabled = process.env.ENABLE_GEMINI_RECOMMENDATIONS === "true";
  if (apiKey && geminiEnabled) {
    try {
      const signals = [
        rankingContext.intensity ? `Urge intensity: ${rankingContext.intensity}/10.` : "",
        typeof rankingContext.hour === "number" ? `Local hour: ${rankingContext.hour}.` : "",
        `Rule-based pick for this context: ${recommendation.replacementId}.`,
      ].filter(Boolean).join(" ");
      const prompt = `Choose only from these approved replacements: ${JSON.stringify(replacements)}. Context: ${context || "none given"}. ${signals} Return JSON with replacementId, reason, firstStep, alternatives (max 2 ids), safety (safe|review|blocked). Write reason as one short, kind sentence to the user that refers to what they shared (under 140 characters). Set safety to blocked if the context mentions suicide, self-harm, wanting to die, or danger to anyone.`;
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(3500), body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }) });
      const outcome = interpretGeminiPayload(await response.json(), replacements);
      if (outcome.kind === "support") return supportResponse();
      if (outcome.kind === "recommendation") { recommendation = outcome.recommendation; source = "gemini"; }
    } catch { /* Deterministic fallback is the intended failure mode. */ }
  }
  return NextResponse.json({ ...recommendation, source });
}
