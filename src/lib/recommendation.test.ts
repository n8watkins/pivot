import { describe, expect, it } from "vitest";
import { deterministicFallback, hasHighRiskContext, parseRecommendation, rankReplacements } from "./recommendation";

const options = [
  { id: "walk", name: "Take a short walk", detail: "", duration: "5 min" },
  { id: "breathe", name: "Slow breathing", detail: "", duration: "2 min" },
  { id: "stretch", name: "Stretch", detail: "", duration: "3 min" },
];

describe("recommendation safety and fallback", () => {
  it("rejects high-risk context before normal recommendations", () => {
    expect(hasHighRiskContext("I want to hurt myself")).toBe(true);
    expect(hasHighRiskContext("I am bored")).toBe(false);
  });

  it("ranks helpful replacements above rejected ones", () => {
    expect(rankReplacements(options, [{ replacementId: "breathe", helpful: true }, { replacementId: "walk", helpful: false }])[0].id).toBe("breathe");
  });

  it("returns an approved deterministic fallback", () => {
    expect(deterministicFallback(options).replacementId).toBe("walk");
    expect(deterministicFallback(options).alternatives).toEqual(["breathe", "stretch"]);
  });

  it("rejects malformed, unsafe, and unapproved model output", () => {
    expect(parseRecommendation({}, options)).toBeNull();
    expect(parseRecommendation({ replacementId: "walk", reason: "x", firstStep: "x", alternatives: [], safety: "blocked" }, options)).toBeNull();
    expect(parseRecommendation({ replacementId: "unknown", reason: "x", firstStep: "x", alternatives: [], safety: "safe" }, options)).toBeNull();
  });
});
