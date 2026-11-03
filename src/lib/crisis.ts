/**
 * Crisis language detection.
 *
 * Pivot is a habit tool, not crisis care, so any note that sounds like suicidal thinking,
 * self-harm, abuse, sexual assault, an overdose or medical emergency, or danger to someone
 * routes to crisis resources instead of a habit suggestion. The check deliberately errs toward
 * showing resources: a false positive costs one extra tap ("Back to Pivot"), a false negative
 * can cost far more.
 *
 * Negations ("I'm not suicidal", "I don't want to die") still flag on purpose: people often
 * soften what they say, and seeing a helpline does no harm. Only everyday idioms that clearly
 * are not about harm ("dying to try", "killing time", "cut myself some slack") are excluded.
 *
 * The check is deterministic on purpose (no model in this path). This module is pure and runs
 * both in the API route and in the browser, so crisis resources show immediately and still show
 * when the network or the recommendation service fails.
 */

/** Why a note routed to crisis resources; each category adds its own US resources. */
export type CrisisCategory = "suicide" | "self-harm" | "abuse" | "sexual-assault" | "overdose" | "harm-to-others";
/** Clinical topics Pivot is not built for; each adds its own resources to the specialized screen. */
export type SpecializedCategory = "substance-use" | "eating" | "mental-health";

export type SafetyAssessment =
  | { route: "crisis"; categories: CrisisCategory[] }
  | { route: "specialized"; categories: SpecializedCategory[] }
  | { route: null; categories: [] };

// Leetspeak and symbol substitutions, applied only inside words that also contain letters,
// so numbers like "988" or "2" (as in "want 2 die") stay as they are.
const leet: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i", "|": "l", "€": "e" };

function undoLeet(word: string) {
  // Trailing "!!!" or "|" is punctuation, not a letter.
  const core = word.replace(/[!|]+$/, "");
  if (!/[a-z]/.test(core) || !/[0-9@$!|€]/.test(core)) return core;
  return core.replace(/[0-9@$!|€]/g, (char) => leet[char] ?? char)
    // "ki11" and "k1ll": a 1 between letters may stand for l as well as i.
    .replace(/^ki[il]{2}/, "kill");
}

