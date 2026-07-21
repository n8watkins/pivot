import { describe, expect, it } from "vitest";
import { closedLoopInputSchema, eventInputSchema, interventionInputSchema, recommendationInputSchema, setupInputSchema } from "./schemas";

const replacements = ["walk", "breathe", "stretch"].map((id) => ({ id, name: id, detail: "A safe option", duration: "3 min" }));

describe("server input contracts", () => {
  it("accepts a valid setup and rejects duplicate replacement ids", () => {
    expect(setupInputSchema.safeParse({ goals: ["late night scrolling"], replacements }).success).toBe(true);
    expect(setupInputSchema.safeParse({ goals: ["x", "x"], replacements }).success).toBe(false);
  });

  it("bounds closed-loop inputs", () => {
    expect(closedLoopInputSchema.safeParse({ pivotId: "pivot-evening", replacementId: "walk", intensity: 7, source: "fallback", outcome: "Much lighter", helpful: true }).success).toBe(true);
    expect(closedLoopInputSchema.safeParse({ pivotId: "pivot-evening", replacementId: "walk", intensity: 99, source: "fallback", outcome: "x", helpful: true }).success).toBe(false);
  });

  it("requires a pivot boundary for recommendations and interventions", () => {
    expect(recommendationInputSchema.safeParse({ pivotId: "pivot-evening", replacements }).success).toBe(true);
    expect(recommendationInputSchema.safeParse({ replacements }).success).toBe(false);
    expect(interventionInputSchema.safeParse({ pivotId: "pivot-evening", replacementId: "walk" }).success).toBe(true);
  });

  it("allows only known privacy event types", () => {
    expect(eventInputSchema.safeParse({ type: "follow_up_completed", payload: {} }).success).toBe(true);
    expect(eventInputSchema.safeParse({ type: "free_text_dump", payload: {} }).success).toBe(false);
  });
});
