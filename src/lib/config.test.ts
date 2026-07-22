import { describe, expect, it } from "vitest";
import { getRuntimeCapabilities } from "./config";

const validPublicKey = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 7)]).toString("base64url");
const validPrivateKey = Buffer.alloc(32, 5).toString("base64url");

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
    expect(getRuntimeCapabilities({ WEB_PUSH_VAPID_PUBLIC_KEY: validPublicKey, WEB_PUSH_VAPID_PRIVATE_KEY: validPrivateKey, WEB_PUSH_SUBJECT: "mailto:privacy@example.com", CRON_SECRET: "cron" })).toMatchObject({ notifications: "web-push", notificationScheduler: "ready" });
  });
});
