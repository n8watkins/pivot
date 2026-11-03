import type { CrisisCategory, SpecializedCategory } from "./crisis";

/**
 * US crisis and support lines shown on the support screens and the /help page.
 * Numbers are written out as text next to every tel:/sms: link, so they can be read,
 * copied, or dialed from another phone when a link does nothing.
 */
export type ResourceAction = { kind: "call" | "text" | "chat"; label: string; href: string };
export type CrisisResource = { id: string; name: string; when: string; contact: string; actions: ResourceAction[] };

export const resources = {
  lifeline: {
    id: "lifeline",
    name: "988 Suicide & Crisis Lifeline",
    when: "For thoughts of suicide, a mental health or substance use crisis, or any emotional distress. Free and confidential, any time.",
    contact: "Call or text 988",
    actions: [
      { kind: "call", label: "Call 988", href: "tel:988" },
      { kind: "text", label: "Text 988", href: "sms:988" },
      { kind: "chat", label: "Chat online", href: "https://988lifeline.org/chat/" },
    ],
  },
  crisisText: {
    id: "crisis-text",
    name: "Crisis Text Line",
    when: "Text with a trained crisis counselor, any time.",
    contact: "Text HOME to 741741",
    actions: [{ kind: "text", label: "Text HOME to 741741", href: "sms:741741?&body=HOME" }],
  },
  domesticViolence: {
    id: "domestic-violence",
    name: "National Domestic Violence Hotline",
    when: "If someone is hurting, threatening, or controlling you. Free, confidential, any time.",
    contact: "Call 1-800-799-7233 or text START to 88788",
    actions: [
      { kind: "call", label: "Call 1-800-799-7233", href: "tel:+18007997233" },
      { kind: "text", label: "Text START to 88788", href: "sms:88788?&body=START" },
    ],
  },
  sexualAssault: {
    id: "sexual-assault",
    name: "RAINN National Sexual Assault Hotline",
    when: "After sexual assault or abuse, whenever it happened. Free and confidential, any time.",
    contact: "Call 1-800-656-4673",
    actions: [{ kind: "call", label: "Call 1-800-656-4673", href: "tel:+18006564673" }],
  },
  poisonControl: {
    id: "poison-control",
    name: "Poison Control",
    when: "If someone took too much of a medicine or drug, or swallowed something harmful. If they are not breathing, unconscious, or having a seizure, call 911 first.",
    contact: "Call 1-800-222-1222",
    actions: [{ kind: "call", label: "Call 1-800-222-1222", href: "tel:+18002221222" }],
  },
  substanceUse: {
    id: "substance-use",
    name: "SAMHSA National Helpline",
    when: "Free, confidential treatment referral and information for substance use, any time.",
    contact: "Call 1-800-662-4357",
    actions: [{ kind: "call", label: "Call 1-800-662-4357", href: "tel:+18006624357" }],
  },
} satisfies Record<string, CrisisResource>;

export const emergency = { contact: "Call 911", href: "tel:911" } as const;
export const internationalHelplines = "https://findahelpline.com";

/** The lines to show first for a crisis, most specific first. 988 is always shown separately. */
export function resourcesForCrisis(categories: readonly CrisisCategory[]): CrisisResource[] {
  const list: CrisisResource[] = [];
  if (categories.includes("overdose")) list.push(resources.poisonControl);
  if (categories.includes("abuse")) list.push(resources.domesticViolence);
  if (categories.includes("sexual-assault")) list.push(resources.sexualAssault);
  list.push(resources.crisisText);
  return list;
}

/** The lines for the specialized-support screen: the topic's own line, then 988 and Crisis Text Line. */
export function resourcesForSpecialized(categories: readonly SpecializedCategory[]): CrisisResource[] {
  const list: CrisisResource[] = [];
  if (categories.includes("substance-use")) list.push(resources.substanceUse);
  list.push(resources.lifeline, resources.crisisText);
  return list;
}

/** Every line, for the /help page. */
export const allResources: CrisisResource[] = [resources.lifeline, resources.crisisText, resources.domesticViolence, resources.sexualAssault, resources.poisonControl, resources.substanceUse];
