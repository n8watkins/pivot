# Pivot production launch checklist

This document is the step-by-step path from the current hardened branch to a controlled production launch.

The application is designed to run anonymously first, use Turso for durable persistence, use GitHub only as an optional account upgrade, and use deterministic recommendations until Gemini is intentionally enabled.

## 0. Current implementation status

The following work is already complete in the `production-hardening` branch:

- The core setup, urge, recommendation, active-action, follow-up, History, export, and deletion loop is implemented.
- Users can create any number of pivots and any number of replacement actions within each pivot.
- Users can create and reuse custom context tags.
- Anonymous sessions survive refresh through a secure session cookie.
- GitHub sign-in has an integration seam and anonymous-data merge behavior.
- Deterministic recommendation ranking is the default behavior.
- Gemini output is server-only, structured, validated, safety-filtered, and backed by deterministic fallback behavior.
- Active intervention persistence, completion, refresh recovery, and deletion are covered by regression tests.
- Turso-compatible migrations and a local SQLite workflow are implemented.
- Security headers, same-origin mutation checks, database-backed request limits, and non-cacheable sensitive responses are implemented.
- CI, CodeQL, Dependabot, deployment runbooks, database recovery guidance, and incident response guidance are implemented.

The latest local verification passed with 38 Playwright tests, 19 unit and integration tests, lint, TypeScript checks, a production build, and a production dependency audit with zero vulnerabilities.

The latest commit is `8b0d71a`, and the working tree is clean.

## 1. Choose the launch settings

Record these decisions before creating external resources.

1. Choose the final HTTPS domain, such as `pivot.example.com`.
2. Decide whether the first public release is invite-only or open to all visitors.
3. Choose the launch regions because the safety copy and crisis resources must match the countries served.
4. Confirm the minimum user age and whether a parent or guardian flow is required.
5. Choose an error-monitoring destination, such as Sentry or Vercel logs plus alerts.
6. Choose the person responsible for deployment approval and rollback.
7. Choose the person responsible for privacy and safety escalation.

Recommended initial settings are an invite-only release, United States and Canada support, adults only, deterministic recommendations, Vercel logs for the first private test, and a named owner for both deployment and safety escalation.

## 2. Create isolated Turso databases

Create separate databases for preview and production.

Do not use the same database or token for local development, preview, and production.

1. Create the preview database in Turso.
2. Create a preview database token with only the access required by the application.
3. Create the production database in Turso.
4. Create a separate production database token.
5. Enable the strongest available backups or point-in-time recovery option for production.
6. Record the database owner and the restore procedure in the private operations system.

Run the schema migration once for each database from a trusted environment.

```bash
TURSO_DATABASE_URL="libsql://preview-database.turso.io" \
TURSO_AUTH_TOKEN="preview-token" \
npm run db:migrate

TURSO_DATABASE_URL="libsql://production-database.turso.io" \
TURSO_AUTH_TOKEN="production-token" \
npm run db:migrate
```

Confirm that both commands print `Pivot database migrations are current.`.

Do not run destructive SQL against either database as part of routine deployment.

## 3. Create the Vercel project

Create or link the Vercel project to the `n8watkins/pivot` GitHub repository.

1. Import the repository into Vercel.
2. Use the repository root as the project root.
3. Keep the framework preset as Next.js.
4. Keep the build command as `npm run build` unless Vercel detects it automatically.
5. Keep the install command as `npm ci`.
6. Configure a preview branch deployment for `production-hardening` or the eventual pull request branch.
7. Add the final domain only after the first preview smoke test succeeds.

Configure variables separately for Preview and Production.

| Variable | Preview | Production | Notes |
| --- | --- | --- | --- |
| `TURSO_DATABASE_URL` | Required | Required | Use the matching environment database. |
| `TURSO_AUTH_TOKEN` | Required | Required | Use a different token per environment. |
| `ENABLE_GEMINI_RECOMMENDATIONS` | `false` | `false` | Keep deterministic behavior for the initial launch. |
| `GEMINI_API_KEY` | Omit | Omit | Add only during a later controlled AI release. |
| `AUTH_SECRET` | Required for GitHub auth | Required for GitHub auth | Use different randomly generated values. |
| `AUTH_GITHUB_ID` | Required for GitHub auth | Required for GitHub auth | Use the matching OAuth app. |
| `AUTH_GITHUB_SECRET` | Required for GitHub auth | Required for GitHub auth | Never commit or expose this value. |
| `COOKIE_SECURE` | Omit on HTTPS | Omit on HTTPS | The production default is secure cookies. |
| `ALLOW_IN_MEMORY_PERSISTENCE` | Omit | Omit | Never enable this for real traffic. |

Generate each Auth.js secret separately.

```bash
npx auth secret
```

Paste secrets into Vercel's encrypted environment-variable interface rather than committing them to `.env` files or sending them in chat.

## 4. Configure GitHub authentication

GitHub authentication is optional for the first anonymous-only test, but it should be configured before testing account upgrades.

1. Create a GitHub OAuth App for the preview environment.
2. Set its homepage URL to the preview HTTPS origin.
3. Set its authorization callback URL to `<preview-origin>/api/auth/callback/github`.
4. Put its client ID, client secret, and a preview-specific `AUTH_SECRET` in Vercel Preview variables.
5. Create a separate GitHub OAuth App for production.
6. Set its homepage URL to the final HTTPS domain.
7. Set its authorization callback URL to `https://<final-domain>/api/auth/callback/github`.
8. Put its client ID, client secret, and a production-specific `AUTH_SECRET` in Vercel Production variables.
9. Confirm that all three authentication variables are present together in each environment.

