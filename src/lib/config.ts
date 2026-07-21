type RuntimeEnvironment = Record<string, string | undefined>;

export function getRuntimeCapabilities(environment: RuntimeEnvironment = process.env) {
  const databaseUrl = environment.TURSO_DATABASE_URL;
  const authValues = [environment.AUTH_SECRET, environment.AUTH_GITHUB_ID, environment.AUTH_GITHUB_SECRET];
  const authConfigured = authValues.every(Boolean);
  const authPartiallyConfigured = authValues.some(Boolean) && !authConfigured;
  const persistence = !databaseUrl ? "memory" : databaseUrl.startsWith("file:") ? "sqlite" : "turso";
  const persistentStorageRequired = environment.NODE_ENV === "production" && environment.ALLOW_IN_MEMORY_PERSISTENCE !== "true";

  return {
    persistence,
    persistentStorageReady: persistence !== "memory" || !persistentStorageRequired,
    recommendations: environment.GEMINI_API_KEY ? "gemini-with-fallback" : "deterministic-fallback",
    accounts: authConfigured ? "github-optional" : "anonymous-only",
    authPartiallyConfigured,
  } as const;
}
