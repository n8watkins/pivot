import { NextResponse } from "next/server";
import { deterministicFallback, interpretGeminiPayload, type ReplacementOption } from "@/lib/recommendation";
import { assessSafety, type CrisisCategory } from "@/lib/crisis";
import { ensureSession, getDatabase } from "@/lib/session";
import { getSnapshot } from "@/lib/domain";
import { recommendationInputSchema } from "@/lib/schemas";
import { GEMINI_ENDPOINT, buildGeminiRequest } from "@/lib/gemini";
import { isRateLimited, rateLimitResponse } from "@/lib/rate-limit";
import { networkRateLimitKey, rejectCrossOriginMutation } from "@/lib/request-security";

function supportResponse(categories: CrisisCategory[] = ["suicide"]) { return NextResponse.json({ safety: "review", route: "support", categories }, { status: 200 }); }

export async function POST(request: Request) {
  const rejected = rejectCrossOriginMutation(request);
  if (rejected) return rejected;
  const sessionId = await ensureSession();
  const body = await request.json().catch(() => ({}));
  const parsedInput = recommendationInputSchema.safeParse(body);
  if (!parsedInput.success) return NextResponse.json({ error: "Invalid recommendation input" }, { status: 400 });
  // Safety routing comes first and does not depend on stored data or rate limits.
  const context = parsedInput.data.context;
  const assessment = assessSafety(context);
  if (assessment.route === "crisis") return supportResponse(assessment.categories);
  if (assessment.route === "specialized") return NextResponse.json({ safety: "review", route: "specialized", categories: assessment.categories }, { status: 200 });
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
      const startedAt = Date.now();
      const response = await fetch(GEMINI_ENDPOINT, buildGeminiRequest(prompt, apiKey));
      const payload = await response.json().catch(() => null);
      // Log only the status and timing, never the note or the response text.
      if (!response.ok) console.warn(`Gemini returned HTTP ${response.status} after ${Date.now() - startedAt} ms; using the built-in suggestion.`);
      const outcome = interpretGeminiPayload(response.ok ? payload : null, replacements);
      if (outcome.kind === "support") return supportResponse();
      if (outcome.kind === "recommendation") { recommendation = outcome.recommendation; source = "gemini"; }
    } catch (error) {
      // Deterministic fallback is the intended failure mode.
      console.warn(`Gemini request failed (${error instanceof Error ? error.name : "unknown"}); using the built-in suggestion.`);
    }
  }
  return NextResponse.json({ ...recommendation, source });
}
