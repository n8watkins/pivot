import { createClient, type Client } from "@libsql/client";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

export const SESSION_COOKIE = "pivot_session";
let client: Client | null = null;
const memorySessions = new Map<string, { id: string; createdAt: string }>();
const memoryEvents = new Map<string, { id: string; sessionId: string; type: string; payload: string }>();

export function getDatabase() {
  if (!client && process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  return client;
}

export async function initializeDatabase() {
  const db = getDatabase();
  if (!db) return;
  await db.batch([
    "CREATE TABLE IF NOT EXISTS anonymous_sessions (id TEXT PRIMARY KEY, created_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS goals (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, label TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS replacements (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, label TEXT NOT NULL, detail TEXT NOT NULL, duration TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS urge_sessions (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, intensity INTEGER, context_type TEXT, created_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS recommendations (id TEXT PRIMARY KEY, urge_session_id TEXT NOT NULL, replacement_id TEXT NOT NULL, source TEXT NOT NULL, reason TEXT NOT NULL, first_step TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS active_interventions (id TEXT PRIMARY KEY, recommendation_id TEXT NOT NULL, started_at TEXT NOT NULL, completed_at TEXT)",
    "CREATE TABLE IF NOT EXISTS follow_ups (id TEXT PRIMARY KEY, intervention_id TEXT NOT NULL, outcome TEXT NOT NULL, helpfulness INTEGER)",
    "CREATE TABLE IF NOT EXISTS privacy_events (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL)",
  ].map((sql) => ({ sql, args: [] })), "write");
}

export async function ensureSession() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(SESSION_COOKIE)?.value;
  const id = existing ?? randomUUID();
  if (!existing) cookieStore.set(SESSION_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" });
  const db = getDatabase();
  if (db) {
    await initializeDatabase();
    await db.execute({ sql: "INSERT OR IGNORE INTO anonymous_sessions (id, created_at) VALUES (?, ?)", args: [id, new Date().toISOString()] });
  } else if (!memorySessions.has(id)) memorySessions.set(id, { id, createdAt: new Date().toISOString() });
  return id;
}

export async function recordEvent(type: string, payload: Record<string, unknown>) {
  const sessionId = await ensureSession();
  const event = { id: randomUUID(), sessionId, type, payload: JSON.stringify(payload) };
  if (getDatabase()) await getDatabase()!.execute({ sql: "INSERT INTO privacy_events (id, session_id, type, payload, created_at) VALUES (?, ?, ?, ?, ?)", args: [event.id, event.sessionId, event.type, event.payload, new Date().toISOString()] });
  else memoryEvents.set(event.id, event);
  return event.id;
}

export async function deleteEvent(id: string) {
  const sessionId = await ensureSession();
  if (getDatabase()) await getDatabase()!.execute({ sql: "DELETE FROM privacy_events WHERE id = ? AND session_id = ?", args: [id, sessionId] });
  memoryEvents.delete(id);
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const id = cookieStore.get(SESSION_COOKIE)?.value;
  if (id && getDatabase()) {
    const db = getDatabase()!;
    await db.batch([
      "DELETE FROM follow_ups WHERE intervention_id IN (SELECT id FROM active_interventions WHERE recommendation_id IN (SELECT id FROM recommendations WHERE urge_session_id IN (SELECT id FROM urge_sessions WHERE session_id = ?)))",
      "DELETE FROM active_interventions WHERE recommendation_id IN (SELECT id FROM recommendations WHERE urge_session_id IN (SELECT id FROM urge_sessions WHERE session_id = ?))",
      "DELETE FROM recommendations WHERE urge_session_id IN (SELECT id FROM urge_sessions WHERE session_id = ?)",
      "DELETE FROM urge_sessions WHERE session_id = ?",
      "DELETE FROM replacements WHERE session_id = ?",
      "DELETE FROM goals WHERE session_id = ?",
      "DELETE FROM privacy_events WHERE session_id = ?",
      "DELETE FROM anonymous_sessions WHERE id = ?",
    ].map((sql) => ({ sql, args: [id] })), "write");
  }
  if (id) memorySessions.delete(id);
  for (const [eventId, event] of memoryEvents) if (event.sessionId === id) memoryEvents.delete(eventId);
  cookieStore.delete(SESSION_COOKIE);
}
