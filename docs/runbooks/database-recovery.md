# Database recovery runbook

1. Stop production writes or enable a maintenance response before recovery.
2. Identify the last known-good Turso restore point and preserve the current database for investigation.
3. Restore into a new database rather than overwriting the only production copy.
4. Run `npm run db:migrate` against the restored database.
5. Validate session, pivot, intervention, follow-up, History, export, and deletion integrity.
6. Update Vercel to the restored database credentials and deploy without exposing tokens in logs.
7. Reopen traffic after health and closed-loop smoke tests pass.
8. Record the recovery point objective, recovery time, and any known data loss.
