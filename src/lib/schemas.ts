import { z } from "zod";

export const contextTagSchema = z.string().trim().min(2, "Tag must be at least 2 characters.").max(40, "Tag must be no more than 40 characters.");

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

export const pivotInputSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,80}$/),
  goal: z.string().trim().min(2).max(120),
  replacements: z.array(replacementInputSchema).min(1),
});

export const pivotsInputSchema = z.array(pivotInputSchema).min(1).superRefine((value, context) => {
  if (new Set(value.map((pivot) => pivot.id)).size !== value.length) context.addIssue({ code: "custom", message: "Pivot ids must be unique" });
});

export const recommendationInputSchema = z.object({
  replacements: z.array(replacementInputSchema).min(1),
  context: z.string().max(500).default(""),
  pivotId: z.string().regex(/^[a-z0-9-]{2,80}$/),
  tag: z.string().max(80).default(""),
  intensity: z.number().int().min(1).max(10).optional(),
  hour: z.number().int().min(0).max(23).optional(),
});

export const closedLoopInputSchema = z.object({
  interventionId: z.string().uuid(),
  pivotId: z.string().regex(/^[a-z0-9-]{2,80}$/),
  replacementId: z.string().regex(/^[a-z0-9-]{2,40}$/),
  outcome: z.string().trim().min(1).max(120),
  helpful: z.boolean(),
});

export const interventionInputSchema = z.object({
  pivotId: z.string().regex(/^[a-z0-9-]{2,80}$/),
  replacementId: z.string().regex(/^[a-z0-9-]{2,40}$/),
  reason: z.string().max(180).default(""),
  firstStep: z.string().max(240).default(""),
  source: z.enum(["gemini", "fallback"]).default("fallback"),
  intensity: z.number().int().min(1).max(10),
  contextType: z.string().max(80).default(""),
});

const analyticsPayloadSchema = z.object({
  pivotId: z.string().regex(/^[a-z0-9-]{2,80}$/).optional(),
  replacementId: z.string().regex(/^[a-z0-9-]{2,40}$/).optional(),
  helpful: z.boolean().optional(),
}).strict();

export const eventInputSchema = z.object({
  type: z.enum(["follow_up_completed", "active_intervention_started", "recommendation_rejected"]),
  payload: analyticsPayloadSchema.default({}),
});