If any authentication variable is missing, Pivot intentionally remains anonymous-only and reports a degraded capability state rather than failing anonymous use.

## 5. Push and deploy the hardened branch

The current branch is `production-hardening`.

After this checklist is committed, push it with:

```bash
git push -u origin production-hardening
```

Open a draft pull request into `main` and wait for CI and CodeQL to finish.

Protect `main` in GitHub after the checks appear.

Require pull requests, require the CI workflow, require CodeQL, dismiss stale approvals, and prevent force pushes.

Merge only after the preview deployment and the smoke test in the next section pass.

## 6. Run the preview smoke test

Use a private browser window so the test begins with a fresh anonymous session.

1. Open the preview URL and confirm the dedicated onboarding route loads directly without a redirect flicker.
2. Create one pivot for a normal everyday habit.
3. Add at least three replacement actions.
4. Add one custom context tag.
5. Complete setup.
6. Start an urge flow and select a context tag.
7. Request a recommendation.
8. Start the recommended action.
9. Refresh while the action is active.
10. Confirm the active action and timer recover correctly.
11. Complete the action and submit follow-up answers.
12. Confirm the completed event appears under the correct pivot in History.
13. Delete the individual History event.
14. Confirm the event disappears and no dangling action remains.
15. Create a second pivot with a different replacement set.
16. Confirm recommendations and History do not cross pivot boundaries.
17. Export the account data and confirm the file downloads without one-time free-text context.
18. Delete all anonymous data.
19. Confirm the app returns to a clean onboarding state.
20. Open `/api/health` and confirm the response is healthy and contains no secrets.

Repeat the critical flow once on a narrow mobile viewport and once with keyboard-only navigation on desktop.

## 7. Test GitHub account upgrade

Run this test only after preview OAuth variables and callbacks are configured.

1. Start with an anonymous browser session containing one pivot and one completed event.
2. Connect GitHub from Settings.
3. Confirm the pivot and History remain present after the redirect.
4. Open the app in a second browser profile and sign in with the same GitHub account.
5. Confirm the canonical account data is visible.
6. Sign out in the second profile.
7. Confirm that the signed-out browser receives a fresh anonymous session and cannot see the connected account data.
8. Delete the connected account data from the authenticated profile.
9. Confirm the account, pivots, events, rate-limit records, and anonymous session are removed.

Do not enable public traffic until this test passes with the actual configured OAuth applications.

## 8. Configure monitoring and operations

Before opening the product publicly, configure the following external controls.

1. Add uptime checks for `/api/health` and the primary HTTPS route.
2. Alert on repeated 5xx responses, health-check failures, database initialization failures, and authentication failures.
3. Review Vercel function logs for unexpected request data and confirm one-time context notes are not logged.
4. Configure Turso usage alerts and backup notifications.
5. Configure Vercel usage and spend alerts.
6. Configure Gemini spend limits before setting its release flag to `true`.
7. Record the incident owner, deployment owner, database owner, and privacy owner.
8. Practice the rollback procedure in `docs/runbooks/deployment.md`.
9. Practice restoring a non-production Turso database from backup or point-in-time recovery.

The first launch should keep Gemini disabled while deterministic recommendations provide the complete user experience.

## 9. Complete legal and safety content

The application currently contains product safety routing, but public launch still requires reviewed legal and safety content.

1. Publish a privacy policy that explains anonymous session cookies, stored pivot data, custom tags, exports, deletion, GitHub account linking, and any future AI processing.
2. Publish terms of use.
3. Publish a clear safety disclaimer that Pivot is not medical care, crisis care, or a substitute for qualified professional support.
4. Confirm crisis resources for every launch region.
5. Define the process for handling safety reports and deletion requests.
6. Have the copy reviewed by the appropriate legal or policy owner before public traffic.

Do not represent the product as clinical treatment without a separate clinical, legal, and regulatory review.

## 10. Controlled production release

Use this order for the first release.

1. Merge the verified hardened branch into `main`.
2. Confirm the production database migration has completed.
3. Confirm all production Vercel variables are set in the Production environment.
4. Confirm the production GitHub callback uses the final HTTPS domain.
5. Deploy the release commit.
6. Check `/api/health`.
7. Run the closed-loop smoke test with a disposable test session.
8. Watch logs, uptime checks, database errors, and authentication failures for at least 30 minutes.
9. Open public access only after the smoke test and monitoring window pass.
10. Remove all disposable test data.

If the core flow fails, roll back to the prior Vercel deployment and preserve the database schema.

Do not reverse a migration unless a tested down migration exists.

## What I need from you

I do not need credentials in chat.

When you are ready for the external setup, provide or confirm these items:

1. The final production domain, or confirmation that the Vercel-generated domain is sufficient for now.
2. Whether the first release should be invite-only or public.
3. The launch countries and minimum user age.
4. Whether GitHub sign-in should be enabled for the first release.
5. Whether you want Sentry, Vercel-only monitoring, or another monitoring provider.
6. Whether you want Gemini enabled now or kept disabled until after initial user testing.
7. The GitHub repository branch or pull-request preference after the push.
8. The approved privacy policy, terms, and safety disclaimer content, or the person responsible for providing it.

The only values that must stay private are Turso tokens, GitHub client secrets, Auth.js secrets, Gemini keys, Vercel tokens, and monitoring DSNs.
