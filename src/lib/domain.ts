import { randomUUID } from "node:crypto";
import { ensureSession, getDatabase, initializeDatabase } from "./session";
import type { ReplacementOption } from "./recommendation";

export type PivotSnapshot = {
  goal: string;
  replacements: ReplacementOption[];
  history: { id: string; replacementId: string; choice: string; outcome: string; helpful: boolean; date: string }[];
};

export async function saveSetup(goal: string, replacements: ReplacementOption[]) {
  const sessionId = await ensureSession();
  const db = getDatabase();
  if (!db) return sessionId;
  await initializeDatabase();
  await db.execute({ sql: "DELETE FROM replacements WHERE session_id = ?", args: [sessionId] });
  await db.execute({ sql: "DELETE FROM goals WHERE session_id = ?", args: [sessionId] });
  await db.execute({ sql: "INSERT INTO goals (id, session_id, label) VALUES (?, ?, ?)", args: [randomUUID(), sessionId, goal.trim()] });
  for (const replacement of replacements) await db.execute({ sql: "INSERT INTO replacements (id, session_id, label, detail, duration) VALUES (?, ?, ?, ?, ?)", args: [replacement.id, sessionId, replacement.name, replacement.detail, replacement.duration] });
  return sessionId;
}

export async function getSnapshot(): Promise<PivotSnapshot> {
  const sessionId = await ensureSession();
  const db = getDatabase();
  if (!db) return { goal: "", replacements: [], history: [] };
  await initializeDatabase();
  const [goal, replacements, history] = await Promise.all([
    db.execute({ sql: "SELECT label FROM goals WHERE session_id = ? LIMIT 1", args: [sessionId] }),
    db.execute({ sql: "SELECT id, label as name, detail, duration FROM replacements WHERE session_id = ? ORDER BY rowid", args: [sessionId] }),
    db.execute({ sql: "SELECT f.id, r.replacement_id as replacementId, rp.label as choice, f.outcome, f.helpfulness, f.rowid as date FROM follow_ups f JOIN active_interventions a ON a.id = f.intervention_id JOIN recommendations r ON r.id = a.recommendation_id JOIN replacements rp ON rp.id = r.replacement_id JOIN urge_sessions u ON u.id = r.urge_session_id WHERE u.session_id = ? ORDER BY f.rowid DESC LIMIT 30", args: [sessionId] }),
  ]);
  return { goal: String(goal.rows[0]?.label ?? ""), replacements: replacements.rows as unknown as ReplacementOption[], history: history.rows.map((row) => ({ id: String(row.id), replacementId: String(row.replacementId), choice: String(row.choice), outcome: String(row.outcome), helpful: Boolean(row.helpfulness), date: String(row.date) })) };
}

export async function recordClosedLoop(input: { replacementId: string; intensity: number; contextType: string; reason: string; firstStep: string; source: string; outcome: string; helpful: boolean }) {
  const sessionId = await ensureSession();
  const db = getDatabase();
  if (!db) return;
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
}
