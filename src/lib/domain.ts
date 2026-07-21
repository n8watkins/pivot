import { randomUUID } from "node:crypto";
import { ensureSession, getDatabase, initializeDatabase } from "./session";
import type { ReplacementOption } from "./recommendation";
import { replacementInputSchema } from "./schemas";

export type PivotSnapshot = {
  goal: string;
  goals: string[];
  replacements: ReplacementOption[];
  pivots: { id: string; goal: string; replacements: ReplacementOption[] }[];
  contextTags: string[];
  history: { id: string; replacementId: string; choice: string; outcome: string; helpful: boolean; date: string }[];
  active?: { id: string; replacementId: string; startedAt: string };
};

const memoryState = new Map<string, PivotSnapshot>();
const memoryActive = new Map<string, { id: string; sessionId: string; replacementId: string; startedAt: string }>();

export function clearMemoryPivotState(sessionId: string) {
  memoryState.delete(sessionId);
  memoryActive.delete(sessionId);
}

function publicReplacement(replacement: { pivotId?: string; id: string; name: string; detail: string; duration: string }) {
  const { pivotId, ...result } = replacement;
  void pivotId;
  return result;
}

export async function saveSetup(goals: string[], replacements: ReplacementOption[], pivots: { id: string; goal: string; replacements: ReplacementOption[] }[] = []) {
  const sessionId = await ensureSession();
  const db = getDatabase();
  const parsed = replacements.map((replacement) => replacementInputSchema.parse(replacement));
  if (!db) {
    const grouped = pivots.length ? pivots.map((pivot) => ({ ...pivot, replacements: pivot.replacements.map((replacement) => replacementInputSchema.parse(replacement)) })) : goals[0] ? [{ id: "legacy", goal: goals[0], replacements: parsed }] : [];
    memoryState.set(sessionId, { goal: goals[0] ?? "", goals, replacements: parsed, pivots: grouped, contextTags: memoryState.get(sessionId)?.contextTags ?? [], history: memoryState.get(sessionId)?.history ?? [], active: memoryState.get(sessionId)?.active });
    return sessionId;
  }
  await initializeDatabase();
  await db.execute({ sql: "DELETE FROM replacements WHERE session_id = ?", args: [sessionId] });
  await db.execute({ sql: "DELETE FROM goals WHERE session_id = ?", args: [sessionId] });
  await db.execute({ sql: "DELETE FROM pivots WHERE session_id = ?", args: [sessionId] });
  const grouped = pivots.length ? pivots : goals.map((goal, index) => ({ id: `legacy-${index}`, goal, replacements: parsed }));
  for (const pivot of grouped) {
    await db.execute({ sql: "INSERT INTO pivots (id, session_id, label, created_at) VALUES (?, ?, ?, ?)", args: [pivot.id, sessionId, pivot.goal.trim(), new Date().toISOString()] });
    const goalId = randomUUID();
    await db.execute({ sql: "INSERT INTO goals (id, session_id, pivot_id, label, created_at) VALUES (?, ?, ?, ?, ?)", args: [goalId, sessionId, pivot.id, pivot.goal.trim(), new Date().toISOString()] });
    for (const replacement of pivot.replacements.map((item) => replacementInputSchema.parse(item))) await db.execute({ sql: "INSERT INTO replacements (id, session_id, pivot_id, label, detail, duration) VALUES (?, ?, ?, ?, ?, ?)", args: [`${pivot.id}:${replacement.id}`, sessionId, pivot.id, replacement.name, replacement.detail, replacement.duration] });
  }
  return sessionId;
}

