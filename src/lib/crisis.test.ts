import { describe, expect, it } from "vitest";
import { assessSafety, hasCrisisLanguage, hasHighRiskContext, hasUnsupportedContext, normalizeForSafety, type CrisisCategory, type SpecializedCategory } from "./crisis";

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

// November 2026 audit: phrasings that used to get a habit suggestion, grouped by why they must
// route to crisis resources. Each row is [note, category that must be among the matches].
const categorizedCrisisPhrases: [string, CrisisCategory][] = [
  // Passive suicidal ideation.
  ["im so tired of being alive", "suicide"],
  ["im tired of living", "suicide"],
  ["sick of life", "suicide"],
  ["done with life", "suicide"],
  ["I'm done with everything", "suicide"],
  ["i want to give up on life", "suicide"],
  ["nobody would miss me if i was gone", "suicide"],
  ["no one would even notice", "suicide"],
  ["no one would care if I disappeared", "suicide"],
  ["i want to disappear", "suicide"],
  ["I wish I could just disappear", "suicide"],
  ["i want to sleep forever", "suicide"],
  ["I wish I wouldn't wake up", "suicide"],
  ["i hate my life and want it over", "suicide"],
  ["I want it to be over", "suicide"],
  ["i'm a burden to everyone", "suicide"],
  ["I feel like a burden", "suicide"],
  ["I'm just a burden on my family", "suicide"],
  ["life feels pointless", "suicide"],
  ["life is meaningless", "suicide"],
  ["I feel hopeless", "suicide"],
  ["nothing to live for", "suicide"],
  ["I have pills saved up", "suicide"],
  ["i've been stockpiling my meds", "suicide"],
  ["I wish someone would kill me", "suicide"],
  ["I can't be here anymore", "suicide"],
  // Obfuscated spellings, leetspeak, and letter spacing.
  ["I wanna k*ll myself", "suicide"],
  ["i want to k1ll myself", "suicide"],
  ["kil myself", "suicide"],
  ["ki11 myself", "suicide"],
  ["k i l l myself", "suicide"],
  ["k.i.l.l. myself", "suicide"],
  ["s u i c i d e", "suicide"],
  ["$uicidal", "suicide"],
  ["su1c1dal", "suicide"],
  ["I want to d!e", "suicide"],
  ["I want to d1e", "suicide"],
  ["unal1ve myself", "suicide"],
  ["I want to kill my self!!!", "suicide"],
  // Non-English.
  ["quiero morir", "suicide"],
  ["me quiero morir", "suicide"],
  ["je veux mourir", "suicide"],
  ["ich will sterben", "suicide"],
  // Self-harm.
  ["I want to make myself bleed", "self-harm"],
  ["I keep hitting myself", "self-harm"],
  ["I scratch myself until it bleeds", "self-harm"],
  ["relapsed on self harm", "self-harm"],
  ["I want to starve myself", "self-harm"],
  // Abuse and domestic violence.
  ["i'm in an abusive relationship", "abuse"],
  ["my partner hits me", "abuse"],
  ["he hits me when he drinks", "abuse"],
  ["my husband choked me", "abuse"],
  ["my dad beats me", "abuse"],
  ["she threatened to kill me", "abuse"],
  ["im scared to go home", "abuse"],
  ["I'm afraid of my boyfriend", "abuse"],
  ["I don't feel safe at home", "abuse"],
  ["domestic violence at home", "abuse"],
  ["he's abusive", "abuse"],
  ["I was abused as a kid", "abuse"],
  // Sexual assault.
  ["I was raped", "sexual-assault"],
  ["I got raped last night", "sexual-assault"],
  ["I was sexually assaulted", "sexual-assault"],
  ["someone groped me", "sexual-assault"],
  ["he forced me to have sex", "sexual-assault"],
  ["he touched me without asking", "sexual-assault"],
  ["I didn't consent", "sexual-assault"],
  ["I think someone drugged me", "sexual-assault"],
  ["someone spiked my drink", "sexual-assault"],
  // Overdose and medical emergency.
  ["I overdosed", "overdose"],
  ["took too many pills", "overdose"],
  ["I took a whole bottle of tylenol", "overdose"],
  ["I swallowed a handful of pills", "overdose"],
  ["I mixed xanax and alcohol", "overdose"],
  ["I drank bleach", "overdose"],
  ["I think I'm poisoned", "overdose"],
  ["I can't breathe", "overdose"],
  ["my friend is unconscious", "overdose"],
  ["she's not breathing", "overdose"],
  // Harm to others.
  ["I want to hurt someone", "harm-to-others"],
  ["I'm going to kill him", "harm-to-others"],
  ["I want to hurt her", "harm-to-others"],
  ["I might hurt my baby", "harm-to-others"],
  ["I want to shoot up my school", "harm-to-others"],
  ["I want to strangle my roommate", "harm-to-others"],
];

