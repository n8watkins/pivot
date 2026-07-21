import { z } from "zod";

export const replacementInputSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/),
  name: z.string().trim().min(2).max(80),
  detail: z.string().trim().max(180),
  duration: z.string().trim().max(30),
});

export const setupInputSchema = z.object({
  goals: z.array(z.string().trim().min(2).max(120)).min(1),
  replacements: z.array(replacementInputSchema).min(1),
}).superRefine((value, context) => {
  if (new Set(value.goals.map((goal) => goal.toLowerCase())).size !== value.goals.length) context.addIssue({ code: "custom", path: ["goals"], message: "Goals must be unique" });
  if (new Set(value.replacements.map((replacement) => replacement.id)).size !== value.replacements.length) context.addIssue({ code: "custom", path: ["replacements"], message: "Replacement ids must be unique" });
});

export const recommendationInputSchema = z.object({
  replacements: z.array(replacementInputSchema).min(1),
  context: z.string().max(500).default(""),
});

export const closedLoopInputSchema = z.object({
  replacementId: z.string().regex(/^[a-z0-9-]{2,40}$/),
  intensity: z.number().int().min(1).max(10),
  contextType: z.string().max(80).default(""),
  reason: z.string().max(180).default(""),
  firstStep: z.string().max(240).default(""),
  source: z.enum(["gemini", "fallback"]),
  outcome: z.string().trim().min(1).max(120),
  helpful: z.boolean(),
});

export const eventInputSchema = z.object({
  type: z.enum(["follow_up_completed", "active_intervention_started", "recommendation_rejected"]),
  payload: z.record(z.string(), z.unknown()).default({}),
});
