import { randomUUID } from "node:crypto";
import { ensureSession, getDatabase, initializeDatabase } from "./session";
import type { ReplacementOption } from "./recommendation";
import { replacementInputSchema } from "./schemas";
import { purgeDeleted, restoreDeleted, RESTORE_WINDOW_MS, type TrashKind } from "./trash";

export type PivotSnapshot = {
  goal: string;
  goals: string[];
  replacements: ReplacementOption[];
  pivots: { id: string; goal: string; replacements: ReplacementOption[] }[];
  contextTags: string[];
  history: { id: string; pivotId: string; pivotGoal: string; replacementId: string; choice: string; outcome: string; helpful: boolean; date: string; contextType?: string }[];
  active?: { id: string; pivotId: string; replacementId: string; reason: string; firstStep: string; source: "gemini" | "fallback"; startedAt: string };
};

type PivotInput = { id: string; goal: string; replacements: ReplacementOption[] };

const memoryState = new Map<string, PivotSnapshot>();
const memoryActive = new Map<string, { id: string; sessionId: string; pivotId: string; replacementId: string; reason: string; firstStep: string; source: "gemini" | "fallback"; startedAt: string }>();
const memoryFollowUps = new Map<string, string>();
// Without a database, soft-deleted items wait here until they are restored or purged.
type MemoryTrashItem = { kind: TrashKind; id: string; deletedAt: number; restore: (snapshot: PivotSnapshot) => PivotSnapshot };
const memoryTrash = new Map<string, MemoryTrashItem[]>();

function trashInMemory(sessionId: string, item: MemoryTrashItem) {
  const now = Date.now();
  const kept = (memoryTrash.get(sessionId) ?? []).filter((entry) => now - entry.deletedAt < RESTORE_WINDOW_MS && !(entry.kind === item.kind && entry.id === item.id));
  memoryTrash.set(sessionId, [...kept, item]);
}

function insertAt<T>(items: T[], index: number, item: T) {
  const next = [...items];
  next.splice(Math.min(index, next.length), 0, item);
  return next;
}

function withPivots(snapshot: PivotSnapshot, pivots: PivotSnapshot["pivots"]): PivotSnapshot {
  return { ...snapshot, goal: pivots[0]?.goal ?? "", goals: pivots.map((item) => item.goal), replacements: pivots.flatMap((item) => item.replacements), pivots };
}

export function clearMemoryPivotState(sessionId: string) {
  memoryState.delete(sessionId);
  memoryActive.delete(sessionId);
  for (const [interventionId] of memoryFollowUps) if (interventionId.startsWith(`${sessionId}:`)) memoryFollowUps.delete(interventionId);
  memoryTrash.delete(sessionId);
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
    if (memoryActive.has(sessionId)) return false;
    const grouped = pivots.length ? pivots.map((pivot) => ({ ...pivot, replacements: pivot.replacements.map((replacement) => replacementInputSchema.parse(replacement)) })) : goals[0] ? [{ id: "legacy", goal: goals[0], replacements: parsed }] : [];
    memoryState.set(sessionId, { goal: goals[0] ?? "", goals, replacements: parsed, pivots: grouped, contextTags: memoryState.get(sessionId)?.contextTags ?? [], history: memoryState.get(sessionId)?.history ?? [], active: memoryState.get(sessionId)?.active });
    return true;
  }
  await initializeDatabase();
  const grouped = pivots.length ? pivots : goals.map((goal, index) => ({ id: `legacy-${index}`, goal, replacements: parsed }));
  const statements = [
    { sql: "DELETE FROM replacements WHERE session_id = ?", args: [sessionId] },
    { sql: "DELETE FROM goals WHERE session_id = ?", args: [sessionId] },
    { sql: "DELETE FROM pivots WHERE session_id = ?", args: [sessionId] },
  ];
  for (const pivot of grouped) {
    const now = new Date().toISOString();
    const goalId = randomUUID();
    statements.push({ sql: "INSERT INTO pivots (id, session_id, label, created_at) VALUES (?, ?, ?, ?)", args: [pivot.id, sessionId, pivot.goal.trim(), now] });
    statements.push({ sql: "INSERT INTO goals (id, session_id, pivot_id, label, created_at) VALUES (?, ?, ?, ?, ?)", args: [goalId, sessionId, pivot.id, pivot.goal.trim(), now] });
    for (const replacement of pivot.replacements.map((item) => replacementInputSchema.parse(item))) statements.push({ sql: "INSERT INTO replacements (id, session_id, pivot_id, label, detail, duration) VALUES (?, ?, ?, ?, ?, ?)", args: [`${pivot.id}:${replacement.id}`, sessionId, pivot.id, replacement.name, replacement.detail, replacement.duration] });
  }
  const transaction = await db.transaction("write");
  try {
    const active = await transaction.execute({ sql: "SELECT 1 FROM active_interventions WHERE session_id = ? AND completed_at IS NULL LIMIT 1", args: [sessionId] });
    if (active.rows[0]) { await transaction.rollback(); return false; }
    await transaction.batch(statements);
    await transaction.commit();
    return true;
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally { transaction.close(); }
}

