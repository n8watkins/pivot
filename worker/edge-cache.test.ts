import { describe, expect, it, vi } from "vitest";

import { edgeTtl, forEdge, mayUseEdgeCache, withSession, withSetCookie } from "./edge-cache";
import { createWorker, type FetchHandler } from "./handlers";

const host = "pivot.n8builds.dev";
const at = (path: string, init?: RequestInit) => new Request(`https://${host}${path}`, init);
const page = (cacheControl: string, init: ResponseInit = {}) =>
  new Response("<html>", { ...init, headers: { "Cache-Control": cacheControl, ...init.headers } });

describe("mayUseEdgeCache", () => {
  it("lets page views and share images use the cache, never the API or other hosts", () => {
    expect(mayUseEdgeCache(at("/"), host)).toBe(true);
    expect(mayUseEdgeCache(at("/help", { method: "HEAD" }), host)).toBe(true);
    expect(mayUseEdgeCache(at("/opengraph-image"), host)).toBe(true);
    expect(mayUseEdgeCache(at("/api/trash"), host)).toBe(false);
    expect(mayUseEdgeCache(at("/", { method: "POST" }), host)).toBe(false);
    expect(mayUseEdgeCache(new Request("https://pivot.example.workers.dev/"), host)).toBe(false);
  });
});

describe("edgeTtl", () => {
  it("keeps static pages for a day and the share images until the next deploy", () => {
    expect(edgeTtl(at("/"), page("s-maxage=31536000"))).toBe(86_400);
    expect(edgeTtl(at("/opengraph-image"), page("public, max-age=0, must-revalidate"))).toBe(86_400);
  });

  it("never keeps dynamic pages, cookies or errors", () => {
    expect(edgeTtl(at("/settings"), page("private, no-cache, no-store, max-age=0, must-revalidate"))).toBe(0);
    expect(edgeTtl(at("/"), page("s-maxage=31536000", { headers: { "Set-Cookie": "pivot_session=x" } }))).toBe(0);
    expect(edgeTtl(at("/"), page("s-maxage=31536000", { status: 500 }))).toBe(0);
    expect(edgeTtl(at("/"), new Response("<html>"))).toBe(0);
    expect(forEdge(at("/"), new Response("<html>")).headers.get("Cloudflare-CDN-Cache-Control")).toBe("no-store");
  });
});

describe("withSession", () => {
  it("gives a first visit a session ID, in the request and as a cookie for the browser", () => {
    const { request, setCookie } = withSession(at("/", { headers: { cookie: "theme=dark" } }));
    const id = /pivot_session=([\w-]+)/.exec(request.headers.get("cookie") ?? "")?.[1];
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(request.headers.get("cookie")).toContain("theme=dark");
    expect(setCookie).toBe(`pivot_session=${id}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`);
  });

  it("leaves a returning visitor's session alone", () => {
    const original = at("/", { headers: { cookie: "pivot_session=abc" } });
    expect(withSession(original)).toEqual({ request: original, setCookie: null });
    const response = new Response("x");
    expect(withSetCookie(response, null)).toBe(response);
  });
});

describe("the default entrypoint", () => {
  it("sends page views to the cached entrypoint with a session, and API calls to Next.js", async () => {
    const app = { fetch: vi.fn(async () => new Response("from next")) };
    const cached = vi.fn(async (request: Request) => new Response(request.headers.get("cookie")));
    const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn(), props: {}, exports: { CachedPages: { fetch: cached } } };
    const env = { AUTH_URL: `https://${host}` };
    const worker = createWorker(app as unknown as FetchHandler) as unknown as {
      fetch(request: Request, env: unknown, ctx: unknown): Promise<Response>;
    };

    const first = await worker.fetch(at("/"), env, ctx);
    expect(await first.text()).toMatch(/^pivot_session=/);
    expect(first.headers.get("set-cookie")).toMatch(/^pivot_session=/);

    const api = await worker.fetch(at("/api/trash"), env, ctx);
    expect(await api.text()).toBe("from next");
    expect(cached).toHaveBeenCalledTimes(1);
  });
});
