# Deployment runbook

1. Confirm CI and CodeQL are green on the release commit.
2. Confirm preview uses preview-only Turso and OAuth credentials.
3. Run `TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run db:migrate` against production.
4. Confirm the stable VAPID pair, `WEB_PUSH_SUBJECT`, and sensitive `CRON_SECRET` are set in the target Vercel environment.
5. Deploy the immutable release commit to Vercel preview and complete the closed-loop smoke test.
6. Promote that deployment to production.
7. Verify `/api/health`, PWA manifest and icons, sign-in, state recovery, History, notification opt-in and opt-out, export, and deletion.
8. Confirm an unauthorized request to `/api/cron/notifications` returns 401 and review the first run of the `Notification check-ins` GitHub Actions workflow.
9. Watch 5xx rate, latency, database errors, expired push endpoints, and authentication failures for at least 30 minutes.
10. Roll back to the prior Vercel deployment if core flows fail, and do not reverse a schema migration unless a tested down migration exists.
