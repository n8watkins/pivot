import { createClient, type Client } from "@libsql/client";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { migrate } from "./migrations";
import { auth, isAuthConfigured } from "@/auth";
import { linkGitHubAccount } from "./account";
import { getRuntimeCapabilities } from "./config";

export const SESSION_COOKIE = "pivot_session";
let client: Client | null = null;
let initialization: Promise<void> | null = null;
const memorySessions = new Map<string, { id: string; createdAt: string }>();
const memoryEvents = new Map<string, { id: string; sessionId: string; type: string; payload: string }>();

export function getDatabase() {
  if (!client && process.env.TURSO_DATABASE_URL) client = createClient({ url: process.env.TURSO_DATABASE_URL, ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}) });
  if (!client && !getRuntimeCapabilities().persistentStorageReady) throw new Error("TURSO_DATABASE_URL is required in production so Pivot does not lose user data");
  return client;
}

export async function initializeDatabase() {
  const db = getDatabase();
  if (!db) return;
  initialization ??= migrate(db).catch((error) => {
    initialization = null;
    throw error;
  });
  await initialization;
}

export async function ensureSession() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(SESSION_COOKIE)?.value;
  const id = existing ?? randomUUID();
  if (!existing) cookieStore.set(SESSION_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false", maxAge: 60 * 60 * 24 * 365, path: "/" });
  const db = getDatabase();
  if (db) {
    await initializeDatabase();
    await db.execute({ sql: "INSERT OR IGNORE INTO anonymous_sessions (id, created_at) VALUES (?, ?)", args: [id, new Date().toISOString()] });
  } else if (!memorySessions.has(id)) memorySessions.set(id, { id, createdAt: new Date().toISOString() });
  if (!db || !isAuthConfigured) return id;
  const accountSession = await auth().catch(() => null);
  const githubId = accountSession?.user?.githubId;
  if (!githubId) return id;
  const login = accountSession.user.githubLogin || accountSession.user.name || "GitHub user";
  const avatar = accountSession.user.image ?? null;
  const linked = await linkGitHubAccount(db, id, { id: githubId, login, avatarUrl: avatar });
  if (linked.sessionId !== id) cookieStore.set(SESSION_COOKIE, linked.sessionId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false", maxAge: 60 * 60 * 24 * 365, path: "/" });
  return linked.sessionId;
}

export async function leaveAccountSession() {
  const cookieStore = await cookies();
  const id = randomUUID();
  const now = new Date().toISOString();
  const db = getDatabase();
  if (db) {
    await initializeDatabase();
    await db.execute({ sql: "INSERT INTO anonymous_sessions (id, created_at) VALUES (?, ?)", args: [id, now] });
  } else memorySessions.set(id, { id, createdAt: now });
  cookieStore.set(SESSION_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false", maxAge: 60 * 60 * 24 * 365, path: "/" });
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
    await initializeDatabase();
    await db.batch([
      "DELETE FROM follow_ups WHERE intervention_id IN (SELECT id FROM active_interventions WHERE recommendation_id IN (SELECT id FROM recommendations WHERE urge_session_id IN (SELECT id FROM urge_sessions WHERE session_id = ?)))",
      "DELETE FROM active_interventions WHERE session_id = ?",
      "DELETE FROM active_interventions WHERE recommendation_id IN (SELECT id FROM recommendations WHERE urge_session_id IN (SELECT id FROM urge_sessions WHERE session_id = ?))",
      "DELETE FROM recommendations WHERE urge_session_id IN (SELECT id FROM urge_sessions WHERE session_id = ?)",
      "DELETE FROM urge_sessions WHERE session_id = ?",
      "DELETE FROM replacements WHERE session_id = ?",
      "DELETE FROM goals WHERE session_id = ?",
      "DELETE FROM pivots WHERE session_id = ?",
      "DELETE FROM context_tags WHERE session_id = ?",
      "DELETE FROM privacy_events WHERE session_id = ?",
      "DELETE FROM accounts WHERE canonical_session_id = ?",
      "DELETE FROM anonymous_sessions WHERE id = ?",
    ].map((sql) => ({ sql, args: [id] })), "write");
  }
  if (id) memorySessions.delete(id);
  for (const [eventId, event] of memoryEvents) if (event.sessionId === id) memoryEvents.delete(eventId);
  cookieStore.delete(SESSION_COOKIE);
}
