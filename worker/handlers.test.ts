import { beforeEach, describe, expect, it, vi } from "vitest";

import { createWorker, INTERNAL_CRON_URL, type FetchHandler } from "./handlers";

// The OpenNext handler is a build artifact, so the test stands in for it and
// checks what the cron handler asks of it.
const openNext = { fetch: vi.fn() };
const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn(), props: {} };

// The handlers are typed against the Workers runtime; the fakes above only
// carry the fields they read.
type Handlers = {
  fetch(request: Request, env: unknown, ctx: unknown): Promise<Response>;
  scheduled(controller: unknown, env: unknown, ctx: unknown): Promise<void>;
};
const handlers = createWorker(openNext as unknown as FetchHandler) as unknown as Handlers;
const controller = { cron: "7 * * * *", scheduledTime: Date.now(), noRetry: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("Worker cron handler", () => {
  it("calls the check-in route in-process with the cron secret", async () => {
    openNext.fetch.mockResolvedValue(Response.json({ ok: true, subscriptions: 2, due: 1, sent: 1, deduplicated: 0, expired: 0, invalid: 0, failed: 0 }));
    const env = { CRON_SECRET: "cron-secret" };

    await handlers.scheduled(controller, env, ctx);

    expect(openNext.fetch).toHaveBeenCalledTimes(1);
    const [request, passedEnv, passedCtx] = openNext.fetch.mock.calls[0] as [Request, unknown, unknown];
    expect(request.url).toBe(INTERNAL_CRON_URL);
    expect(request.method).toBe("GET");
    expect(request.headers.get("authorization")).toBe("Bearer cron-secret");
    expect(request.headers.get("host")).toBe(new URL(INTERNAL_CRON_URL).host);
    expect(passedEnv).toBe(env);
    expect(passedCtx).toBe(ctx);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"sent":1'));
  });

  it("does nothing while CRON_SECRET is not set", async () => {
    await handlers.scheduled(controller, {}, ctx);
    expect(openNext.fetch).not.toHaveBeenCalled();
  });

  it("treats an unconfigured deployment (503) as nothing to send", async () => {
    openNext.fetch.mockResolvedValue(Response.json({ error: "Web Push is not configured." }, { status: 503 }));
    await expect(handlers.scheduled(controller, { CRON_SECRET: "cron-secret" }, ctx)).resolves.toBeUndefined();
  });

  it("fails the run when delivery fails, so it shows as an error in the Worker logs", async () => {
    openNext.fetch.mockResolvedValue(Response.json({ error: "Notification delivery failed." }, { status: 500 }));
    await expect(handlers.scheduled(controller, { CRON_SECRET: "cron-secret" }, ctx)).rejects.toThrow("status 500");
  });
});

describe("Worker fetch handler", () => {
  it("serves every request from the Next.js app", async () => {
    const response = new Response("ok");
    openNext.fetch.mockResolvedValue(response);
    const request = new Request("https://pivot.example/privacy");
    await expect(handlers.fetch(request, {}, ctx)).resolves.toBe(response);
    expect(openNext.fetch).toHaveBeenCalledWith(request, {}, ctx);
  });
});
