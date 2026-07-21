import { describe, expect, it } from "vitest";
import { closedLoopInputSchema, eventInputSchema, setupInputSchema } from "./schemas";

const replacements = ["walk", "breathe", "stretch"].map((id) => ({ id, name: id, detail: "A safe option", duration: "3 min" }));

describe("server input contracts", () => {
  it("accepts a valid setup and rejects duplicate replacement ids", () => {
    expect(setupInputSchema.safeParse({ goals: ["late night scrolling"], replacements }).success).toBe(true);
    expect(setupInputSchema.safeParse({ goals: ["x", "x"], replacements }).success).toBe(false);
  });

  it("bounds closed-loop inputs", () => {
    expect(closedLoopInputSchema.safeParse({ replacementId: "walk", intensity: 7, source: "fallback", outcome: "Much lighter", helpful: true }).success).toBe(true);
    expect(closedLoopInputSchema.safeParse({ replacementId: "walk", intensity: 99, source: "fallback", outcome: "x", helpful: true }).success).toBe(false);
  });

  it("allows only known privacy event types", () => {
    expect(eventInputSchema.safeParse({ type: "follow_up_completed", payload: {} }).success).toBe(true);
    expect(eventInputSchema.safeParse({ type: "free_text_dump", payload: {} }).success).toBe(false);
  });
});
