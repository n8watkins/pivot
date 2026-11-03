/**
 * Crisis language detection.
 *
 * Pivot is a habit tool, not crisis care, so any note that sounds like suicidal thinking,
 * self-harm, an overdose, or danger to someone routes to crisis resources instead of a habit
 * suggestion. The check deliberately errs toward showing resources: a false positive costs one
 * extra tap ("Back to Pivot"), a false negative can cost far more.
 *
 * Negations ("I'm not suicidal", "I don't want to die") still flag on purpose: people often
 * soften what they say, and seeing a helpline does no harm. Only everyday idioms that clearly
 * are not about harm ("dying to try", "killing time", "cut myself some slack") are excluded.
 *
 * This module is pure and runs both in the API route and in the browser, so crisis resources
 * show immediately and still show when the network or the recommendation service fails.
 */

/** Lowercases, strips accents, apostrophes, and punctuation, and fixes common misspellings. */
export function normalizeForSafety(input: string) {
  const text = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['‘’ʼ`´]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.split(" ").map(correctWord).join(" ")
    .replace(/\bmy self\b/g, "myself")
    .replace(/\b(kill|hurt|harm|cut|off|end)myself\b/g, "$1 myself");
}

// Words worth correcting when misspelled. Each is long and distinctive enough that a typo
// cannot collide with an everyday word.
const typoTargets = ["suicide", "suicidal", "myself", "overdose", "overdosing", "unalive"];
const typoExceptions = new Set(["overdone", "overdoes"]);

function correctWord(word: string) {
  if (word.length < 5 || typoExceptions.has(word)) return word;
  for (const target of typoTargets) {
    if (word === target) return word;
    const allowed = target.length >= 7 ? 2 : 1;
    if (Math.abs(word.length - target.length) <= allowed && word[0] === target[0] && editDistance(word, target) <= allowed) return target;
  }
  return word;
}

/** Optimal string alignment distance (Levenshtein plus adjacent transpositions). */
function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

const TO = "(?:to|too|2)";
const WANT = "(?:want|wanna|wanted|wants|wish|wishing|ready|planning|plan|deserve|need|trying|try|tryna)";

// Patterns run on normalizeForSafety output: lowercase words separated by single spaces,
// with no apostrophes ("dont", "im", "cant").
const crisisPatterns: RegExp[] = [
  // Suicide, in any form or common misspelling.
  /\bsuicid\w*/,
  /\b(kms|kys|unalive\w*|sewerslide)\b/,
  // Harming or killing oneself, with the idioms "cut myself off/some slack" left alone.
  /\b(kill|killing|killed|hurt|hurting|harm|harming|harmed|injure|injuring|injured|end|ending|off|offing|burn|burning|burned|burnt|hang|hanging|hanged|shoot|shooting|shot|stab|stabbing|stabbed|drown|drowning|poison|poisoning|poisoned|starve|starving|strangle|strangling|suffocate|suffocating|punch|punching|punched|hit|hitting|scratch|scratching|bruise|bruising)\s+myself\b/,
  /\b(cut|cuts|cutting)\s+myself\b(?!\s+(off|some|a|an|out|short|loose|free|in|back|down)\b)/,
  /\bself\s?(harm\w*|injur\w*|mutilat\w*)/,
  /\b(been|keep|kept|started|start|back to|urge to|urges to|want to|wanna|thinking about)\s+cutting\s+(again|my\s+(arm|arms|wrist|wrists|leg|legs|thigh|thighs|skin))\b/,
  /\bcutting\s+again\b(?!\s+(back|down|out|the|my\s+hair|class|school|corners|costs|carbs|sugar))/,
  /\bcut(ting)?\s+my\s+(wrist|wrists|arm|arms|thigh|thighs|skin)\b/,
  /\bslit(ting)?\s+my\s+(wrist|wrists|throat)\b/,
  /\b(noose|razor blade)\b/,
  // Wanting to die or not to be alive.
  new RegExp(`\\b${WANT}\\s+(${TO}\\s+)?(die|be dead|not exist|stop existing|not be alive|not be here)\\b`),
  new RegExp(`\\b(dont|do not|dont really|really dont|no longer|never)\\s+(want|wanna|wish)\\s+(${TO}\\s+)?(live|be alive|exist|keep living|go on|keep going|be here any\\s?more|wake up(?!\\s+(early|at|for|before|so)\\b))`),
  /\bwish\s+(that\s+)?i\s+(was|were|could be)\s+(dead|gone)\b/,
  /\bwish\s+(that\s+)?i\s+(wasnt|werent|was not|were not)\s+(alive|born|here|around)\b/,
  /\bwish\s+(that\s+)?i\s+(had\s+)?(never\s+been\s+born|was never born|were never born|never existed|could disappear)\b/,
  /\b(go to sleep|fall asleep|sleep)\s+and\s+(never|not)\s+wake\s+up\b/,
  /\bbetter\s+off\s+(dead|gone|without\s+me|if\s+i\s+(was|were|wasnt|werent)\b)/,
  /\b(world|everyone|everybody|they|family)\s+(would\s+be|is|are)\s+better\s+without\s+me\b/,
  /\b(take|taking|took|end|ending|ended)\s+my\s+(own\s+)?life\b/,
  /\b(end|ending)\s+(it\s+all|everything)\b/,
  new RegExp(`\\b(thinking|think|thought|thoughts)\\s+(about|of)\\s+(ending|ending it|ending things|ending everything|dying|death|not being here|not waking up)\\b`),
  new RegExp(`\\b(plan|planning|going|gonna|want|wanna|ready|decided)\\s+${TO}\\s+end\\s+(it|things|everything)\\b(?!\\s+with\\b)`),
  /\bno\s+(reason|point|purpose)\s+(to|in|for)\s+(live|living|life|keep going|keep living|go on|going on|being alive|being here|existing|me)\b/,
  /\b(whats|what is)\s+the\s+point\s+(of|in)\s+(living|life|being alive|going on|existing|me)\b/,
  /\blife\s+(is not|isnt|aint|is no longer|not)\s+worth\s+(living|it)\b/,
  /\b(cant|can not|cannot|cant really)\s+(go on|keep going|keep living|do this any\s?more|take (it|this) any\s?more|live like this|live with (this|myself))\b/,
  /\b(goodbye|suicide) (note|letter)\b/,
  /\b(say|saying)\s+goodbye\s+(to\s+everyone|forever)\b/,
  /\bgoodbye forever\b/,
  /\b(disappear|vanish)\s+forever\b/,
  /\bnot\s+be\s+(here|around|alive)\s+(tomorrow|much longer|any\s?more|for long)\b/,
  /\bwont\s+be\s+(here|around|alive)\s+(tomorrow|much longer|any\s?more|for long)\b/,
  /\bwant\s+(it\s+all|everything|my life|the pain)\s+to\s+(end|stop|be over)\b/,
  // Methods.
  /\bjump(ing)?\s+(off|from)\s+(a|the|this|my)\s+(bridge|building|roof|cliff|balcony|window|ledge|tower|overpass)\b/,
  /\b(jump|jumping|step|stepping|walk|walking)\s+in\s+front\s+of\s+(a|the)\s+(train|bus|car|truck|subway)\b/,
  /\boverdos\w*/,
  new RegExp(`\\b(${WANT}|going|gonna|about|might|will)\\s+(${TO}\\s+)?od\\b`),
  /\b(take|taking|took|swallow|swallowing|swallowed)\s+(all|all of|a bunch of|too many|a lot of|lots of|loads of|a handful of|the whole bottle of|a bottle of|every one of)\s+(my\s+|the\s+|these\s+|those\s+)?(pills|meds|medication|medications|tablets|sleeping pills|painkillers|pain killers)\b/,
  /\b(pills|meds|tablets)\s+to\s+(die|end it|not wake up|sleep forever)\b/,
  // Danger to someone else.
  /\b(kill|killing|hurt|hurting|harm|harming|stab|stabbing|shoot|shooting|strangle|choke|choking)\s+(someone|somebody|people|everyone|everybody|my\s+(wife|husband|partner|kid|kids|child|children|son|daughter|mom|mother|dad|father|baby|family|boss|roommate|girlfriend|boyfriend))\b/,
  /\b(being|been|getting)\s+(abused|hit|beaten|hurt)\s+(by|at home)\b/,
  /\b(weapon|gun|knife)\s+(to|at)\s+(my|his|her|their|someone)\b/,
];

export function hasCrisisLanguage(input: string) {
  if (!input) return false;
  const text = normalizeForSafety(input);
  return crisisPatterns.some((pattern) => pattern.test(text));
}

const otherRiskPatterns = /\b(hurt someone|abuse|abused|abusing|illegal|weapon)\b/;
const unsupportedPatterns = /\b(eating disorder|anorexia|anorexic|bulimia|bulimic|purging|binge and purge|detox|withdrawal|withdrawals|gambling addiction|substance addiction|domestic violence|psychosis|psychotic|manic episode|hearing voices)\b/;

/** Crisis language or other danger: show crisis resources, never a habit suggestion. */
export function hasHighRiskContext(input: string) {
  return hasCrisisLanguage(input) || otherRiskPatterns.test(normalizeForSafety(input));
}

/** Clinical topics Pivot is not built for: point to specialized support instead. */
export function hasUnsupportedContext(input: string) {
  return unsupportedPatterns.test(normalizeForSafety(input));
}

export const crisisResources = {
  call: "tel:988",
  text: "sms:988",
  chat: "https://988lifeline.org/chat/",
  international: "https://findahelpline.com",
} as const;
