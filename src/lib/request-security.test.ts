import { describe, expect, it } from "vitest";
import { rejectCrossOriginMutation } from "./request-security";

describe("mutation origin protection", () => {
  it("allows same-origin and non-browser requests", () => {
    expect(rejectCrossOriginMutation(new Request("https://pivot.example/api/state"))).toBeNull();
    expect(rejectCrossOriginMutation(new Request("https://pivot.example/api/state", { headers: { origin: "https://pivot.example" } }))).toBeNull();
  });

  it("rejects cross-origin browser mutations", () => {
    expect(rejectCrossOriginMutation(new Request("https://pivot.example/api/state", { headers: { origin: "https://attacker.example" } }))?.status).toBe(403);
  });
});
