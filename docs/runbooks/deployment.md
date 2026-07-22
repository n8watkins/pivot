# Deployment runbook

1. Confirm CI and CodeQL are green on the release commit.
2. Confirm preview uses preview-only Turso and OAuth credentials.
3. Run `TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run db:migrate` against production.
4. Deploy the immutable release commit to Vercel preview and complete the closed-loop smoke test.
5. Promote that deployment to production.
6. Verify `/api/health`, sign-in, state recovery, History, export, and deletion.
7. Watch 5xx rate, latency, database errors, and authentication failures for at least 30 minutes.
8. Roll back to the prior Vercel deployment if core flows fail, and do not reverse a schema migration unless a tested down migration exists.
