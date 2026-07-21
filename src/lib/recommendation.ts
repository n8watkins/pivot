import { z } from "zod";

export const recommendationSchema = z.object({
  replacementId: z.string().min(1),
  reason: z.string().min(1).max(180),
  firstStep: z.string().min(1).max(240),
  alternatives: z.array(z.string().min(1)).max(2),
  safety: z.enum(["safe", "review", "blocked"]),
});

export type Recommendation = z.infer<typeof recommendationSchema>;
export type ReplacementOption = { id: string; name: string; detail: string; duration: string };

const riskyPatterns = /\b(self[- ]?harm|suicide|kill myself|hurt myself|hurt someone|overdose|abuse|illegal|weapon)\b/i;

export function hasHighRiskContext(input: string) { return riskyPatterns.test(input); }

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
    firstStep: `Begin with 30 seconds of ${primary.name.toLowerCase()}.`,
    alternatives: ranked.slice(1, 3).map((option) => option.id),
    safety: "safe",
  };
}

export function parseRecommendation(input: unknown, options: ReplacementOption[]) {
  const result = recommendationSchema.safeParse(input);
  if (!result.success || result.data.safety !== "safe" || !options.some((option) => option.id === result.data.replacementId) || result.data.alternatives.some((id) => !options.some((option) => option.id === id))) return null;
  return result.data;
}
