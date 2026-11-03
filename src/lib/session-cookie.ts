export const SESSION_COOKIE = "pivot_session";

export function sessionCookieOptions() {
  return { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false", maxAge: 60 * 60 * 24 * 365, path: "/" } as const;
}