export async function getSnapshot(): Promise<PivotSnapshot> {
  const sessionId = await ensureSession();
  const db = getDatabase();
  if (!db) return memoryState.get(sessionId) ?? { goal: "", goals: [], replacements: [], pivots: [], contextTags: [], history: [] };
  await initializeDatabase();
  const [pivotRows, goal, replacements, contextTags, history, active] = await Promise.all([
    db.execute({ sql: "SELECT id, label FROM pivots WHERE session_id = ? ORDER BY rowid", args: [sessionId] }),
    db.execute({ sql: "SELECT label, pivot_id FROM goals WHERE session_id = ? ORDER BY rowid", args: [sessionId] }),
    db.execute({ sql: "SELECT CASE WHEN instr(id, ':') > 0 THEN substr(id, instr(id, ':') + 1) ELSE id END as id, pivot_id as pivotId, label as name, detail, duration FROM replacements WHERE session_id = ? ORDER BY rowid", args: [sessionId] }),
    db.execute({ sql: "SELECT label FROM context_tags WHERE session_id = ? ORDER BY created_at", args: [sessionId] }),
    db.execute({ sql: "SELECT f.id, r.replacement_id as replacementId, rp.label as choice, f.outcome, f.helpfulness, COALESCE(NULLIF(f.created_at, ''), a.completed_at, a.started_at) as date FROM follow_ups f JOIN active_interventions a ON a.id = f.intervention_id JOIN recommendations r ON r.id = a.recommendation_id JOIN urge_sessions u ON u.id = r.urge_session_id JOIN replacements rp ON rp.session_id = u.session_id AND (rp.id = r.replacement_id OR (instr(rp.id, ':') > 0 AND substr(rp.id, instr(rp.id, ':') + 1) = r.replacement_id)) WHERE u.session_id = ? ORDER BY COALESCE(NULLIF(f.created_at, ''), a.completed_at, a.started_at) DESC LIMIT 30", args: [sessionId] }),
    db.execute({ sql: "SELECT id, replacement_id as replacementId, started_at as startedAt FROM active_interventions WHERE session_id = ? AND completed_at IS NULL ORDER BY started_at DESC LIMIT 1", args: [sessionId] }),
  ]);
  const activeRow = active.rows[0];
  const goals = goal.rows.map((row) => String(row.label));
  const allReplacements = replacements.rows.map((row) => ({ id: String(row.id), name: String(row.name), detail: String(row.detail), duration: String(row.duration), pivotId: row.pivotId ? String(row.pivotId) : undefined }));
  const storedPivots = pivotRows.rows.map((row) => ({ id: String(row.id), goal: String(row.label), replacements: allReplacements.filter((replacement) => replacement.pivotId === String(row.id)).map(publicReplacement) })).filter((pivot) => pivot.goal && pivot.replacements.length);
  const pivots = storedPivots.length ? storedPivots : goals[0] && allReplacements.length ? [{ id: "legacy", goal: goals[0], replacements: allReplacements.map(publicReplacement) }] : [];
  return { goal: goals[0] ?? "", goals, replacements: allReplacements.map(publicReplacement), pivots, contextTags: contextTags.rows.map((row) => String(row.label)), history: history.rows.map((row) => ({ id: String(row.id), replacementId: String(row.replacementId), choice: String(row.choice), outcome: String(row.outcome), helpful: Boolean(row.helpfulness), date: String(row.date) })), active: activeRow ? { id: String(activeRow.id), replacementId: String(activeRow.replacementId), startedAt: String(activeRow.startedAt) } : undefined };
}

export async function saveContextTag(label: string) {
  const sessionId = await ensureSession();
  const value = label.trim();
  const db = getDatabase();
  if (!db) { const snapshot = await getSnapshot(); if (!snapshot.contextTags.some((tag) => tag.toLowerCase() === value.toLowerCase())) memoryState.set(sessionId, { ...snapshot, contextTags: [...snapshot.contextTags, value] }); return; }
  await initializeDatabase();
  await db.execute({ sql: "INSERT INTO context_tags (id, session_id, label, created_at) SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM context_tags WHERE session_id = ? AND lower(label) = lower(?))", args: [randomUUID(), sessionId, value, new Date().toISOString(), sessionId, value] });
}

export async function deleteContextTag(label: string) {
  const sessionId = await ensureSession();
  const db = getDatabase();
  if (!db) { const snapshot = await getSnapshot(); memoryState.set(sessionId, { ...snapshot, contextTags: snapshot.contextTags.filter((tag) => tag !== label) }); return; }
  await initializeDatabase();
  await db.execute({ sql: "DELETE FROM context_tags WHERE session_id = ? AND label = ?", args: [sessionId, label] });
}

