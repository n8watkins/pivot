import { describe, expect, it } from "vitest";
import { defaultReason, durationMinutes, rankWithContext } from "./ranking";

const builtIns = [
  { id: "walk", name: "Take a short walk", duration: "5 min" },
  { id: "breathe", name: "Slow breathing", duration: "2 min" },
  { id: "stretch", name: "Stretch your shoulders", duration: "3 min" },
  { id: "water", name: "Make a glass of water", duration: "3 min" },
  { id: "friend", name: "Message someone", duration: "5 min" },
];
const ids = (ranked: { action: { id: string } }[]) => ranked.map((entry) => entry.action.id);
const midday = 13;

describe("rankWithContext", () => {
  it("keeps the user's own order when nothing is shared", () => {
    const ranked = rankWithContext(builtIns);
    expect(ids(ranked)).toEqual(["walk", "breathe", "stretch", "water", "friend"]);
    expect(ranked[0].reason).toBe(defaultReason);
  });

  it("does not suggest a walk to someone tired at night with a strong urge", () => {
    const ranked = rankWithContext(builtIns, { tag: "Tired", intensity: 9, hour: 1 });
    expect(ranked[0].action.id).not.toBe("walk");
    expect(["breathe", "stretch"]).toContain(ranked[0].action.id);
    expect(ids(ranked).at(-1)).toBe("walk");
  });

  it.each([
    [{ tag: "Tired", hour: midday }, ["breathe", "stretch", "water"], /tired, so here’s something quiet/],
    [{ tag: "Stressed", hour: midday }, ["breathe", "stretch"], /stressed, so here’s something calming/],
    [{ tag: "Bored", hour: midday }, ["walk", "stretch", "water", "friend"], /bored, so here’s something that changes the scene/],
    [{ tag: "Avoiding something", hour: midday }, ["breathe", "stretch", "water"], /one small step/],
    [{ tag: "Just automatic", hour: midday }, ["walk", "stretch", "water"], /autopilot/],
    [{ intensity: 9, hour: midday }, ["breathe", "stretch"], /strong urge/],
  ])("fits %j", (context, expected, reason) => {
    const [top] = rankWithContext(builtIns, context);
    expect(expected).toContain(top.action.id);
    expect(top.reason).toMatch(reason);
  });

  it("matches tags regardless of case and spacing", () => {
    expect(rankWithContext(builtIns, { tag: "  tIrEd " }, [])[0].reason).toMatch(/tired/);
  });

  it("prefers indoor actions late at night", () => {
    const ranked = rankWithContext(builtIns, { hour: 23 });
    expect(ranked[0].action.id).not.toBe("walk");
    expect(ranked[0].reason).toMatch(/late/);
  });

  it("learns what helped for the same feeling, above general fit", () => {
    const history = [{ replacementId: "friend", helpful: true, contextType: "Stressed" }];
    const [top] = rankWithContext(builtIns, { tag: "Stressed", hour: midday }, history);
    expect(top.action.id).toBe("friend");
    expect(top.reason).toBe("This helped last time you chose “Stressed”.");
  });

  it("uses general helpfulness and demotes what did not help", () => {
    const history = [{ replacementId: "water", helpful: true }, { replacementId: "walk", helpful: false }];
    const ranked = rankWithContext(builtIns, { hour: midday }, history);
    expect(ranked[0].action.id).toBe("water");
    expect(ranked[0].reason).toBe("This has helped you before.");
    expect(ids(ranked).at(-1)).toBe("walk");
  });

  it("recognizes built-in actions namespaced by pivot", () => {
    const namespaced = builtIns.map((action) => ({ ...action, id: `my-pivot:${action.id}` }));
    expect(rankWithContext(namespaced, { tag: "Stressed", hour: midday })[0].action.id).toMatch(/:(breathe|stretch)$/);
  });

  it("treats custom actions by length only", () => {
    const custom = [{ id: "custom-read", name: "Read a page", duration: "10 min" }, { id: "custom-tea", name: "Make tea", duration: "2 min" }];
    expect(rankWithContext(custom, { intensity: 8 })[0].action.id).toBe("custom-tea");
    expect(rankWithContext(custom, {})[0].action.id).toBe("custom-read");
  });

  it("keeps every reason short enough for the recommendation schema", () => {
    for (const tag of ["Tired", "Stressed", "Bored", "Avoiding something", "Just automatic", "a-very-long-custom-tag-name-for-testing-limits"]) {
      for (const entry of rankWithContext(builtIns, { tag, intensity: 9, hour: 2 }, [{ replacementId: "breathe", helpful: true, contextType: tag }])) {
        expect(entry.reason.length).toBeLessThanOrEqual(180);
      }
    }
  });
});

describe("durationMinutes", () => {
  it.each([["5 min", 5], ["2 minutes", 2], ["90 sec", 1.5], ["1 hour", 60], ["anything", 5]])("reads %j", (input, minutes) => {
    expect(durationMinutes(input)).toBe(minutes);
  });
});
