import { z } from "zod";
import { rankWithContext, type RankingContext, type RankingHistory } from "./ranking";
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

export { hasCrisisLanguage, hasHighRiskContext, hasUnsupportedContext } from "./crisis";

export function rankReplacements(options: ReplacementOption[], history: RankingHistory[] = [], context: RankingContext = {}) {
  return rankWithContext(options, context, history).map((entry) => entry.action);
}

/** The deterministic pick: context-aware ranking with a reason written from the user's inputs. */
export function deterministicFallback(options: ReplacementOption[], history: RankingHistory[] = [], context: RankingContext = {}): Recommendation {
  const ranked = rankWithContext(options, context, history);
  const primary = ranked[0];
  if (!primary) throw new Error("At least one approved replacement is required");
  return {
    replacementId: primary.action.id,
    reason: primary.reason,
    firstStep: fallbackFirstStep(primary.action),
    alternatives: ranked.slice(1, 3).map((entry) => entry.action.id),
    safety: "safe",
  };
}

export function parseRecommendation(input: unknown, options: ReplacementOption[]) {
  const result = recommendationSchema.safeParse(input);
  if (!result.success || result.data.safety !== "safe" || !options.some((option) => option.id === result.data.replacementId) || result.data.alternatives.some((id) => !options.some((option) => option.id === id))) return null;
  return result.data;
}

export type GeminiOutcome = { kind: "support" } | { kind: "recommendation"; recommendation: Recommendation } | { kind: "none" };

// Gemini finish reasons that mean the model refused or was stopped by a safety filter.
const geminiSafetyStops = new Set(["SAFETY", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY"]);

type GeminiPayload = {
  promptFeedback?: { blockReason?: string; safetyRatings?: { blocked?: boolean }[] };
  candidates?: { finishReason?: string; safetyRatings?: { blocked?: boolean }[]; content?: { parts?: { text?: string }[] } }[];
} | null;

/**
 * Reads a Gemini generateContent payload. Any safety signal routes to support instead of a
 * habit suggestion: a blocked prompt, a safety finish reason, a blocked safety rating, or a
 * structured answer whose `safety` is anything other than "safe" (including "review",
 * "blocked", and unexpected values). It never falls back to a normal recommendation then.
 */
export function interpretGeminiPayload(payload: unknown, options: ReplacementOption[]): GeminiOutcome {
  const body = payload as GeminiPayload;
  if (body?.promptFeedback?.blockReason || body?.promptFeedback?.safetyRatings?.some((rating) => rating?.blocked)) return { kind: "support" };
  const candidate = body?.candidates?.[0];
  if (candidate?.finishReason && geminiSafetyStops.has(candidate.finishReason)) return { kind: "support" };
  if (candidate?.safetyRatings?.some((rating) => rating?.blocked)) return { kind: "support" };
  const raw = candidate?.content?.parts?.[0]?.text;
  if (!raw) return { kind: "none" };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { kind: "none" }; }
  const safety = (parsed as { safety?: unknown } | null)?.safety;
  if (safety !== undefined && (typeof safety !== "string" || safety.trim().toLowerCase() !== "safe")) return { kind: "support" };
  const recommendation = parseRecommendation(parsed, options);
  return recommendation ? { kind: "recommendation", recommendation } : { kind: "none" };
}
