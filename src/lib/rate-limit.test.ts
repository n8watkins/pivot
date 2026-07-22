import { describe, expect, it } from "vitest";
import { isRateLimited } from "./rate-limit";

describe("rate limiting", () => {
  it("allows requests through the limit and blocks the next one", async () => {
    const key = `test-${crypto.randomUUID()}`;
    expect(await isRateLimited(key, 2)).toBe(false);
    expect(await isRateLimited(key, 2)).toBe(false);
    expect(await isRateLimited(key, 2)).toBe(true);
  });
});
