import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session-cookie";

// A first visit loads several API routes in parallel. If each of them minted its own
// session, the browser would keep whichever cookie arrived last while data (a push
// subscription, say) landed under another one. Assigning the session here, before the
// page or any route runs, gives every request of the visit the same ID.
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const id = crypto.randomUUID();
  request.cookies.set(SESSION_COOKIE, id);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(SESSION_COOKIE, id, sessionCookieOptions());
  return response;
}

export const config = {
  // Pages and the API routes that read the session; not static files, auth callbacks or the cron job.
  matcher: ["/((?!_next/static|_next/image|api/auth|api/cron|api/health|icons/|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|ico|webmanifest)$).*)"],
};
