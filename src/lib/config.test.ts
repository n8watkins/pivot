import { describe, expect, it } from "vitest";
import { getRuntimeCapabilities } from "./config";

describe("runtime configuration", () => {
  it("requires persistent storage in production", () => {
    expect(getRuntimeCapabilities({ NODE_ENV: "production" }).persistentStorageReady).toBe(false);
    expect(getRuntimeCapabilities({ NODE_ENV: "production", TURSO_DATABASE_URL: "libsql://pivot.turso.io" }).persistentStorageReady).toBe(true);
  });

  it("reports optional provider capabilities without exposing secrets", () => {
    expect(getRuntimeCapabilities({ TURSO_DATABASE_URL: "file:./data/pivot.db", GEMINI_API_KEY: "secret" })).toMatchObject({
      persistence: "sqlite",
      recommendations: "deterministic-fallback",
      accounts: "anonymous-only",
    });
    expect(getRuntimeCapabilities({ GEMINI_API_KEY: "secret", ENABLE_GEMINI_RECOMMENDATIONS: "true" }).recommendations).toBe("gemini-with-fallback");
    expect(getRuntimeCapabilities({ AUTH_SECRET: "set" }).authPartiallyConfigured).toBe(true);
  });
});