/** Lowercases, strips accents, apostrophes, and punctuation, undoes leetspeak and letter spacing, and fixes common misspellings. */
export function normalizeForSafety(input: string) {
  const deobfuscated = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['‘’ʼ`´]/g, "")
    // "k1ll", "$uicide", "d!e": map symbols inside words that contain letters.
    .replace(/[a-z0-9@$!|€*]+/g, undoLeet);
  const words = deobfuscated
    .replace(/[^a-z0-9*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");
  return collapseSpacedLetters(words).map(correctWord).join(" ")
    .replace(/\bmy self\b/g, "myself")
    .replace(/\b(kill|hurt|harm|cut|off|end|burn|starve|shoot|hang)myself\b/g, "$1 myself")
    .replace(/\bkill(ing)?(him|her|them|everyone)\b/g, "kill$1 $2");
}

/** "k i l l myself" and "s.u.i.c.i.d.e" arrive as runs of single letters: join runs of three or more. */
function collapseSpacedLetters(words: string[]) {
  const result: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length >= 3) result.push(run.join(""));
    else result.push(...run);
    run = [];
  };
  for (const word of words) {
    if (/^[a-z]$/.test(word)) run.push(word);
    else { flush(); result.push(word); }
  }
  flush();
  return result.filter(Boolean);
}

// Words worth correcting when misspelled or masked ("k*ll", "su*cide"). Each is long and
// distinctive enough that a typo cannot collide with an everyday word.
const typoTargets = ["suicide", "suicidal", "myself", "overdose", "overdosing", "unalive"];
const maskedTargets = ["kill", "killing", "suicide", "suicidal", "die", "dead", "myself", "rape", "raped", "cut", "cutting", "hang", "overdose"];
const typoExceptions = new Set(["overdone", "overdoes"]);

function correctWord(word: string) {
  if (word.includes("*")) {
    const pattern = new RegExp(`^${word.replace(/\*+/g, (stars) => `[a-z]{1,${stars.length + 1}}`)}$`);
    const masked = maskedTargets.find((target) => pattern.test(target));
    return masked ?? word.replace(/\*/g, "");
  }
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
const WANT = "(?:want|wanna|wanted|wants|wish|wishing|ready|planning|plan|deserve|need|trying|try|tryna|going|gonna|about)";
const I_AM = "(?:i am|im|i feel|i feel like|feeling|i felt|i have been|ive been|i was)";
const PARTNER = "(?:he|she|they|my\\s+(?:partner|husband|wife|boyfriend|girlfriend|bf|gf|ex|spouse|fiance|fiancee|dad|father|mom|mother|stepdad|stepfather|stepmom|stepmother|parent|parents|brother|sister|uncle|aunt|son|daughter|roommate|boss|coach|teacher))";
const SELF_VERBS = "(?:kill|killing|killed|hurt|hurting|harm|harming|harmed|injure|injuring|injured|end|ending|off|offing|burn|burning|burned|burnt|hang|hanging|hanged|shoot|shooting|shot|stab|stabbing|stabbed|drown|drowning|poison|poisoning|poisoned|starve|starving|strangle|strangling|suffocate|suffocating|punch|punching|punched|hit|hitting|scratch|scratching|bruise|bruising|bleed|bleeding)";

// Patterns run on normalizeForSafety output: lowercase words separated by single spaces,
// with no apostrophes ("dont", "im", "cant").
const crisisPatterns: Record<CrisisCategory, RegExp[]> = {
  suicide: [
    // Suicide, in any form or common misspelling.
    /\bsuicid\w*/,
    /\b(kms|kys|unalive\w*|sewerslide|su1cide)\b/,
    // Killing or ending oneself (masked spellings like "k*ll" and "kil" included).
    /\b(kill|killing|killed|kil|kll|end|ending|off|offing|take out|taking out)\s+myself\b/,
    // A few common non-English phrasings.
    /\b(quiero morir(me)?|me quiero morir|quiero matarme|suicidarme|matarme|je veux mourir|me suicider|me tuer|ich will sterben|umbringen|quero morrer|me matar)\b/,
    new RegExp(`\\b(want|wish|need|hope|wanna)\\s+(someone|somebody|something)\\s+(${TO}\\s+|would\\s+|could\\s+)?(kill|end)\\s+me\\b`),
    new RegExp(`\\b${WANT}\\s+(${TO}\\s+)?be\\s+killed\\b`),
    // Wanting to die or not to be alive.
    new RegExp(`\\b${WANT}\\s+(${TO}\\s+)?(die|be dead|not exist|stop existing|stop living|not be alive|not be here|disappear|vanish|sleep forever|never wake up|not wake up)\\b`),
    new RegExp(`\\b(dont|do not|dont really|really dont|no longer|never)\\s+(want|wanna|wish)\\s+(${TO}\\s+)?(live|be alive|exist|keep living|go on|keep going|be here|wake up(?!\\s+(early|at|for|before|so)\\b))`),
    /\bwish\s+(that\s+)?i\s+(was|were|could be)\s+(dead|gone)\b/,
    /\bwish\s+(that\s+)?i\s+(wasnt|werent|was not|were not)\s+(alive|born|here|around)\b/,
    /\bwish\s+(that\s+)?i\s+(had\s+)?(never\s+been\s+born|was never born|were never born|never existed|could disappear|could just disappear|could vanish|could sleep forever|would not wake up|wouldnt wake up|didnt wake up)\b/,
    /\b(go to sleep|fall asleep|sleep)\s+and\s+(never|not)\s+wake\s+up\b/,
    /\bsleep\s+forever\b/,
    /\bbetter\s+off\s+(dead|gone|without\s+me|if\s+i\s+(was|were|wasnt|werent)\b)/,
    /\b(world|everyone|everybody|they|family|people)\s+(would\s+be|will\s+be|is|are|d\s+be|would\s+all\s+be)\s+better\s+(off\s+)?without\s+me\b/,
    /\b(no one|nobody|noone|no body)\s+(would|will|is going to|gonna)\s+(even\s+)?(miss|notice|care)\b/,
    /\b(miss|notice)\s+me\s+if\s+i\s+(was|were|am)\s+gone\b/,
    new RegExp(`\\b${I_AM}\\s+(just\\s+|such\\s+|only\\s+)?(a|an)\\s+(burden|waste of space|waste of air)\\b`),
    /\bburden\s+(to|on|for)\s+(everyone|everybody|my family|my friends|my parents|my kids|people|them|you|all)\b/,
    /\b(take|taking|took|end|ending|ended)\s+my\s+(own\s+)?life\b/,
    /\b(end|ending)\s+(it\s+all|everything|my life)\b/,
    /\b(thinking|think|thought|thoughts)\s+(about|of)\s+(ending|ending it|ending things|ending everything|dying|death|not being here|not waking up|killing myself)\b/,
    new RegExp(`\\b(plan|planning|going|gonna|want|wanna|ready|decided)\\s+${TO}\\s+end\\s+(it|things|everything)\\b(?!\\s+with\\b)`),
    /\b(tired|sick|exhausted|done)\s+(of|with)\s+(living|being alive|life|existing|being here|it all|everything|my life|this life)\b/,
    /\b(give|giving|gave)\s+up\s+on\s+(life|living|everything|myself)\b/,
    /\b(hate|hating)\s+(my\s+life|living|being alive|existing)\b.*\b(over|end|die|dead|gone)\b/,
    new RegExp(`\\bwant\\s+(it|this|my life|everything|it all)\\s+(${TO}\\s+be\\s+)?over\\b`),
    /\bnothing\s+(left\s+)?to\s+live\s+for\b/,
    /\bno\s+(reason|point|purpose)\s+(to|in|for)\s+(live|living|life|keep going|keep living|go on|going on|being alive|being here|existing|me)\b/,
    /\b(whats|what is)\s+the\s+point\s+(of|in)\s+(living|life|being alive|going on|existing|me|anything)\b/,
    /\blife\s+(is not|isnt|aint|is no longer|not)\s+worth\s+(living|it)\b/,
    /\blife\s+(is|feels|seems)\s+(pointless|meaningless|hopeless|not worth it)\b/,
    /\b(i feel|feeling|im|i am|everything is|everything feels)\s+(so\s+|completely\s+|totally\s+)?hopeless\b/,
    /\b(cant|can not|cannot|cant really)\s+(go on|keep going|keep living|do this any\s?more|take (it|this) any\s?more|live like this|live with (this|myself)|be here any\s?more)\b/,
    /\b(goodbye|suicide) (note|letter)\b/,
    /\b(say|saying)\s+goodbye\s+(to\s+everyone|forever)\b/,
    /\bgoodbye forever\b/,
    /\b(disappear|vanish)\s+forever\b/,
    /\b(not|wont|will not)\s+be\s+(here|around|alive)\s+(tomorrow|much longer|any\s?more|for long|next week)\b/,
    /\bwant\s+(it\s+all|everything|my life|the pain)\s+to\s+(end|stop|be over)\b/,
    // Methods.
    /\b(noose|razor blade)\b/,
    /\b(hang|hanging|hanged)\s+myself\b/,
    /\bjump(ing)?\s+(off|from)\s+(a|the|this|my)\s+(bridge|building|roof|cliff|balcony|window|ledge|tower|overpass|parking garage)\b/,
    /\b(jump|jumping|step|stepping|walk|walking|lie|lying)\s+in\s+front\s+of\s+(a|the)\s+(train|bus|car|truck|subway)\b/,
    /\b(gun|pistol|rifle)\s+(to|in)\s+my\s+(head|mouth)\b/,
    /\b(saving|saved|stockpiling|stockpiled|hoarding|collecting)\s+(up\s+)?(my\s+)?(pills|meds|medication|tablets)\b/,
    /\b(pills|meds|tablets)\s+(saved|stockpiled)\b/,
  ],
  "self-harm": [
    new RegExp(`\\b${SELF_VERBS}\\s+myself\\b(?!\\s+out\\b)`),
    /\b(cut|cuts|cutting)\s+myself\b(?!\s+(off|some|a|an|out|short|loose|free|in|back|down)\b)/,
    /\bself\s?(harm\w*|injur\w*|mutilat\w*)/,
    /\b(been|keep|kept|started|start|back to|urge to|urges to|want to|wanna|thinking about)\s+cutting\s+(again|my\s+(arm|arms|wrist|wrists|leg|legs|thigh|thighs|skin))\b/,
    /\bcutting\s+again\b(?!\s+(back|down|out|the|my\s+hair|class|school|corners|costs|carbs|sugar))/,
    /\bcut(ting)?\s+my\s+(wrist|wrists|arm|arms|thigh|thighs|skin)\b/,
    /\bslit(ting)?\s+my\s+(wrist|wrists|throat)\b/,
    /\bmake\s+myself\s+bleed\b/,
    /\brelaps\w*\s+(on|with|into)\s+(self harm|cutting)\b/,
  ],
  "harm-to-others": [
    /\b(kill|killing|hurt|hurting|harm|harming|stab|stabbing|shoot|shooting|strangle|choke|choking|beat|beating|poison)\s+(someone|somebody|people|everyone|everybody|him|her|them|my\s+(wife|husband|partner|kid|kids|child|children|son|daughter|mom|mother|dad|father|baby|family|boss|roommate|girlfriend|boyfriend|coworker|neighbor|teacher))\b(?!\s+(s\s+)?(feelings|at|in|with kindness|chances|to it)\b)/,
    /\b(weapon|weapons|illegal)\b/,
    /\b(shoot|shooting)\s+up\s+(a|the|my)\s+(school|office|work|church|mall|class)\b/,
    /\b(weapon|gun|knife)\s+(to|at)\s+(his|her|their|someone|somebody|my\s+(wife|husband|partner|kid|kids|child|baby))\b/,
    /\b(hurt|hurting|kill)\s+(my|the)\s+(dog|cat|pet)\b/,
  ],
  abuse: [
    /(?<!\b(substance|drug|drugs|alcohol|opioid|pill|pills)\s)\b(abuse|abused|abusing|abusive|abuser)\b/,
    /\bdomestic\s+(violence|abuse)\b/,
    new RegExp(`\\b${PARTNER}\\s+(hits|hit|beats|beat|chokes|choked|strangles|strangled|kicks|kicked|slaps|slapped|punches|punched|hurts|hurt|threatens|threatened|shoves|shoved|pushes|pushed|burns|burned|locks|locked)\\s+(me|us|my)\\b`),
    /\b(being|been|getting|got)\s+(abused|hit|beaten|hurt|choked|kicked|slapped|punched|threatened)\s+(by|at home)\b/,
    /\bthreaten\w*\s+(to\s+)?(kill|hurt)\s+me\b/,
    /\b(scared|afraid|terrified|frightened)\s+(to\s+go|of\s+going)\s+home\b/,
    new RegExp(`\\b(scared|afraid|terrified|frightened)\\s+of\\s+${PARTNER}\\b`),
    /\b(not safe|unsafe|dont feel safe|do not feel safe)\s+(at home|with (him|her|them|my\s+\w+))\b/,
    /\b(weapon|gun|knife)\s+(to|at)\s+(me|my\s+(head|throat))\b/,
  ],
  "sexual-assault": [
    /\b(rape|raped|raping|rapist)\b/,
    /\bsexual(ly)?\s+(assault\w*|abus\w*|harass\w*)\b/,
    /\b(molest\w*|groped|groping)\b/,
    /\b(forced|made|pressured)\s+me\s+(to\s+)?(have sex|into sex|do sexual|into sexual)\b/,
    /\btouched\s+me\s+(without|when i didnt|against)\b/,
    /\b(without\s+(my\s+)?consent|didnt\s+consent|did not\s+consent)\b/,
    /\b(drugged|spiked)\s+(me|my drink)\b/,
  ],
  overdose: [
    /\boverdos\w*/,
    new RegExp(`\\b(${WANT}|going|gonna|about|might|will|i)\\s+(${TO}\\s+)?od\\b`),
    /\b(take|taking|took|swallow|swallowing|swallowed)\s+(all|all of|a bunch of|too many|too much|a lot of|lots of|loads of|a handful of|the whole bottle of|a bottle of|every one of|a whole bottle of)\s+(my\s+|the\s+|these\s+|those\s+)?(pills|meds|medication|medications|tablets|sleeping pills|painkillers|pain killers|tylenol|advil|xanax|insulin)\b/,
    /\b(pills|meds|tablets)\s+to\s+(die|end it|not wake up|sleep forever)\b/,
    /\b(mixed|mixing)\s+(pills|meds|xanax|opioids|benzos)\s+(and|with)\s+(alcohol|drinking|booze|vodka)\b/,
    /\b(drank|drink|drinking|swallowed)\s+(bleach|antifreeze|poison|drain cleaner)\b/,
    /(?<!\bfood\s)\b(poisoned|poisoning)\b/,
    /\b(cant|can not|cannot)\s+breathe\b/,
    /\b(not breathing|stopped breathing|unconscious|unresponsive|wont wake up|passed out and)\b/,
  ],
};

// Not a crisis by itself, but Pivot is not built for these: specialized resources instead of a habit suggestion.
const specializedPatterns: Record<SpecializedCategory, RegExp[]> = {
  "substance-use": [
    /\b(detox|detoxing|withdrawal|withdrawals|delirium tremens)\b/,
    /\b(substance|drug|alcohol|opioid|opiate|heroin|meth|fentanyl|cocaine|crack|pill)\s+(addiction|abuse|use disorder|problem|habit)\b/,
    /\b(addicted\s+to|relaps\w*\s+(on|with)?|using\s+again|shooting\s+up|craving|cravings\s+for)\s*(heroin|meth|fentanyl|cocaine|crack|opioids|opiates|oxy|oxycodone|percs|xanax|benzos|pills|drugs|alcohol|booze|drinking)\b/,
    /\b(heroin|fentanyl|meth|crack cocaine|smoking crack)\b/,
    /\brelaps\w*\b.*\b(drink|drinking|alcohol|drugs|using|heroin|meth|pills|sober|sobriety)\b/,
    /\b(drink|drinking|drunk)\s+(every|each)\s+(night|day|morning)\b/,
    /\b(drink|drinking)\s+(until|till|to)\s+(i\s+)?(pass out|black out|blackout|forget)\b/,
    /\b(alcoholic|alcoholism|gambling addiction|gambling problem)\b/,
  ],
  eating: [
    /\b(eating disorder|anorexia|anorexic|bulimia|bulimic|purging|binge and purge|arfid|orthorexia)\b/,
    /\bmake\s+myself\s+(throw up|puke|vomit|sick)\b/,
    /\b(throw|throwing|threw)\s+up\s+(after|on purpose|everything i eat)\b/,
    /\b(starve|starving|starved)\s+(myself|to lose)\b/,
    /\b(laxatives|diet pills)\s+(to|after)\b/,
  ],
  "mental-health": [
    /\b(psychosis|psychotic|manic episode|hearing voices|seeing things that arent there|hallucinat\w*)\b/,
  ],
};

// Everyday idioms that look like crisis language. Removed before matching, so "killing it at work"
// and "dying to try" never flag, while "killing myself" still does.
const idioms: RegExp[] = [
  /\bkill(ing|ed)?\s+it\b(?!\s+(all|myself))/g,
  /\bkill(ing|ed)?\s+time\b/g,
  /\b(is|are|its|was|were|been)\s+killing\s+me\b/g,
  /\bkill(s|ing)?\s+(me|us)\s+(with|lol|haha)\b/g,
  /\bdying\s+(to|for|of laughter)\b/g,
  /\bto die for\b/g,
  /\bdie\s+(of|from)\s+(embarrassment|laughter|boredom|cuteness)\b/g,
  /\bd\s+die\s+for\b/g,
  /\bbored\s+to\s+death\b/g,
  /\bscared\s+to\s+death\b/g,
  /\bdead\s+(tired|serious|gorgeous|set|end|line|lift)\b/g,
  /\b(drop|dead)\s+dead\b/g,
];

function stripIdioms(text: string) {
  return idioms.reduce((value, idiom) => value.replace(idiom, " "), text).replace(/\s+/g, " ").trim();
}

/** Routes a note: crisis resources, specialized resources, or nothing (a normal suggestion). */
export function assessSafety(input: string): SafetyAssessment {
  if (!input) return { route: null, categories: [] };
  const text = stripIdioms(normalizeForSafety(input));
  if (!text) return { route: null, categories: [] };
  const crisis = (Object.keys(crisisPatterns) as CrisisCategory[]).filter((category) => crisisPatterns[category].some((pattern) => pattern.test(text)));
  if (crisis.length) return { route: "crisis", categories: crisis };
  const specialized = (Object.keys(specializedPatterns) as SpecializedCategory[]).filter((category) => specializedPatterns[category].some((pattern) => pattern.test(text)));
  if (specialized.length) return { route: "specialized", categories: specialized };
  return { route: null, categories: [] };
}

export function hasCrisisLanguage(input: string) {
  return assessSafety(input).route === "crisis";
}

/** Crisis language or other danger: show crisis resources, never a habit suggestion. */
export function hasHighRiskContext(input: string) {
  return assessSafety(input).route === "crisis";
}

/** Clinical topics Pivot is not built for: point to specialized support instead. */
export function hasUnsupportedContext(input: string) {
  return assessSafety(input).route === "specialized";
}

export const crisisResources = {
  call: "tel:988",
  text: "sms:988",
  chat: "https://988lifeline.org/chat/",
  international: "https://findahelpline.com",
} as const;
