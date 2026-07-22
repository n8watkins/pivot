type RuntimeEnvironment = Record<string, string | undefined>;

export function getRuntimeCapabilities(environment: RuntimeEnvironment = process.env) {
  const databaseUrl = environment.TURSO_DATABASE_URL;
  const authValues = [environment.AUTH_SECRET, environment.AUTH_GITHUB_ID, environment.AUTH_GITHUB_SECRET];
  const authConfigured = authValues.every(Boolean);
  const authPartiallyConfigured = authValues.some(Boolean) && !authConfigured;
  const persistence = !databaseUrl ? "memory" : databaseUrl.startsWith("file:") ? "sqlite" : "turso";
  const persistentStorageRequired = environment.NODE_ENV === "production" && environment.ALLOW_IN_MEMORY_PERSISTENCE !== "true";
  const geminiRecommendationsEnabled = environment.ENABLE_GEMINI_RECOMMENDATIONS === "true" && Boolean(environment.GEMINI_API_KEY);
  const notificationValues = [environment.WEB_PUSH_VAPID_PUBLIC_KEY, environment.WEB_PUSH_VAPID_PRIVATE_KEY, environment.WEB_PUSH_SUBJECT];
  const notificationsConfigured = notificationValues.every(Boolean);

  return {
    persistence,
    persistentStorageReady: persistence !== "memory" || !persistentStorageRequired,
    recommendations: geminiRecommendationsEnabled ? "gemini-with-fallback" : "deterministic-fallback",
    accounts: authConfigured ? "github-optional" : "anonymous-only",
    notifications: notificationsConfigured ? "web-push" : "off",
    notificationScheduler: notificationsConfigured && environment.CRON_SECRET ? "ready" : "off",
    authPartiallyConfigured,
  } as const;
}
