import type { Client, InStatement } from "@libsql/client";

// Deleting a pivot, a History entry or a context tag first marks the row with deleted_at, so the
// "Deleted · Undo" toast can bring it back exactly as it was (same id, same position, same
// History links). The row is removed for good when the toast closes, when the same session
// deletes something else after the restore window, or by the hourly cron, whichever is first.

/** How long a soft-deleted row can still be restored. Longer than the toast, to absorb slow networks. */
export const RESTORE_WINDOW_MS = 2 * 60_000;

export type TrashKind = "pivot" | "history" | "tag";

export const trashKinds: readonly TrashKind[] = ["pivot", "history", "tag"];

type Scope = { sessionId?: string; id?: string; deletedBefore?: string };

function restoreCutoff(now: Date) {
  return new Date(now.getTime() - RESTORE_WINDOW_MS).toISOString();
}

/** The soft-deleted rows of one kind that a purge with this scope removes, as a WHERE clause. */
function doomed(kind: TrashKind, scope: Scope, alias = "") {
  const column = (name: string) => `${alias}${name}`;
  const clauses = [`${column("deleted_at")} IS NOT NULL`];
  const args: string[] = [];
  if (scope.sessionId) {
    clauses.push(kind === "history" ? `${column("intervention_id")} IN (SELECT id FROM active_interventions WHERE session_id = ?)` : `${column("session_id")} = ?`);
    args.push(scope.sessionId);
  }
  if (scope.id) {
    clauses.push(`${column(kind === "tag" ? "label" : "id")} = ?`);
    args.push(scope.id);
  }
  if (scope.deletedBefore) {
    clauses.push(`${column("deleted_at")} <= ?`);
    args.push(scope.deletedBefore);
  }
  return { where: clauses.join(" AND "), args };
}

/** The pivot and tag deletes; History needs a lookup first, see purgeHistory. */
function purgeStatements(kind: TrashKind, scope: Scope): InStatement[] {
  if (kind === "pivot") {
    const { where, args } = doomed(kind, scope);
    const ids = `SELECT id FROM pivots WHERE ${where}`;
    return [
      { sql: `DELETE FROM replacements WHERE pivot_id IN (${ids})`, args },
      { sql: `DELETE FROM goals WHERE pivot_id IN (${ids})`, args },
      { sql: `DELETE FROM pivots WHERE ${where}`, args },
    ];
  }
  if (kind === "tag") {
    const { where, args } = doomed(kind, scope);
    return [{ sql: `DELETE FROM context_tags WHERE ${where}`, args }];
  }
  return [];
}

/** A History entry is a follow-up plus the check-in records behind it: they go together. */
async function purgeHistory(db: Client, scope: Scope) {
  const { where, args } = doomed("history", scope, "f.");
  const transaction = await db.transaction("write");
  try {
    const linked = await transaction.execute({ sql: `SELECT f.id, a.id AS interventionId, r.id AS recommendationId, r.urge_session_id AS urgeId FROM follow_ups f LEFT JOIN active_interventions a ON a.id = f.intervention_id LEFT JOIN recommendations r ON r.id = a.recommendation_id WHERE ${where}`, args });
    const ids = (column: string) => linked.rows.map((row) => row[column]).filter((value): value is string => typeof value === "string");
    const remove = (table: string, values: string[]) => values.length ? [{ sql: `DELETE FROM ${table} WHERE id IN (${values.map(() => "?").join(", ")})`, args: values }] : [];
    const statements = [...remove("follow_ups", ids("id")), ...remove("active_interventions", ids("interventionId")), ...remove("recommendations", ids("recommendationId")), ...remove("urge_sessions", ids("urgeId"))];
    if (statements.length) await transaction.batch(statements);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally { transaction.close(); }
}

/**
 * Removes soft-deleted rows for good. With an id it purges that one row (the toast closed);
 * with only a session or nothing it purges whatever is past the restore window.
 */
export async function purgeDeleted(db: Client, scope: { kind?: TrashKind; sessionId?: string; id?: string; now?: Date } = {}) {
  const kinds = scope.kind ? [scope.kind] : trashKinds;
  const deletedBefore = scope.id ? undefined : restoreCutoff(scope.now ?? new Date());
  const rowScope = { sessionId: scope.sessionId, id: scope.id, deletedBefore };
  const statements = kinds.flatMap((kind) => purgeStatements(kind, rowScope));
  if (statements.length) await db.batch(statements, "write");
  if (kinds.includes("history")) await purgeHistory(db, rowScope);
}

/** Brings back a soft-deleted row while it is inside the restore window. True when it was restored. */
export async function restoreDeleted(db: Client, input: { kind: TrashKind; sessionId: string; id: string; now?: Date }) {
  const cutoff = restoreCutoff(input.now ?? new Date());
  if (input.kind === "pivot") {
    const result = await db.execute({ sql: "UPDATE pivots SET deleted_at = NULL WHERE id = ? AND session_id = ? AND deleted_at IS NOT NULL AND deleted_at > ?", args: [input.id, input.sessionId, cutoff] });
    return result.rowsAffected > 0;
  }
  if (input.kind === "history") {
    const result = await db.execute({ sql: "UPDATE follow_ups SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL AND deleted_at > ? AND intervention_id IN (SELECT id FROM active_interventions WHERE session_id = ?)", args: [input.id, cutoff, input.sessionId] });
    return result.rowsAffected > 0;
  }
  // A tag with the same name may have been added again since; keep a single copy then.
  const result = await db.execute({
    sql: "UPDATE context_tags SET deleted_at = NULL WHERE id = (SELECT id FROM context_tags WHERE session_id = ? AND label = ? AND deleted_at IS NOT NULL AND deleted_at > ? ORDER BY deleted_at DESC LIMIT 1) AND NOT EXISTS (SELECT 1 FROM context_tags WHERE session_id = ? AND lower(label) = lower(?) AND deleted_at IS NULL)",
    args: [input.sessionId, input.id, cutoff, input.sessionId, input.id],
  });
  return result.rowsAffected > 0;
}
