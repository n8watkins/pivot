import { describe, expect, it } from "vitest";
import { networkRateLimitKey, rejectCrossOriginMutation } from "./request-security";

describe("mutation origin protection", () => {
  it("allows same-origin and non-browser requests", () => {
    expect(rejectCrossOriginMutation(new Request("https://pivot.example/api/state"))).toBeNull();
    expect(rejectCrossOriginMutation(new Request("https://pivot.example/api/state", { headers: { origin: "https://pivot.example" } }))).toBeNull();
    expect(rejectCrossOriginMutation(new Request("http://localhost:3101/api/state", { headers: { origin: "http://[::1]:3101", host: "[::1]:3101" } }))).toBeNull();
  });

  it("rejects cross-origin browser mutations", () => {
    expect(rejectCrossOriginMutation(new Request("https://pivot.example/api/state", { headers: { origin: "https://attacker.example" } }))?.status).toBe(403);
    expect(rejectCrossOriginMutation(new Request("https://pivot.example/api/state", { headers: { origin: "http://pivot.example", host: "pivot.example", "x-forwarded-proto": "https" } }))?.status).toBe(403);
  });

  it("creates a stable non-reversible network limiter key", () => {
    const request = new Request("https://pivot.example/api/recommendation", { headers: { "x-forwarded-for": "203.0.113.8, 10.0.0.1" } });
    expect(networkRateLimitKey(request, "recommendation")).toMatch(/^recommendation:network:[a-f0-9]{24}$/);
    expect(networkRateLimitKey(request, "recommendation")).not.toContain("203.0.113.8");
  });
});