// Everyday habit notes that share words with the patterns above. None may route to crisis resources.
const moreEverydayPhrases = [
  "killing it at work today",
  "I'm killing it at the gym",
  "dying to scroll",
  "dying for a coffee",
  "I'm scared to death of my inbox",
  "dead serious, I need to stop",
  "kill time before my meeting",
  "this meeting is killing me",
  "my back is killing me",
  "I'm tired of scrolling",
  "tired of checking email",
  "sick of my phone",
  "done with social media",
  "I'm done with this show",
  "I can't live without coffee",
  "I want to give up sugar",
  "I gave up on the diet",
  "I hurt her feelings",
  "I want to beat him at chess",
  "I beat them in a game",
  "I'm going to burn myself out at work",
  "I want to treat myself",
  "food poisoning last week",
  "I had too many snacks",
  "I took too much time scrolling",
  "I spent too much on coffee",
  "I'm addicted to my phone",
  "phone addiction",
  "I relapsed on doomscrolling",
  "purge my closet",
  "crack open a book",
  "cracked my phone screen",
  "I need to detach",
  "I keep checking the 988 number for my friend",
  "2am and wide awake",
  "I want 2 snacks",
  "u r so bored",
  "a b c",
  "Avoiding something",
  "Just automatic",
  "Stressed",
];

describe("crisis categories (November 2026 audit)", () => {
  it.each(categorizedCrisisPhrases)("routes %j to crisis resources for %s", (note, category) => {
    const result = assessSafety(note);
    expect(result.route).toBe("crisis");
    expect(result.categories).toContain(category);
  });

  it.each(moreEverydayPhrases)("does not route %j to crisis resources", (note) => {
    expect(assessSafety(note).route).not.toBe("crisis");
  });

  it("keeps the habit flow for most everyday notes", () => {
    const routed = moreEverydayPhrases.filter((note) => assessSafety(note).route !== null);
    expect(routed).toEqual([]);
  });
});

describe("specialized categories", () => {
  it.each<[string, SpecializedCategory]>([
    ["I need help with an eating disorder", "eating"],
    ["I binge then make myself throw up", "eating"],
    ["I throw up after I eat", "eating"],
    ["I relapsed and used heroin again", "substance-use"],
    ["I want to use again, craving heroin", "substance-use"],
    ["drinking every night to cope", "substance-use"],
    ["i want to drink until i pass out", "substance-use"],
    ["withdrawal shakes", "substance-use"],
    ["my substance abuse is getting worse", "substance-use"],
    ["I think I'm an alcoholic", "substance-use"],
    ["hearing voices", "mental-health"],
    ["I think I'm psychotic", "mental-health"],
  ])("routes %j to specialized support for %s", (note, category) => {
    const result = assessSafety(note);
    expect(result.route).toBe("specialized");
    expect(result.categories).toContain(category);
  });

  it("prefers crisis resources when a note is both", () => {
    expect(assessSafety("I relapsed on heroin and want to die").route).toBe("crisis");
  });
});