export async function deleteHistoryEvent(id: string) {
  const sessionId = await ensureSession();
  const db = getDatabase();
  if (!db) { const snapshot = await getSnapshot(); const exists = snapshot.history.some((event) => event.id === id); memoryState.set(sessionId, { ...snapshot, history: snapshot.history.filter((event) => event.id !== id) }); return exists; }
  await initializeDatabase();
  const linked = await db.execute({ sql: "SELECT a.id as interventionId, r.id as recommendationId, u.id as urgeId FROM follow_ups f JOIN active_interventions a ON a.id = f.intervention_id JOIN recommendations r ON r.id = a.recommendation_id JOIN urge_sessions u ON u.id = r.urge_session_id WHERE f.id = ? AND u.session_id = ?", args: [id, sessionId] });
  const row = linked.rows[0];
  if (!row) return false;
  await db.batch([
    { sql: "DELETE FROM follow_ups WHERE id = ?", args: [id] },
    { sql: "DELETE FROM active_interventions WHERE id = ?", args: [String(row.interventionId)] },
    { sql: "DELETE FROM recommendations WHERE id = ?", args: [String(row.recommendationId)] },
    { sql: "DELETE FROM urge_sessions WHERE id = ?", args: [String(row.urgeId)] },
  ], "write");
  return true;
}

export async function recordClosedLoop(input: { replacementId: string; intensity: number; contextType: string; reason: string; firstStep: string; source: string; outcome: string; helpful: boolean }) {
  const sessionId = await ensureSession();
  const db = getDatabase();
  const snapshot = await getSnapshot();
  const replacement = snapshot.replacements.find((option) => option.id === input.replacementId);
  if (!replacement) throw new Error("Replacement is not approved for this session");
  if (!db) {
    const history = [{ id: randomUUID(), replacementId: input.replacementId, choice: replacement.name, outcome: input.outcome, helpful: input.helpful, date: new Date().toISOString() }, ...snapshot.history];
    memoryActive.delete(sessionId);
    memoryState.set(sessionId, { ...snapshot, history, active: undefined });
    return;
  }
  await initializeDatabase();
  const urgeId = randomUUID();
  const recommendationId = randomUUID();
  const interventionId = randomUUID();
  const followUpId = randomUUID();
  const now = new Date().toISOString();
  await db.batch([
    { sql: "INSERT INTO urge_sessions (id, session_id, intensity, context_type, created_at) VALUES (?, ?, ?, ?, ?)", args: [urgeId, sessionId, input.intensity, input.contextType, now] },
    { sql: "INSERT INTO recommendations (id, urge_session_id, replacement_id, source, reason, first_step) VALUES (?, ?, ?, ?, ?, ?)", args: [recommendationId, urgeId, input.replacementId, input.source, input.reason, input.firstStep] },
    { sql: "INSERT INTO active_interventions (id, recommendation_id, started_at, completed_at) VALUES (?, ?, ?, ?)", args: [interventionId, recommendationId, now, now] },
    { sql: "INSERT INTO follow_ups (id, intervention_id, outcome, helpfulness, created_at) VALUES (?, ?, ?, ?, ?)", args: [followUpId, interventionId, input.outcome, input.helpful ? 1 : 0, now] },
  ], "write");
  await db.execute({ sql: "UPDATE active_interventions SET completed_at = ? WHERE session_id = ? AND replacement_id = ? AND completed_at IS NULL", args: [now, sessionId, input.replacementId] });
}

export async function startIntervention(replacementId: string) {
  const sessionId = await ensureSession();
  const snapshot = await getSnapshot();
  if (!snapshot.replacements.some((replacement) => replacement.id === replacementId)) throw new Error("Replacement is not approved for this session");
  const active = { id: randomUUID(), sessionId, replacementId, startedAt: new Date().toISOString() };
  if (!getDatabase()) { memoryActive.set(sessionId, active); const snapshotWithActive = await getSnapshot(); memoryState.set(sessionId, { ...snapshotWithActive, active: { id: active.id, replacementId, startedAt: active.startedAt } }); }
  else {
    await getDatabase()!.execute({ sql: "INSERT INTO active_interventions (id, recommendation_id, session_id, replacement_id, started_at) VALUES (?, ?, ?, ?, ?)", args: [active.id, randomUUID(), sessionId, replacementId, active.startedAt] });
  }
  return active;
}
