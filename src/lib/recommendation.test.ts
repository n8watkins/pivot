import { describe, expect, it } from "vitest";
import { deterministicFallback, hasHighRiskContext, hasUnsupportedContext, interpretGeminiPayload, parseRecommendation, rankReplacements } from "./recommendation";
import { fallbackFirstStep } from "./replacement-copy";

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

  it("routes unsupported clinical categories away from habit recommendations", () => {
    expect(hasUnsupportedContext("I need help with an eating disorder")).toBe(true);
    expect(hasUnsupportedContext("I keep checking my email")).toBe(false);
  });

  it("ranks helpful replacements above rejected ones", () => {
    expect(rankReplacements(options, [{ replacementId: "breathe", helpful: true }, { replacementId: "walk", helpful: false }])[0].id).toBe("breathe");
  });

  it("returns an approved deterministic fallback", () => {
    expect(deterministicFallback(options).replacementId).toBe("walk");
    expect(deterministicFallback(options).firstStep).toBe("Put on your shoes and step outside.");
    expect(deterministicFallback(options).alternatives).toEqual(["breathe", "stretch"]);
  });

  it("writes a grammatical first step for custom actions", () => {
    expect(fallbackFirstStep({ id: "custom-read", name: "Read a page" })).toBe("Start now: Read a page.");
  });

  it("rejects malformed, unsafe, and unapproved model output", () => {
    expect(parseRecommendation({}, options)).toBeNull();
    expect(parseRecommendation({ replacementId: "walk", reason: "x", firstStep: "x", alternatives: [], safety: "blocked" }, options)).toBeNull();
    expect(parseRecommendation({ replacementId: "unknown", reason: "x", firstStep: "x", alternatives: [], safety: "safe" }, options)).toBeNull();
  });
});

describe("Gemini safety signal", () => {
  const geminiText = (value: unknown) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] });
  const safe = { replacementId: "breathe", reason: "Quiet fit.", firstStep: "Sit down.", alternatives: ["walk"], safety: "safe" };

  it("uses a safe, approved structured recommendation", () => {
    expect(interpretGeminiPayload(geminiText(safe), options)).toEqual({ kind: "recommendation", recommendation: safe });
  });

  it.each(["review", "blocked"])("routes to support when Gemini flags the note as %s", (safety) => {
    expect(interpretGeminiPayload(geminiText({ ...safe, safety }), options)).toEqual({ kind: "support" });
    expect(interpretGeminiPayload(geminiText({ safety }), options)).toEqual({ kind: "support" });
  });

  it.each(["REVIEW", " Blocked ", "unsafe", "", null, 0])("routes to support for any non-safe safety value %j", (safety) => {
    expect(interpretGeminiPayload(geminiText({ ...safe, safety }), options)).toEqual({ kind: "support" });
  });

  it("routes to support when Gemini blocks the prompt or stops for safety", () => {
    expect(interpretGeminiPayload({ promptFeedback: { blockReason: "SAFETY" } }, options)).toEqual({ kind: "support" });
    expect(interpretGeminiPayload({ promptFeedback: { safetyRatings: [{ blocked: true }] } }, options)).toEqual({ kind: "support" });
    for (const finishReason of ["SAFETY", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"]) {
      expect(interpretGeminiPayload({ candidates: [{ finishReason }] }, options)).toEqual({ kind: "support" });
    }
    expect(interpretGeminiPayload({ candidates: [{ finishReason: "STOP", safetyRatings: [{ blocked: true }], content: { parts: [{ text: JSON.stringify(safe) }] } }] }, options)).toEqual({ kind: "support" });
  });

  it("falls back quietly on malformed or unapproved output", () => {
    expect(interpretGeminiPayload(null, options)).toEqual({ kind: "none" });
    expect(interpretGeminiPayload({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }, options)).toEqual({ kind: "none" });
    expect(interpretGeminiPayload(geminiText({ ...safe, replacementId: "unknown" }), options)).toEqual({ kind: "none" });
  });
});
