import { z } from "zod";
import { fallbackFirstStep } from "./replacement-copy";

export const recommendationSchema = z.object({
  replacementId: z.string().min(1),
  reason: z.string().min(1).max(180),
  firstStep: z.string().min(1).max(240),
  alternatives: z.array(z.string().min(1)).max(2),
  safety: z.enum(["safe", "review", "blocked"]),
});

export type Recommendation = z.infer<typeof recommendationSchema>;
export type ReplacementOption = { id: string; name: string; detail: string; duration: string };

// Clear self-harm or suicide intent. Each pattern needs a first-person or intent
// phrasing so everyday idioms ("dying to try", "this commute is killing me") pass.
const crisisPatterns = [
  /\bsuicid(e|es|al|ality)\b/,
  /\b(kill|hurt|harm|injure|end)(ing)?\s+myself\b/,
  /\bcut(ting)?\s+myself\b(?!\s+(off|some|a\s+break|loose))/,
  /\bself[- ]?(harm|harming|injury|injure|injuring)\b/,
  /\b(want|wanna|wanted|ready|planning|plan|deserve)\s+(to\s+)?(die|be\s+dead)\b/,
  /\b(wish|wishing)\s+(that\s+)?i\s+(was|were|could\s+be)\s+dead\b/,
  /\bbetter\s+off\s+dead\b/,
  /\b(end|ending|take|taking)\s+my\s+(own\s+)?life\b/,
  /\b(end|ending)\s+it\s+all\b/,
  /\bno\s+reason\s+to\s+(live|keep\s+going|go\s+on)\b/,
  /\bdon'?t\s+want\s+to\s+(live|be\s+alive|exist|wake\s+up|be\s+here\s+any\s*more)\b/,
];
const otherRiskPatterns = /\b(hurt someone|overdose|abuse|illegal|weapon)\b/;
const unsupportedPatterns = /\b(eating disorder|anorexia|bulimia|purging|detox|withdrawal|gambling addiction|substance addiction|domestic violence|psychosis|manic episode)\b/i;

function normalize(input: string) { return input.toLowerCase().replace(/[\u2018\u2019\u02bc]/g, "'").replace(/\s+/g, " "); }

export function hasCrisisLanguage(input: string) {
  const text = normalize(input);
  return crisisPatterns.some((pattern) => pattern.test(text));
}

export function hasHighRiskContext(input: string) { return hasCrisisLanguage(input) || otherRiskPatterns.test(normalize(input)); }
export function hasUnsupportedContext(input: string) { return unsupportedPatterns.test(input); }

export function rankReplacements(options: ReplacementOption[], history: { replacementId: string; helpful: boolean }[] = []) {
  const scores = new Map(options.map((option, index) => [option.id, options.length - index]));
  for (const event of history) scores.set(event.replacementId, (scores.get(event.replacementId) ?? 0) + (event.helpful ? 3 : -2));
  return [...options].sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));
}

export function deterministicFallback(options: ReplacementOption[], history: { replacementId: string; helpful: boolean }[] = []): Recommendation {
  const ranked = rankReplacements(options, history);
  const primary = ranked[0];
  if (!primary) throw new Error("At least one approved replacement is required");
  return {
    replacementId: primary.id,
    reason: "It is an approved option that can change the shape of this moment.",
    firstStep: fallbackFirstStep(primary),
    alternatives: ranked.slice(1, 3).map((option) => option.id),
    safety: "safe",
  };
}

export function parseRecommendation(input: unknown, options: ReplacementOption[]) {
  const result = recommendationSchema.safeParse(input);
  if (!result.success || result.data.safety !== "safe" || !options.some((option) => option.id === result.data.replacementId) || result.data.alternatives.some((id) => !options.some((option) => option.id === id))) return null;
  return result.data;
}

export type GeminiOutcome = { kind: "support" } | { kind: "recommendation"; recommendation: Recommendation } | { kind: "none" };

/**
 * Reads a Gemini generateContent payload. Any safety signal, whether Gemini blocked the
 * prompt, stopped for safety, or flagged the context as "review" or "blocked" in its own
 * structured answer, routes to support instead of a habit suggestion.
 */
export function interpretGeminiPayload(payload: unknown, options: ReplacementOption[]): GeminiOutcome {
  const body = payload as { promptFeedback?: { blockReason?: string }; candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[] } | null;
  if (body?.promptFeedback?.blockReason) return { kind: "support" };
  const candidate = body?.candidates?.[0];
  if (candidate?.finishReason === "SAFETY") return { kind: "support" };
  const raw = candidate?.content?.parts?.[0]?.text;
  if (!raw) return { kind: "none" };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { kind: "none" }; }
  const safety = (parsed as { safety?: unknown } | null)?.safety;
  if (safety === "review" || safety === "blocked") return { kind: "support" };
  const recommendation = parseRecommendation(parsed, options);
  return recommendation ? { kind: "recommendation", recommendation } : { kind: "none" };
}
