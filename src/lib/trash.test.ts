import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "./migrations";
import { purgeDeleted, restoreDeleted, RESTORE_WINDOW_MS } from "./trash";

const clients: ReturnType<typeof createClient>[] = [];

async function createTestDatabase() {
  const db = createClient({ url: "file::memory:" });
  clients.push(db);
  await migrate(db);
  for (const [session, pivot] of [["s1", "p1"], ["s1", "p2"], ["s2", "p3"]]) {
    await db.execute({ sql: "INSERT INTO pivots (id, session_id, label, created_at) VALUES (?, ?, ?, '2026-01-01')", args: [pivot, session, `Pivot ${pivot}`] });
    await db.execute({ sql: "INSERT INTO goals (id, session_id, pivot_id, label) VALUES (?, ?, ?, ?)", args: [`g-${pivot}`, session, pivot, `Pivot ${pivot}`] });
    await db.execute({ sql: "INSERT INTO replacements (id, session_id, pivot_id, label) VALUES (?, ?, ?, 'Walk')", args: [`${pivot}:walk`, session, pivot] });
  }
  await db.batch([
    "INSERT INTO urge_sessions (id, session_id, pivot_id, intensity, created_at) VALUES ('u1', 's1', 'p1', 3, '2026-01-01')",
    "INSERT INTO recommendations (id, urge_session_id, replacement_id, source) VALUES ('r1', 'u1', 'walk', 'fallback')",
    "INSERT INTO active_interventions (id, recommendation_id, session_id, pivot_id, started_at, completed_at) VALUES ('a1', 'r1', 's1', 'p1', '2026-01-01', '2026-01-01')",
    "INSERT INTO follow_ups (id, intervention_id, outcome, helpfulness) VALUES ('f1', 'a1', 'Much lighter', 1)",
    "INSERT INTO context_tags (id, session_id, label, created_at) VALUES ('t1', 's1', 'restless', '2026-01-01')",
  ], "write");
  return db;
}

async function count(db: ReturnType<typeof createClient>, sql: string) {
  return Number((await db.execute(sql)).rows[0].count);
}

const now = new Date("2026-11-04T12:00:00.000Z");
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

afterEach(() => {
  for (const client of clients.splice(0)) client.close();
});

describe("soft-deleted items", () => {
  it("restores a pivot inside the window with its id, row order and actions intact", async () => {
    const db = await createTestDatabase();
    await db.execute({ sql: "UPDATE pivots SET deleted_at = ? WHERE id = 'p1'", args: [ago(5_000)] });
    await expect(restoreDeleted(db, { kind: "pivot", sessionId: "s1", id: "p1", now })).resolves.toBe(true);
    const rows = await db.execute("SELECT id FROM pivots WHERE session_id = 's1' AND deleted_at IS NULL ORDER BY rowid");
    expect(rows.rows.map((row) => row.id)).toEqual(["p1", "p2"]);
    expect(await count(db, "SELECT COUNT(*) AS count FROM replacements WHERE pivot_id = 'p1'")).toBe(1);
  });

  it("refuses to restore another session's item or one past the window", async () => {
    const db = await createTestDatabase();
    await db.execute({ sql: "UPDATE pivots SET deleted_at = ? WHERE id = 'p1'", args: [ago(5_000)] });
    await expect(restoreDeleted(db, { kind: "pivot", sessionId: "s2", id: "p1", now })).resolves.toBe(false);
    await db.execute({ sql: "UPDATE pivots SET deleted_at = ? WHERE id = 'p1'", args: [ago(RESTORE_WINDOW_MS + 1)] });
    await expect(restoreDeleted(db, { kind: "pivot", sessionId: "s1", id: "p1", now })).resolves.toBe(false);
  });

  it("finalizing one pivot removes it and its goal and actions, and nothing else", async () => {
    const db = await createTestDatabase();
    await db.execute({ sql: "UPDATE pivots SET deleted_at = ? WHERE id IN ('p1', 'p3')", args: [ago(1_000)] });
    await purgeDeleted(db, { kind: "pivot", sessionId: "s1", id: "p1", now });
    expect(await count(db, "SELECT COUNT(*) AS count FROM pivots WHERE id = 'p1'")).toBe(0);
    expect(await count(db, "SELECT COUNT(*) AS count FROM goals WHERE pivot_id = 'p1'")).toBe(0);
    expect(await count(db, "SELECT COUNT(*) AS count FROM replacements WHERE pivot_id = 'p1'")).toBe(0);
    expect(await count(db, "SELECT COUNT(*) AS count FROM pivots")).toBe(2);
    expect(await count(db, "SELECT COUNT(*) AS count FROM replacements")).toBe(2);
  });

  it("a sweep removes only what is past the restore window", async () => {
    const db = await createTestDatabase();
    await db.execute({ sql: "UPDATE pivots SET deleted_at = ? WHERE id = 'p1'", args: [ago(RESTORE_WINDOW_MS + 1_000)] });
    await db.execute({ sql: "UPDATE pivots SET deleted_at = ? WHERE id = 'p3'", args: [ago(1_000)] });
    await purgeDeleted(db, { now });
    const rows = await db.execute("SELECT id FROM pivots ORDER BY id");
    expect(rows.rows.map((row) => row.id)).toEqual(["p2", "p3"]);
  });

  it("finalizing a History entry removes the whole check-in behind it", async () => {
    const db = await createTestDatabase();
    await db.execute({ sql: "UPDATE follow_ups SET deleted_at = ? WHERE id = 'f1'", args: [ago(1_000)] });
    await purgeDeleted(db, { kind: "history", sessionId: "s1", id: "f1", now });
    for (const table of ["follow_ups", "active_interventions", "recommendations", "urge_sessions"]) expect(await count(db, `SELECT COUNT(*) AS count FROM ${table}`)).toBe(0);
    expect(await count(db, "SELECT COUNT(*) AS count FROM pivots")).toBe(3);
  });

  it("restores a History entry and keeps its check-in", async () => {
    const db = await createTestDatabase();
    await db.execute({ sql: "UPDATE follow_ups SET deleted_at = ? WHERE id = 'f1'", args: [ago(1_000)] });
    await expect(restoreDeleted(db, { kind: "history", sessionId: "s2", id: "f1", now })).resolves.toBe(false);
    await expect(restoreDeleted(db, { kind: "history", sessionId: "s1", id: "f1", now })).resolves.toBe(true);
    expect(await count(db, "SELECT COUNT(*) AS count FROM follow_ups WHERE deleted_at IS NULL")).toBe(1);
  });

  it("restores a tag unless the same tag was added again meanwhile", async () => {
    const db = await createTestDatabase();
    await db.execute({ sql: "UPDATE context_tags SET deleted_at = ? WHERE id = 't1'", args: [ago(1_000)] });
    await expect(restoreDeleted(db, { kind: "tag", sessionId: "s1", id: "restless", now })).resolves.toBe(true);
    await db.execute({ sql: "UPDATE context_tags SET deleted_at = ? WHERE id = 't1'", args: [ago(1_000)] });
    await db.execute("INSERT INTO context_tags (id, session_id, label, created_at) VALUES ('t2', 's1', 'Restless', '2026-01-02')");
    await expect(restoreDeleted(db, { kind: "tag", sessionId: "s1", id: "restless", now })).resolves.toBe(false);
    await purgeDeleted(db, { kind: "tag", sessionId: "s1", id: "restless", now });
    const rows = await db.execute("SELECT id FROM context_tags");
    expect(rows.rows.map((row) => row.id)).toEqual(["t2"]);
  });
});
