import { describe, expect, it } from "vitest";
import { isRateLimited } from "./rate-limit";

describe("rate limiting", () => {
  it("allows requests through the limit and blocks the next one", () => {
    const key = `test-${crypto.randomUUID()}`;
    expect(isRateLimited(key, 2)).toBe(false);
    expect(isRateLimited(key, 2)).toBe(false);
    expect(isRateLimited(key, 2)).toBe(true);
  });
});
