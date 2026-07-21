import { NextResponse } from "next/server";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(key: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  if (buckets.size > 5_000) for (const [bucketKey, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(bucketKey);
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) { buckets.set(key, { count: 1, resetAt: now + windowMs }); return false; }
  current.count += 1;
  return current.count > limit;
}

export function rateLimitResponse() {
  return NextResponse.json({ error: "Too many requests. Please pause for a moment and try again." }, { status: 429, headers: { "Retry-After": "60" } });
}
