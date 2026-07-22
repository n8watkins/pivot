import { NextResponse } from "next/server";
import type { Client } from "@libsql/client";

const buckets = new Map<string, { count: number; resetAt: number }>();

export async function isRateLimited(key: string, limit: number, { windowMs = 60_000, database }: { windowMs?: number; database?: Client | null } = {}) {
  const now = Date.now();
  const db = database;
  if (db) {
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const result = await db.execute({
      sql: "INSERT INTO rate_limits (key, window_start, count, expires_at) VALUES (?, ?, 1, ?) ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1 RETURNING count",
      args: [key, windowStart, windowStart + windowMs],
    });
    if (Math.random() < 0.01) await db.execute({ sql: "DELETE FROM rate_limits WHERE expires_at < ?", args: [now - windowMs] });
    return Number(result.rows[0]?.count ?? 1) > limit;
  }
  if (buckets.size > 5_000) for (const [bucketKey, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(bucketKey);
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) { buckets.set(key, { count: 1, resetAt: now + windowMs }); return false; }
  current.count += 1;
  return current.count > limit;
}

export function rateLimitResponse() {
  return NextResponse.json({ error: "Too many requests. Please pause for a moment and try again." }, { status: 429, headers: { "Retry-After": "60" } });
}
