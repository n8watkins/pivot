import { describe, expect, it } from "vitest";

import { healthCheck } from "./health";

const BASE = "https://pivot.n8builds.dev";

describe("healthCheck", () => {
  it("answers GET /healthz with an uncached plain-text ok", async () => {
    const response = healthCheck(new Request(`${BASE}/healthz`));
    expect(response?.status).toBe(200);
    expect(await response?.text()).toBe("ok");
    expect(response?.headers.get("content-type")).toContain("text/plain");
    expect(response?.headers.get("cache-control")).toBe("no-store");
    expect(response?.headers.get("set-cookie")).toBeNull();
  });

  it("answers HEAD without a body and leaves other requests alone", async () => {
    expect((await healthCheck(new Request(`${BASE}/healthz`, { method: "HEAD" })))?.status).toBe(200);
    expect(healthCheck(new Request(`${BASE}/`))).toBeNull();
    expect(healthCheck(new Request(`${BASE}/healthz/x`))).toBeNull();
    expect(healthCheck(new Request(`${BASE}/healthz`, { method: "POST" }))).toBeNull();
  });
});
