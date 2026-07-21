import { randomUUID } from "node:crypto";
import { ensureSession, getDatabase, initializeDatabase } from "./session";
import type { ReplacementOption } from "./recommendation";
import { replacementInputSchema } from "./schemas";

export type PivotSnapshot = {
  goal: string;
  goals: string[];
  replacements: ReplacementOption[];
  history: { id: string; replacementId: string; choice: string; outcome: string; helpful: boolean; date: string }[];
  active?: { id: string; replacementId: string; startedAt: string };
};

const memoryState = new Map<string, PivotSnapshot>();
const memoryActive = new Map<string, { id: string; sessionId: string; replacementId: string; startedAt: string }>();

export async function saveSetup(goals: string[], replacements: ReplacementOption[]) {
  const sessionId = await ensureSession();
  const db = getDatabase();
  const parsed = replacements.map((replacement) => replacementInputSchema.parse(replacement));
  if (!db) {
    memoryState.set(sessionId, { goal: goals[0] ?? "", goals, replacements: parsed, history: memoryState.get(sessionId)?.history ?? [], active: memoryState.get(sessionId)?.active });
    return sessionId;
  }
  await initializeDatabase();
  await db.execute({ sql: "DELETE FROM replacements WHERE session_id = ?", args: [sessionId] });
  await db.execute({ sql: "DELETE FROM goals WHERE session_id = ?", args: [sessionId] });
  for (const goal of goals) await db.execute({ sql: "INSERT INTO goals (id, session_id, label, created_at) VALUES (?, ?, ?, ?)", args: [randomUUID(), sessionId, goal.trim(), new Date().toISOString()] });
  for (const replacement of parsed) await db.execute({ sql: "INSERT INTO replacements (id, session_id, label, detail, duration) VALUES (?, ?, ?, ?, ?)", args: [`${sessionId}:${replacement.id}`, sessionId, replacement.name, replacement.detail, replacement.duration] });
  return sessionId;
}

export async function getSnapshot(): Promise<PivotSnapshot> {
  const sessionId = await ensureSession();
  const db = getDatabase();
  if (!db) return memoryState.get(sessionId) ?? { goal: "", goals: [], replacements: [], history: [] };
  await initializeDatabase();
  const [goal, replacements, history, active] = await Promise.all([
    db.execute({ sql: "SELECT label FROM goals WHERE session_id = ? ORDER BY rowid", args: [sessionId] }),
    db.execute({ sql: "SELECT CASE WHEN instr(id, ':') > 0 THEN substr(id, instr(id, ':') + 1) ELSE id END as id, label as name, detail, duration FROM replacements WHERE session_id = ? ORDER BY rowid", args: [sessionId] }),
    db.execute({ sql: "SELECT f.id, r.replacement_id as replacementId, rp.label as choice, f.outcome, f.helpfulness, f.rowid as date FROM follow_ups f JOIN active_interventions a ON a.id = f.intervention_id JOIN recommendations r ON r.id = a.recommendation_id JOIN urge_sessions u ON u.id = r.urge_session_id JOIN replacements rp ON rp.session_id = u.session_id AND (rp.id = r.replacement_id OR (instr(rp.id, ':') > 0 AND substr(rp.id, instr(rp.id, ':') + 1) = r.replacement_id)) WHERE u.session_id = ? ORDER BY f.rowid DESC LIMIT 30", args: [sessionId] }),
    db.execute({ sql: "SELECT id, replacement_id as replacementId, started_at as startedAt FROM active_interventions WHERE session_id = ? AND completed_at IS NULL ORDER BY started_at DESC LIMIT 1", args: [sessionId] }),
  ]);
  const activeRow = active.rows[0];
  const goals = goal.rows.map((row) => String(row.label));
  return { goal: goals[0] ?? "", goals, replacements: replacements.rows as unknown as ReplacementOption[], history: history.rows.map((row) => ({ id: String(row.id), replacementId: String(row.replacementId), choice: String(row.choice), outcome: String(row.outcome), helpful: Boolean(row.helpfulness), date: String(row.date) })), active: activeRow ? { id: String(activeRow.id), replacementId: String(activeRow.replacementId), startedAt: String(activeRow.startedAt) } : undefined };
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
    { sql: "INSERT INTO follow_ups (id, intervention_id, outcome, helpfulness) VALUES (?, ?, ?, ?)", args: [followUpId, interventionId, input.outcome, input.helpful ? 1 : 0] },
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
