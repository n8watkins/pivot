# Pivot production readiness

## Required before public traffic

- Create separate Turso databases and tokens for preview and production.
- Run `npm run db:migrate` against production before promoting a release.
- Configure Vercel production variables for Turso, Auth.js, and GitHub OAuth.
- Keep `ENABLE_GEMINI_RECOMMENDATIONS=false` until model quality and safety evaluation is approved.
- Configure the production GitHub OAuth callback with the final HTTPS origin.
- Protect `main` with required CI and CodeQL checks.
- Enable Turso backups or point-in-time recovery and test a restore.
- Configure an error-monitoring destination and alerts for elevated 5xx responses.
- Add uptime monitoring for `/api/health` and the primary web route.
- Publish a privacy policy, terms, and safety disclaimer suitable for the launch regions.

## Release gate

- `npm audit --omit=dev --audit-level=high` reports no high-severity production findings.
- Lint, type checking, unit tests, production build, and all Playwright tests pass.
- The migration command succeeds against a staging copy of production schema and data.
- A staging user can create, refresh, complete, export, delete one event, and delete all data.
- GitHub sign-in merges anonymous data and sign-out rotates to a clean anonymous session.
- Mobile, desktop, keyboard, reduced-motion, text scaling, and automated accessibility checks pass.
- Logs and analytics contain no free-text urge context or credentials.

## Launch ownership

- Name one person responsible for deployment approval and rollback.
- Name one person responsible for privacy and safety escalation.
- Record the Turso, Vercel, GitHub OAuth, domain, and monitoring owners in the private operations system.
- Set monthly spend alerts for Vercel, Turso, and Gemini before enabling paid traffic.