export async function createPivot(pivot: PivotInput) {
  const sessionId = await ensureSession();
  const replacements = pivot.replacements.map((replacement) => replacementInputSchema.parse(replacement));
  const db = getDatabase();
  if (!db) {
    const snapshot = await getSnapshot();
    memoryState.set(sessionId, { ...snapshot, goal: snapshot.goal || pivot.goal, goals: [...snapshot.goals, pivot.goal], replacements: [...snapshot.replacements, ...replacements], pivots: [...snapshot.pivots, { ...pivot, replacements }] });
    return pivot;
  }
  await initializeDatabase();
  const now = new Date().toISOString();
  await db.batch([
    { sql: "INSERT INTO pivots (id, session_id, label, created_at) VALUES (?, ?, ?, ?)", args: [pivot.id, sessionId, pivot.goal, now] },
    { sql: "INSERT INTO goals (id, session_id, pivot_id, label, created_at) VALUES (?, ?, ?, ?, ?)", args: [randomUUID(), sessionId, pivot.id, pivot.goal, now] },
    ...replacements.map((replacement) => ({ sql: "INSERT INTO replacements (id, session_id, pivot_id, label, detail, duration) VALUES (?, ?, ?, ?, ?, ?)", args: [`${pivot.id}:${replacement.id}`, sessionId, pivot.id, replacement.name, replacement.detail, replacement.duration] })),
  ], "write");
  return { ...pivot, replacements };
}

