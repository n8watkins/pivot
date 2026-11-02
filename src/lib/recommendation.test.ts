import { describe, expect, it } from "vitest";
import { deterministicFallback, hasCrisisLanguage, hasHighRiskContext, hasUnsupportedContext, interpretGeminiPayload, parseRecommendation, rankReplacements } from "./recommendation";
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

describe("crisis language check", () => {
  it.each([
    "I feel suicidal",
    "Suicidal thoughts again tonight",
    "thinking about suicide",
    "I want to die",
    "i just wanna die",
    "Honestly I want to be dead",
    "I want to kill myself",
    "KILL MYSELF",
    "thinking about killing myself",
    "I want to end my life",
    "I might take my own life",
    "I want to end it all",
    "I want to hurt myself",
    "I keep cutting myself",
    "self-harm urges",
    "I wish I was dead",
    "everyone would be better off dead without me",
    "there is no reason to live",
    "I don\u2019t want to live anymore",
    "I don't want to be here anymore",
  ])("flags %j", (note) => {
    expect(hasCrisisLanguage(note)).toBe(true);
    expect(hasHighRiskContext(note)).toBe(true);
  });

  it.each([
    "I'm dying to try that new game",
    "this commute is killing me",
    "my feet are killing me",
    "I'm bored to death",
    "this cake is to die for",
    "I'd die for a nap",
    "I need to cut myself off from my phone",
    "cut myself some slack",
    "end my scrolling streak",
    "I want to end this habit",
    "I keep checking my email",
    "Tired",
    "",
  ])("does not flag %j", (note) => {
    expect(hasCrisisLanguage(note)).toBe(false);
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

  it("routes to support when Gemini blocks the prompt or stops for safety", () => {
    expect(interpretGeminiPayload({ promptFeedback: { blockReason: "SAFETY" } }, options)).toEqual({ kind: "support" });
    expect(interpretGeminiPayload({ candidates: [{ finishReason: "SAFETY" }] }, options)).toEqual({ kind: "support" });
  });

  it("falls back quietly on malformed or unapproved output", () => {
    expect(interpretGeminiPayload(null, options)).toEqual({ kind: "none" });
    expect(interpretGeminiPayload({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }, options)).toEqual({ kind: "none" });
    expect(interpretGeminiPayload(geminiText({ ...safe, replacementId: "unknown" }), options)).toEqual({ kind: "none" });
  });
});
