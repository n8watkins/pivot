import { createClient, type Client } from "@libsql/client";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

export const SESSION_COOKIE = "pivot_session";
let client: Client | null = null;
const memorySessions = new Map<string, { id: string; createdAt: string }>();

function getClient() {
  if (!client && process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  return client;
}

export async function ensureSession() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(SESSION_COOKIE)?.value;
  const id = existing ?? randomUUID();
  if (!existing) cookieStore.set(SESSION_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" });
  const db = getClient();
  if (db) {
    await db.execute("CREATE TABLE IF NOT EXISTS anonymous_sessions (id TEXT PRIMARY KEY, created_at TEXT NOT NULL)");
    await db.execute({ sql: "INSERT OR IGNORE INTO anonymous_sessions (id, created_at) VALUES (?, ?)", args: [id, new Date().toISOString()] });
  } else if (!memorySessions.has(id)) memorySessions.set(id, { id, createdAt: new Date().toISOString() });
  return id;
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const id = cookieStore.get(SESSION_COOKIE)?.value;
  if (id && getClient()) await getClient()!.execute({ sql: "DELETE FROM anonymous_sessions WHERE id = ?", args: [id] });
  if (id) memorySessions.delete(id);
  cookieStore.delete(SESSION_COOKIE);
}