export async function updatePivot(pivot: PivotInput) {
  const sessionId = await ensureSession();
  const replacements = pivot.replacements.map((replacement) => replacementInputSchema.parse(replacement));
  const db = getDatabase();
  if (!db) {
    const snapshot = await getSnapshot();
    if (!snapshot.pivots.some((item) => item.id === pivot.id)) return "not_found" as const;
    if (memoryActive.get(sessionId)?.pivotId === pivot.id) return "active" as const;
    const pivots = snapshot.pivots.map((item) => item.id === pivot.id ? { ...pivot, replacements } : item);
    memoryState.set(sessionId, { ...snapshot, goal: pivots[0]?.goal ?? "", goals: pivots.map((item) => item.goal), replacements: pivots.flatMap((item) => item.replacements), pivots });
    return "updated" as const;
  }
  await initializeDatabase();
  const transaction = await db.transaction("write");
  try {
    const exists = await transaction.execute({ sql: "SELECT 1 FROM pivots WHERE id = ? AND session_id = ? AND deleted_at IS NULL", args: [pivot.id, sessionId] });
    if (!exists.rows[0]) { await transaction.rollback(); return "not_found" as const; }
    const active = await transaction.execute({ sql: "SELECT 1 FROM active_interventions WHERE session_id = ? AND pivot_id = ? AND completed_at IS NULL", args: [sessionId, pivot.id] });
    if (active.rows[0]) { await transaction.rollback(); return "active" as const; }
    await transaction.batch([
      { sql: "UPDATE pivots SET label = ? WHERE id = ? AND session_id = ?", args: [pivot.goal, pivot.id, sessionId] },
      { sql: "UPDATE goals SET label = ? WHERE pivot_id = ? AND session_id = ?", args: [pivot.goal, pivot.id, sessionId] },
      { sql: "DELETE FROM replacements WHERE pivot_id = ? AND session_id = ?", args: [pivot.id, sessionId] },
      ...replacements.map((replacement) => ({ sql: "INSERT INTO replacements (id, session_id, pivot_id, label, detail, duration) VALUES (?, ?, ?, ?, ?, ?)", args: [`${pivot.id}:${replacement.id}`, sessionId, pivot.id, replacement.name, replacement.detail, replacement.duration] })),
    ]);
    await transaction.commit();
    return "updated" as const;
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally { transaction.close(); }
}

/** Soft-deletes a pivot so it can be restored from the Undo toast; see src/lib/trash.ts. */
export async function deletePivot(pivotId: string) {
  const sessionId = await ensureSession();
  const db = getDatabase();
  if (!db) {
    const snapshot = await getSnapshot();
    const index = snapshot.pivots.findIndex((item) => item.id === pivotId);
    if (index < 0) return "not_found" as const;
    if (memoryActive.get(sessionId)?.pivotId === pivotId) return "active" as const;
    const removed = snapshot.pivots[index];
    trashInMemory(sessionId, { kind: "pivot", id: pivotId, deletedAt: Date.now(), restore: (current) => withPivots(current, insertAt(current.pivots, index, removed)) });
    memoryState.set(sessionId, withPivots(snapshot, snapshot.pivots.filter((item) => item.id !== pivotId)));
    return "deleted" as const;
  }
  await initializeDatabase();
  await purgeDeleted(db, { sessionId });
  const transaction = await db.transaction("write");
  try {
    const exists = await transaction.execute({ sql: "SELECT 1 FROM pivots WHERE id = ? AND session_id = ? AND deleted_at IS NULL", args: [pivotId, sessionId] });
    if (!exists.rows[0]) { await transaction.rollback(); return "not_found" as const; }
    const active = await transaction.execute({ sql: "SELECT 1 FROM active_interventions WHERE session_id = ? AND pivot_id = ? AND completed_at IS NULL", args: [sessionId, pivotId] });
    if (active.rows[0]) { await transaction.rollback(); return "active" as const; }
    await transaction.execute({ sql: "UPDATE pivots SET deleted_at = ? WHERE id = ? AND session_id = ?", args: [new Date().toISOString(), pivotId, sessionId] });
    await transaction.commit();
    return "deleted" as const;
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally { transaction.close(); }
}

/** Undo: brings a soft-deleted pivot, History entry or tag back. False once it is gone for good. */
export async function restoreDeletedItem(kind: TrashKind, id: string) {
  const sessionId = await ensureSession();
  const db = getDatabase();
  if (!db) {
    const items = memoryTrash.get(sessionId) ?? [];
    const item = items.find((entry) => entry.kind === kind && entry.id === id && Date.now() - entry.deletedAt < RESTORE_WINDOW_MS);
    if (!item) return false;
    memoryTrash.set(sessionId, items.filter((entry) => entry !== item));
    memoryState.set(sessionId, item.restore(await getSnapshot()));
    return true;
  }
  await initializeDatabase();
  return restoreDeleted(db, { kind, sessionId, id });
}

/** The Undo toast closed: remove a soft-deleted item for good instead of waiting for the cron. */
export async function finalizeDeletedItem(kind: TrashKind, id: string) {
  const sessionId = await ensureSession();
  const db = getDatabase();
  if (!db) {
    memoryTrash.set(sessionId, (memoryTrash.get(sessionId) ?? []).filter((entry) => !(entry.kind === kind && entry.id === id)));
    return;
  }
  await initializeDatabase();
  await purgeDeleted(db, { kind, sessionId, id });
}

// Goals and replacements of a soft-deleted pivot stay hidden with it.
const notInDeletedPivot = "(pivot_id IS NULL OR pivot_id NOT IN (SELECT id FROM pivots WHERE session_id = ? AND deleted_at IS NOT NULL))";

export async function getSnapshot(): Promise<PivotSnapshot> {
  const sessionId = await ensureSession();
  const db = getDatabase();
  if (!db) return memoryState.get(sessionId) ?? { goal: "", goals: [], replacements: [], pivots: [], contextTags: [], history: [] };
  await initializeDatabase();
  const [pivotRows, goal, replacements, contextTags, history, active] = await Promise.all([
    db.execute({ sql: "SELECT id, label FROM pivots WHERE session_id = ? AND deleted_at IS NULL ORDER BY rowid", args: [sessionId] }),
    db.execute({ sql: `SELECT label, pivot_id FROM goals WHERE session_id = ? AND ${notInDeletedPivot} ORDER BY rowid`, args: [sessionId, sessionId] }),
    db.execute({ sql: "SELECT CASE WHEN instr(id, ':') > 0 THEN substr(id, instr(id, ':') + 1) ELSE id END as id, pivot_id as pivotId, label as name, detail, duration FROM replacements WHERE session_id = ? AND " + notInDeletedPivot + " ORDER BY rowid", args: [sessionId, sessionId] }),
    db.execute({ sql: "SELECT label FROM context_tags WHERE session_id = ? AND deleted_at IS NULL ORDER BY created_at", args: [sessionId] }),
    db.execute({ sql: "SELECT f.id, COALESCE(u.pivot_id, '') as pivotId, COALESCE(NULLIF(u.pivot_label, ''), p.label, 'Past pivot') as pivotGoal, r.replacement_id as replacementId, COALESCE(NULLIF(r.replacement_label, ''), (SELECT rp.label FROM replacements rp WHERE rp.session_id = u.session_id AND (rp.id = r.replacement_id OR (instr(rp.id, ':') > 0 AND substr(rp.id, instr(rp.id, ':') + 1) = r.replacement_id)) AND (u.pivot_id IS NULL OR rp.pivot_id = u.pivot_id) LIMIT 1), 'Past action') as choice, f.outcome, f.helpfulness, u.context_type as contextType, COALESCE(NULLIF(f.created_at, ''), a.completed_at, a.started_at) as date FROM follow_ups f JOIN active_interventions a ON a.id = f.intervention_id JOIN recommendations r ON r.id = a.recommendation_id JOIN urge_sessions u ON u.id = r.urge_session_id LEFT JOIN pivots p ON p.id = u.pivot_id AND p.session_id = u.session_id WHERE u.session_id = ? AND f.deleted_at IS NULL ORDER BY COALESCE(NULLIF(f.created_at, ''), a.completed_at, a.started_at) DESC LIMIT 30", args: [sessionId] }),
    db.execute({ sql: "SELECT id, COALESCE(pivot_id, '') as pivotId, replacement_id as replacementId, reason, first_step as firstStep, source, started_at as startedAt FROM active_interventions WHERE session_id = ? AND completed_at IS NULL ORDER BY started_at DESC LIMIT 1", args: [sessionId] }),
  ]);
  const activeRow = active.rows[0];
  const goals = goal.rows.map((row) => String(row.label));
  const allReplacements = replacements.rows.map((row) => ({ id: String(row.id), name: String(row.name), detail: String(row.detail), duration: String(row.duration), pivotId: row.pivotId ? String(row.pivotId) : undefined }));
  const storedPivots = pivotRows.rows.map((row) => ({ id: String(row.id), goal: String(row.label), replacements: allReplacements.filter((replacement) => replacement.pivotId === String(row.id)).map(publicReplacement) })).filter((pivot) => pivot.goal && pivot.replacements.length);
  const pivots = storedPivots.length ? storedPivots : goals[0] && allReplacements.length ? [{ id: "legacy", goal: goals[0], replacements: allReplacements.map(publicReplacement) }] : [];
  return { goal: goals[0] ?? "", goals, replacements: allReplacements.map(publicReplacement), pivots, contextTags: contextTags.rows.map((row) => String(row.label)), history: history.rows.map((row) => ({ id: String(row.id), pivotId: String(row.pivotId), pivotGoal: String(row.pivotGoal), replacementId: String(row.replacementId), choice: String(row.choice), outcome: String(row.outcome), helpful: Boolean(row.helpfulness), date: String(row.date), contextType: String(row.contextType ?? "") })), active: activeRow ? { id: String(activeRow.id), pivotId: String(activeRow.pivotId), replacementId: String(activeRow.replacementId), reason: String(activeRow.reason), firstStep: String(activeRow.firstStep), source: activeRow.source === "gemini" ? "gemini" : "fallback", startedAt: String(activeRow.startedAt) } : undefined };
}

export async function saveContextTag(label: string) {
  const sessionId = await ensureSession();
  const value = label.trim();
  const db = getDatabase();
  if (!db) { const snapshot = await getSnapshot(); if (!snapshot.contextTags.some((tag) => tag.toLowerCase() === value.toLowerCase())) memoryState.set(sessionId, { ...snapshot, contextTags: [...snapshot.contextTags, value] }); return; }
  await initializeDatabase();
  await db.execute({ sql: "INSERT INTO context_tags (id, session_id, label, created_at) SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM context_tags WHERE session_id = ? AND lower(label) = lower(?) AND deleted_at IS NULL)", args: [randomUUID(), sessionId, value, new Date().toISOString(), sessionId, value] });
}

export async function deleteContextTag(label: string) {
  const sessionId = await ensureSession();
  const db = getDatabase();
  if (!db) {
    const snapshot = await getSnapshot();
    const index = snapshot.contextTags.indexOf(label);
    if (index < 0) return;
    trashInMemory(sessionId, { kind: "tag", id: label, deletedAt: Date.now(), restore: (current) => current.contextTags.some((tag) => tag.toLowerCase() === label.toLowerCase()) ? current : { ...current, contextTags: insertAt(current.contextTags, index, label) } });
    memoryState.set(sessionId, { ...snapshot, contextTags: snapshot.contextTags.filter((tag) => tag !== label) });
    return;
  }
  await initializeDatabase();
  await purgeDeleted(db, { sessionId });
  await db.execute({ sql: "UPDATE context_tags SET deleted_at = ? WHERE session_id = ? AND label = ? AND deleted_at IS NULL", args: [new Date().toISOString(), sessionId, label] });
}

export async function deleteHistoryEvent(id: string) {
  const sessionId = await ensureSession();
  const db = getDatabase();
  if (!db) {
    const snapshot = await getSnapshot();
    const index = snapshot.history.findIndex((event) => event.id === id);
    if (index < 0) return false;
    const removed = snapshot.history[index];
    trashInMemory(sessionId, { kind: "history", id, deletedAt: Date.now(), restore: (current) => ({ ...current, history: insertAt(current.history, index, removed) }) });
    memoryState.set(sessionId, { ...snapshot, history: snapshot.history.filter((event) => event.id !== id) });
    return true;
  }
  await initializeDatabase();
  await purgeDeleted(db, { sessionId });
  const result = await db.execute({ sql: "UPDATE follow_ups SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL AND intervention_id IN (SELECT id FROM active_interventions WHERE session_id = ?)", args: [new Date().toISOString(), id, sessionId] });
  return result.rowsAffected > 0;
}

export async function recordClosedLoop(input: { interventionId: string; pivotId: string; replacementId: string; outcome: string; helpful: boolean }) {
  const sessionId = await ensureSession();
  const db = getDatabase();
  if (!db) {
    const snapshot = await getSnapshot();
    const pivot = snapshot.pivots.find((option) => option.id === input.pivotId);
    const replacement = pivot?.replacements.find((option) => option.id === input.replacementId);
    if (!pivot || !replacement) throw new Error("Replacement is not approved for this pivot");
    const completedKey = `${sessionId}:${input.interventionId}`;
    const existingId = memoryFollowUps.get(completedKey);
    if (existingId) return existingId;
    const active = memoryActive.get(sessionId);
    if (!active || active.id !== input.interventionId || active.pivotId !== input.pivotId || active.replacementId !== input.replacementId) throw new Error("Active intervention was not found");
    const eventId = randomUUID();
    const history = [{ id: eventId, pivotId: pivot.id, pivotGoal: pivot.goal, replacementId: input.replacementId, choice: replacement.name, outcome: input.outcome, helpful: input.helpful, date: new Date().toISOString() }, ...snapshot.history];
    memoryActive.delete(sessionId);
    memoryFollowUps.set(completedKey, eventId);
    memoryState.set(sessionId, { ...snapshot, history, active: undefined });
    return eventId;
  }
  await initializeDatabase();
  const transaction = await db.transaction("write");
  try {
    const existing = await transaction.execute({ sql: "SELECT f.id FROM follow_ups f JOIN active_interventions a ON a.id = f.intervention_id WHERE f.intervention_id = ? AND a.session_id = ?", args: [input.interventionId, sessionId] });
    if (existing.rows[0]) { await transaction.rollback(); return String(existing.rows[0].id); }
    const active = await transaction.execute({ sql: "SELECT id FROM active_interventions WHERE id = ? AND session_id = ? AND pivot_id = ? AND replacement_id = ? AND completed_at IS NULL", args: [input.interventionId, sessionId, input.pivotId, input.replacementId] });
    if (!active.rows[0]) throw new Error("Active intervention was not found");
    const followUpId = randomUUID();
    const now = new Date().toISOString();
    await transaction.batch([
      { sql: "UPDATE active_interventions SET completed_at = ? WHERE id = ? AND session_id = ? AND completed_at IS NULL", args: [now, input.interventionId, sessionId] },
      { sql: "INSERT INTO follow_ups (id, intervention_id, outcome, helpfulness, created_at) VALUES (?, ?, ?, ?, ?)", args: [followUpId, input.interventionId, input.outcome, input.helpful ? 1 : 0, now] },
    ]);
    await transaction.commit();
    return followUpId;
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally { transaction.close(); }
}

export async function startIntervention(input: { replacementId: string; pivotId: string; reason: string; firstStep: string; source: "gemini" | "fallback"; intensity: number; contextType: string }) {
  const sessionId = await ensureSession();
  const active = { id: randomUUID(), sessionId, ...input, startedAt: new Date().toISOString() };
  if (!getDatabase()) {
    const snapshot = await getSnapshot();
    if (!snapshot.pivots.find((pivot) => pivot.id === input.pivotId)?.replacements.some((replacement) => replacement.id === input.replacementId)) throw new Error("Replacement is not approved for this pivot");
    memoryActive.set(sessionId, active);
    memoryState.set(sessionId, { ...snapshot, active: { id: active.id, pivotId: input.pivotId, replacementId: input.replacementId, reason: input.reason, firstStep: input.firstStep, source: input.source, startedAt: active.startedAt } });
  }
  else {
    const db = getDatabase()!;
    const urgeId = randomUUID();
    const recommendationId = randomUUID();
    await initializeDatabase();
    const transaction = await db.transaction("write");
    try {
      const approved = await transaction.execute({ sql: "SELECT p.label AS pivotGoal, r.label AS replacementName FROM pivots p JOIN replacements r ON r.pivot_id = p.id AND r.session_id = p.session_id WHERE p.id = ? AND p.session_id = ? AND p.deleted_at IS NULL AND r.id = ?", args: [input.pivotId, sessionId, `${input.pivotId}:${input.replacementId}`] });
      if (!approved.rows[0]) throw new Error("Replacement is not approved for this pivot");
      await transaction.batch([
        { sql: "DELETE FROM urge_sessions WHERE id IN (SELECT r.urge_session_id FROM recommendations r JOIN active_interventions a ON a.recommendation_id = r.id WHERE a.session_id = ? AND a.completed_at IS NULL)", args: [sessionId] },
        { sql: "DELETE FROM recommendations WHERE id IN (SELECT recommendation_id FROM active_interventions WHERE session_id = ? AND completed_at IS NULL)", args: [sessionId] },
        { sql: "DELETE FROM active_interventions WHERE session_id = ? AND completed_at IS NULL", args: [sessionId] },
        { sql: "INSERT INTO urge_sessions (id, session_id, pivot_id, pivot_label, intensity, context_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [urgeId, sessionId, input.pivotId, String(approved.rows[0].pivotGoal), input.intensity, input.contextType, active.startedAt] },
        { sql: "INSERT INTO recommendations (id, urge_session_id, replacement_id, replacement_label, source, reason, first_step, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", args: [recommendationId, urgeId, input.replacementId, String(approved.rows[0].replacementName), input.source, input.reason, input.firstStep, active.startedAt] },
        { sql: "INSERT INTO active_interventions (id, recommendation_id, session_id, pivot_id, replacement_id, reason, first_step, source, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", args: [active.id, recommendationId, sessionId, input.pivotId, input.replacementId, input.reason, input.firstStep, input.source, active.startedAt] },
      ]);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    } finally { transaction.close(); }
  }
  const { sessionId: _sessionId, intensity: _intensity, contextType: _contextType, ...publicActive } = active;
  void _sessionId;
  void _intensity;
  void _contextType;
  return publicActive;
}
