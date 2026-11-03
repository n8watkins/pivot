import { describe, expect, it } from "vitest";
import { hasCrisisLanguage, hasHighRiskContext, hasUnsupportedContext, normalizeForSafety } from "./crisis";

describe("normalizeForSafety", () => {
  it("lowercases and strips punctuation, apostrophes, and accents", () => {
    expect(normalizeForSafety("I DON’T want... to LIVE!!")).toBe("i dont want to live");
    expect(normalizeForSafety("Kill. Myself.")).toBe("kill myself");
    expect(normalizeForSafety("suïcide")).toBe("suicide");
  });

  it("fixes common misspellings of crisis words only", () => {
    expect(normalizeForSafety("sucidal suicdal suicidial suiside")).toBe("suicidal suicidal suicidal suicide");
    expect(normalizeForSafety("kill my self, kill myslef, killmyself")).toBe("kill myself kill myself kill myself");
    expect(normalizeForSafety("I overdone it, social media")).toBe("i overdone it social media");
  });
});

// Every phrase here must route to crisis resources. When adding coverage, add the phrase here.
const crisisPhrases = [
  // Suicidal ideation, including typos and punctuation.
  "I feel suicidal",
  "I feel suicidal.",
  "im suicidal",
  "I'm feeling sucidal",
  "suicdal",
  "I feel suicidial",
  "SUICIDAL THOUGHTS AGAIN",
  "thinking about suicide",
  "having suicidal thoughts tonight",
  "kms",
  "I'm going to kms",
  "I want to unalive myself",
  // Wanting to die.
  "I want to die",
  "i want to die",
  "I just want to die!!!",
  "I want too die",
  "i want 2 die",
  "I wanna die rn",
  "i just wanna die",
  "I want to be dead",
  "Honestly I want to be dead",
  "I wish I was dead",
  "I wish I were dead",
  "I deserve to die",
  "ready to die",
  // Not wanting to be alive.
  "i dont want to be alive",
  "I don't want to be alive anymore",
  "I don’t want to live anymore",
  "dont wanna live",
  "I don't want to exist",
  "I don't want to be here anymore",
  "I wish I wasn't alive",
  "I wish I was never born",
  "I want to sleep and never wake up",
  "I want to go to sleep and never wake up",
  "no point in living",
  "there is no reason to live",
  "whats the point of living",
  "life isn't worth living",
  "I can't go on",
  "I can't do this anymore",
  "I can't take it anymore",
  "everyone would be better off without me",
  "everyone would be better off dead without me",
  "they'd be better off if I was gone",
  "the world would be better without me",
  "I want to disappear forever",
  "goodbye forever",
  "I wrote a goodbye note",
  "I won't be here tomorrow",
  "I want it all to end",
  "I want the pain to stop",
  // Ending one's life.
  "I want to kill myself",
  "KILL MYSELF",
  "Kill. Myself.",
  "kill my self",
  "killmyself",
  "thinking about killing myself",
  "I want to end my life",
  "I'm thinking about ending my life",
  "I might take my own life",
  "I want to end it all",
  "thinking of ending things",
  "I have a plan to end it",
  "I'm going to end it tonight",
  "I want to off myself",
  // Self-harm.
  "I want to hurt myself",
  "I want to hurt my self",
  "harming myself",
  "self harm",
  "selfharm",
  "self-harm urges",
  "self-harming again",
  "self injury",
  "I keep cutting myself",
  "I've been cutting again",
  "urge to cut my arm",
  "cut my wrists",
  "I burned myself on purpose",
  "I burned myself",
  // Methods.
  "slit my wrists",
  "I want to hang myself",
  "jump off a bridge",
  "I want to jump off the roof",
  "I want to jump in front of a train",
  "I want to shoot myself",
  "I'm going to drown myself",
  "I'm going to overdose",
  "overdosing",
  "I want to OD",
  "took too many pills",
  "take all my pills",
  "swallowed a bottle of sleeping pills",
  // Danger to others.
  "I want to hurt someone",
  "I might hurt my kids",
  "I'm being abused at home",
];

// None of these may route to crisis resources: they are everyday idioms or habit notes.
const everydayPhrases = [
  "",
  "Tired",
  "I keep checking my email",
  "I'm dying to try that new game",
  "this commute is killing me",
  "my feet are killing me",
  "killing time on reddit",
  "I killed it at work today",
  "I'm bored to death",
  "dead tired",
  "this cake is to die for",
  "I'd die for a nap",
  "I could die of embarrassment",
  "I need to cut myself off from my phone",
  "cut myself some slack",
  "cutting myself a slice of cake",
  "I'm cutting back on sugar",
  "end my scrolling streak",
  "I want to end this habit",
  "I want to end it with my phone addiction to news, honestly",
  "drop dead gorgeous",
  "hurt my back yesterday",
  "I never wake up on time",
  "I don't want to wake up early tomorrow",
  "I overdid the snacks",
  "I've overdone it with coffee",
  "I just want to scroll",
  "deadline tomorrow and I'm procrastinating",
  "I can't stop eating chips",
  "can't sleep, phone in hand",
];

describe("crisis language check", () => {
  it.each(crisisPhrases)("routes %j to crisis resources", (note) => {
    expect(hasCrisisLanguage(note) || hasHighRiskContext(note)).toBe(true);
    expect(hasHighRiskContext(note)).toBe(true);
  });

  it.each(everydayPhrases)("does not flag %j", (note) => {
    expect(hasHighRiskContext(note)).toBe(false);
  });

  it.each([
    "I'm not suicidal",
    "I am not suicidal but tired",
    "I don't want to die",
  ])("errs toward resources for the negated %j", (note) => {
    expect(hasHighRiskContext(note)).toBe(true);
  });

  it("finds crisis language inside longer context with tags", () => {
    expect(hasHighRiskContext("late night, stressed. honestly i feel suicidal and keep scrolling")).toBe(true);
  });
});

describe("unsupported clinical context", () => {
  it.each(["I need help with an eating disorder", "Eating-disorder relapse", "my DETOX is rough", "I think I'm psychotic"])("flags %j", (note) => {
    expect(hasUnsupportedContext(note)).toBe(true);
  });

  it.each(["I keep checking my email", "bored"])("does not flag %j", (note) => {
    expect(hasUnsupportedContext(note)).toBe(false);
  });
});
