import { describe, expect, it, vi } from "vitest";

import { createWorker, type FetchHandler } from "./handlers";
import { isMissingFile, missingFile } from "./missing-file";

const at = (path: string, init?: RequestInit) => new Request(`https://pivot.n8builds.dev${path}`, init);

describe("isMissingFile", () => {
  it("lets every real route and static file through", () => {
    for (const path of [
      "/",
      "/help",
      "/settings/pivots/0b9f6c1e-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
      "/api/pivots/0b9f6c1e-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
      "/api/history/0b9f6c1e-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
      "/api/auth/session",
      "/api/health",
      "/_next/image",
      "/opengraph-image",
      "/does-not-exist",
      "/manifest.webmanifest",
      "/icon.svg",
      "/apple-icon.png",
      "/favicon.ico",
      "/sw.js",
    ]) {
      expect(isMissingFile(path), path).toBe(false);
    }
  });

  it("refuses file-like paths that are not routes", () => {
    for (const path of [
      "/config.json",
      "/.s3cfg",
      "/secrets.json",
      "/www.zip",
      "/terraform.tfvars",
      "/vercel.json",
      "/.env",
      "/.git/config",
      "/wp-login.php",
      "/backup.sql",
      "/api/config.json",
      "/_next/static/chunks/gone.js",
      "/icon.png",
      "/.well-known/.env",
      "/.well-known/security.txt",
      "/sw.js.map",
    ]) {
      expect(isMissingFile(path), path).toBe(true);
    }
  });
});

describe("missingFile", () => {
  it("is a small, cookie-free, briefly cached 404, whatever the method", async () => {
    for (const method of ["GET", "HEAD", "POST"]) {
      const response = missingFile(at("/config.json", { method }));
      expect(response?.status).toBe(404);
      expect(response?.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
      expect(response?.headers.get("Cache-Control")).toBe("public, max-age=60, s-maxage=300");
      expect(response?.headers.get("Set-Cookie")).toBeNull();
    }
    expect(await missingFile(at("/.s3cfg"))?.text()).toBe("Not found");
  });

  it("leaves everything else to the app, including its own 404 page", () => {
    expect(missingFile(at("/nope"))).toBeNull();
    expect(missingFile(at("/icon.svg"))).toBeNull();
  });
});

describe("the default entrypoint", () => {
  const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn(), props: {} };
  const env = { AUTH_URL: "https://pivot.n8builds.dev" };

  it("answers a probe without running Next, and passes a real path on", async () => {
    const app = { fetch: vi.fn().mockResolvedValue(new Response("page")) };
    const worker = createWorker(app as unknown as FetchHandler) as unknown as {
      fetch(request: Request, env: unknown, ctx: unknown): Promise<Response>;
    };
    expect((await worker.fetch(at("/config.json"), env, ctx)).status).toBe(404);
    expect(app.fetch).not.toHaveBeenCalled();
    expect(await (await worker.fetch(at("/api/state"), env, ctx)).text()).toBe("page");
    expect(app.fetch).toHaveBeenCalledOnce();
  });
});
