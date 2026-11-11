// The Worker's handlers around the OpenNext build of the Next.js app.
//
// scheduled: the hourly Cron Trigger sends due check-ins. It calls the existing
// /api/cron/notifications route in-process through the OpenNext fetch handler
// (no network hop), so the delivery code stays in the Next.js bundle and keeps
// its route-level tests. The route authorizes the call with CRON_SECRET.

import { errorSummary, logError, pathOf } from "../src/lib/log";
import { healthCheck } from "./health";
import { mayUseEdgeCache, withSession, withSetCookie } from "./edge-cache";

/** The cached entrypoint (worker/index.ts), reached through ctx.exports. */
export type CachedPagesExports = {
  exports: { CachedPages: { fetch(request: Request): Promise<Response> } };
};

export type FetchHandler = {
  fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response>;
};

// Handled in-process, so the host never resolves. The host header must match
// it: without one, OpenNext treats a proxy rewrite as external and fetches it
// over the network.
const INTERNAL_HOST = "worker.internal";
export const INTERNAL_CRON_URL = `https://${INTERNAL_HOST}/api/cron/notifications`;

export async function runNotificationCron(app: FetchHandler, env: CloudflareEnv, ctx: ExecutionContext) {
  if (!env.CRON_SECRET) {
    // Same as the old GitHub Actions schedule: check-ins stay off until the secret is set.
    console.log(JSON.stringify({ event: "notification_cron_skipped", reason: "CRON_SECRET is not set" }));
    return;
  }
  const request = new Request(INTERNAL_CRON_URL, {
    headers: { host: INTERNAL_HOST, authorization: `Bearer ${env.CRON_SECRET}` },
  });
  const response = await app.fetch(request, env, ctx);
  const body: unknown = await response.json().catch(() => null);
  if (response.status === 503) {
    // Web Push or storage is not configured yet: nothing to send, not a failure.
    console.log(JSON.stringify({ event: "notification_cron_skipped", status: 503, body }));
    return;
  }
  if (!response.ok) throw new Error(`notification cron failed with status ${response.status}`);
  console.log(JSON.stringify({ event: "notification_cron", ...(body && typeof body === "object" ? body : {}) }));
}

export function createWorker(app: FetchHandler) {
  return {
    async fetch(request, env, ctx) {
      // The uptime check answers before the edge cache, Next.js, auth or the database.
      const health = healthCheck(request);
      if (health) return health;
      try {
        if (mayUseEdgeCache(request, new URL(env.AUTH_URL).hostname)) {
          const { request: cacheable, setCookie } = withSession(request);
          const cached = (ctx as ExecutionContext & CachedPagesExports).exports.CachedPages;
          return withSetCookie(await cached.fetch(cacheable), setCookie);
        }
        return await app.fetch(request, env, ctx);
      } catch (err) {
        // Next reports its own errors (instrumentation onRequestError); this
        // is for a throw that escapes OpenNext itself.
        logError({
          event: "unhandled_exception",
          reason: "worker_fetch_threw",
          route: pathOf(request.url),
          method: request.method,
          status: 500,
          error: errorSummary(err),
        });
        throw err;
      }
    },

    async scheduled(_controller, env, ctx) {
      await runNotificationCron(app, env, ctx);
    },
  } satisfies ExportedHandler<CloudflareEnv>;
}
