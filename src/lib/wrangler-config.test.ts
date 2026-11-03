import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("wrangler.jsonc", () => {
  // JSONC: drop comments, then parse.
  const config = JSON.parse(readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, ""));

  it("runs check-ins hourly", () => {
    expect(config.triggers.crons).toEqual(["7 * * * *"]);
  });

  it("keeps secrets out of the plain variables and lists them in .dev.vars.example", () => {
    const example = readFileSync(new URL("../../.dev.vars.example", import.meta.url), "utf8");
    for (const name of ["CRON_SECRET", "AUTH_SECRET", "TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "WEB_PUSH_VAPID_PUBLIC_KEY", "WEB_PUSH_VAPID_PRIVATE_KEY", "GEMINI_API_KEY"]) {
      expect(config.vars).not.toHaveProperty(name);
      expect(example).toMatch(new RegExp(`^${name}=$`, "m"));
    }
  });
});
