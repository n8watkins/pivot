import { describe, expect, it } from "vitest";

import { SESSION_COOKIE as WORKER_SESSION_COOKIE } from "../../worker/edge-cache";
import { SESSION_COOKIE } from "./session-cookie";

describe("session cookie", () => {
  it("is the one the Worker assigns to cached page views (worker/edge-cache.ts)", () => {
    expect(WORKER_SESSION_COOKIE).toBe(SESSION_COOKIE);
  });
});
