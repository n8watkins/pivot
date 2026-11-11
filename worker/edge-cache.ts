// The Worker's own edge cache (Workers Cache, https://developers.cloudflare.com/workers/cache/).
//
// Pivot's pages are static: Next.js marks them `s-maxage=31536000`, the same HTML for
// everyone, and the app loads each visitor's data from the API routes afterwards. Without
// a cache in front, OpenNext still rendered every view (about 290 ms of CPU for "/").
//
// The default entrypoint (worker/handlers.ts) runs on every request and is cheap: it
// decides here whether a request may be answered from the cache, and if so passes it to
// the CachedPages entrypoint (worker/index.ts), which Cloudflare's cache sits in front
// of (wrangler.jsonc "cache" and "exports"). A hit returns the stored page without
// running Next.js, so it costs no CPU time.
//
// - The request: a GET or HEAD for the site's own host, not for an API route.
// - The response: only a 200 that Next.js marks shared (`s-maxage`), or one of the share
//   images and the manifest, and that sets no cookie. Everything else is marked no-store
//   for the edge, so the cache's default rules never keep it.
// - The visitor's session cookie: src/proxy.ts gives a first visit its pivot_session ID
//   before anything runs. A cached page cannot carry a per-visitor cookie, so the default
//   entrypoint assigns the ID instead (withSession) and the page is rendered as if the
//   visitor already had one.
//
// Each deploy starts with an empty cache (the Worker version is part of the key).

/** The longest an edge copy stays fresh before Cloudflare asks the Worker again. */
const MAX_EDGE_TTL_SECONDS = 86_400;

const EDGE_STALE_SECONDS = 86_400;

/** Rendered on request by Next.js, but the same until the next deploy. */
const STATIC_FILES = new Set(["/opengraph-image", "/twitter-image", "/manifest.webmanifest"]);

/** The anonymous session cookie (src/lib/session-cookie.ts SESSION_COOKIE). */
export const SESSION_COOKIE = "pivot_session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Whether this request may be answered from the edge cache. */
export function mayUseEdgeCache(request: Request, host: string): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const url = new URL(request.url);
  // The cache key has no host in it, so workers.dev never reads or writes it.
  if (url.hostname !== host) return false;
  if (url.pathname.startsWith("/api/")) return false;
  if (request.headers.has("authorization")) return false;
  return true;
}

function sharedMaxAge(cacheControl: string): number | null {
  const match = /(?:^|,)\s*s-maxage=(\d+)/i.exec(cacheControl);
  return match ? Number(match[1]) : null;
}

/** How long the edge may keep this response: seconds, or 0 for not at all. */
export function edgeTtl(request: Request, response: Response): number {
  if (response.status !== 200 || response.headers.has("set-cookie")) return 0;
  if (STATIC_FILES.has(new URL(request.url).pathname)) return MAX_EDGE_TTL_SECONDS;
  const cacheControl = response.headers.get("cache-control") ?? "";
  if (/\b(private|no-store|no-cache)\b/i.test(cacheControl)) return 0;
  const shared = sharedMaxAge(cacheControl);
  return shared === null ? 0 : Math.min(shared, MAX_EDGE_TTL_SECONDS);
}

/**
 * The response marked for the edge. The Cloudflare-CDN-Cache-Control header is read by
 * Cloudflare and never reaches browsers, which keep the Cache-Control Next.js sent.
 */
export function forEdge(request: Request, response: Response): Response {
  const ttl = edgeTtl(request, response);
  const marked = new Response(response.body, response);
  marked.headers.set(
    "Cloudflare-CDN-Cache-Control",
    ttl > 0 ? `public, max-age=${ttl}, stale-while-revalidate=${EDGE_STALE_SECONDS}` : "no-store",
  );
  return marked;
}

function sessionId(request: Request): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === SESSION_COOKIE && value.join("=")) return value.join("=");
  }
  return null;
}

/**
 * The request as it goes to the cache, with a session ID for a first visit, and the
 * Set-Cookie that gives the browser that ID (null when it already has one). It matches
 * the cookie src/proxy.ts would set.
 */
export function withSession(request: Request): { request: Request; setCookie: string | null } {
  if (sessionId(request)) return { request, setCookie: null };
  const id = crypto.randomUUID();
  const headers = new Headers(request.headers);
  const cookie = headers.get("cookie");
  headers.set("cookie", cookie ? `${cookie}; ${SESSION_COOKIE}=${id}` : `${SESSION_COOKIE}=${id}`);
  return {
    request: new Request(request, { headers }),
    setCookie: `${SESSION_COOKIE}=${id}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
  };
}

/** A cached response handed to the browser with the session cookie it needs. */
export function withSetCookie(response: Response, setCookie: string | null): Response {
  if (!setCookie) return response;
  const sent = new Response(response.body, response);
  sent.headers.append("Set-Cookie", setCookie);
  return sent;
}
