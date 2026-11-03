/**
 * Context-aware deterministic ranking.
 *
 * Picks one of the user's approved actions using what they just shared (tag, intensity,
 * time of day) and what helped them before, and explains the pick in plain words built from
 * those inputs. Pure and dependency-free, so the browser can use it when the network fails.
 */

export type RankableAction = { id: string; name: string; duration: string };
export type RankingHistory = { replacementId: string; helpful: boolean; contextType?: string };
export type RankingContext = { tag?: string; intensity?: number; hour?: number };

type Traits = { calm?: boolean; quiet?: boolean; physical?: boolean; outdoor?: boolean; social?: boolean };

// Traits for the built-in actions. Custom actions are neutral except for their length.
const builtInTraits: Record<string, Traits> = {
  walk: { physical: true, outdoor: true },
  breathe: { calm: true, quiet: true },
  stretch: { calm: true, quiet: true, physical: true },
  water: { quiet: true, physical: true },
  friend: { social: true },
};

/** Built-in ids may be namespaced per pivot ("pivot-id:walk"). */
function baseId(id: string) {
  const index = id.lastIndexOf(":");
  return index >= 0 ? id.slice(index + 1) : id;
}

export function durationMinutes(duration: string) {
  const match = duration.match(/(\d+(?:\.\d+)?)\s*(h|hr|hour|m|min|minute|s|sec|second)?/i);
  if (!match) return 5;
  const amount = Number(match[1]);
  const unit = (match[2] ?? "m").toLowerCase();
  return unit.startsWith("h") ? amount * 60 : unit.startsWith("s") ? amount / 60 : amount;
}

function isLate(hour?: number) {
  return typeof hour === "number" && (hour >= 22 || hour < 6);
}

function normalizedTag(tag?: string) {
  return (tag ?? "").trim().toLowerCase();
}

type Signal = { points: number; reason: string; weight: number };

function signalsFor(action: RankableAction, context: RankingContext, history: RankingHistory[]): Signal[] {
  const traits = builtInTraits[baseId(action.id)] ?? {};
  const minutes = durationMinutes(action.duration);
  const short = minutes <= 3;
  const tag = normalizedTag(context.tag);
  const intensity = context.intensity ?? 0;
  const signals: Signal[] = [];

  const sameTag = tag ? history.filter((event) => baseId(event.replacementId) === baseId(action.id) && normalizedTag(event.contextType) === tag) : [];
  const sameTagScore = sameTag.reduce((sum, event) => sum + (event.helpful ? 4 : -3), 0);
  if (sameTagScore > 0) signals.push({ points: sameTagScore, reason: `This helped last time you chose “${(context.tag ?? "").trim()}”.`, weight: 10 });
  else if (sameTagScore < 0) signals.push({ points: sameTagScore, reason: "", weight: 0 });

  const overall = history.filter((event) => baseId(event.replacementId) === baseId(action.id)).reduce((sum, event) => sum + (event.helpful ? 3 : -2), 0);
  if (overall > 0) signals.push({ points: overall, reason: "This has helped you before.", weight: 8 });
  else if (overall < 0) signals.push({ points: overall, reason: "", weight: 0 });

  if (intensity >= 7) {
    if (short) signals.push({ points: 2, reason: "It’s a strong urge, so here’s something short you can start right away.", weight: 6 });
    if (traits.calm) signals.push({ points: 2, reason: "It’s a strong urge, so here’s something calming you can start right away.", weight: 7 });
  }

  if (tag === "tired") {
    if (traits.quiet || traits.calm) signals.push({ points: 2, reason: "You said you’re tired, so here’s something quiet.", weight: 5 });
    if (traits.outdoor) signals.push({ points: -2, reason: "", weight: 0 });
  } else if (tag === "stressed") {
    if (traits.calm) signals.push({ points: 2, reason: "You said you’re stressed, so here’s something calming.", weight: 5 });
    else if (traits.physical) signals.push({ points: 1, reason: "You said you’re stressed, so here’s a way to move some of it out.", weight: 4 });
  } else if (tag === "bored") {
    if (traits.physical || traits.social) signals.push({ points: 2, reason: "You said you’re bored, so here’s something that changes the scene.", weight: 5 });
  } else if (tag === "avoiding something") {
    if (short) signals.push({ points: 2, reason: "Here’s one small step that’s easy to start.", weight: 5 });
  } else if (tag === "just automatic") {
    if (traits.physical) signals.push({ points: 2, reason: "When it’s on autopilot, a small physical action breaks the loop.", weight: 5 });
  }

  if (isLate(context.hour)) {
    if (traits.outdoor) signals.push({ points: -3, reason: "", weight: 0 });
    if (traits.social) signals.push({ points: -1, reason: "", weight: 0 });
    if (traits.quiet) signals.push({ points: 1, reason: "It’s late, so here’s something you can do without heading out.", weight: 3 });
  }

  return signals;
}

export type RankedAction<T> = { action: T; score: number; reason: string };

/**
 * Ranks actions by context and history. The user's own list order only breaks ties, so
 * what they just shared and what helped them before always count for more.
 */
export function rankWithContext<T extends RankableAction>(options: T[], context: RankingContext = {}, history: RankingHistory[] = []): RankedAction<T>[] {
  return options
    .map((action, index) => {
      const signals = signalsFor(action, context, history);
      const score = signals.reduce((sum, signal) => sum + signal.points, 0) + (options.length - index) * 0.1;
      const best = signals.filter((signal) => signal.points > 0 && signal.reason).sort((a, b) => b.weight - a.weight)[0];
      return { action, score, reason: best?.reason ?? defaultReason };
    })
    .sort((a, b) => b.score - a.score);
}

export const defaultReason = "One of your own actions, and a quick way to change the shape of this moment.";
