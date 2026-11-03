# Pivot

Pivot is a calm, mobile-first web app for choosing a different next step when an urge appears.
It supports any everyday habit, keeps each habit and its replacement actions in a separate pivot, and never uses streaks or judgmental language.

## What is included

- Anonymous-first use with a secure session cookie.
- Any number of pivots and any number of approved replacement actions per pivot.
- Reusable built-in and custom context tags.
- Optional one-time context notes that are sent for recommendation and never stored.
- Context-aware deterministic ranking (`src/lib/ranking.ts`): the tag, the intensity the user set, the local time, and what helped before (for the same tag first) pick the action, and the reason shown is written from those inputs.
- Deterministic recommendations by default, with the Gemini adapter retained behind an explicit release flag.
- Active-action refresh recovery and a duration countdown.
- Follow-up for current urge, lapse outcome, and explicit helpfulness.
- Pivot-aware History with event deletion and preserved labels after pivot deletion.
- JSON data export and complete account or anonymous-session deletion.
- Optional GitHub sign-in that upgrades and merges an existing anonymous session.
- Installable Android PWA metadata, maskable icons, standalone safe areas, update prompting, and a privacy-safe offline shell.
- Optional weekly or monthly Web Push check-ins that remain off until the user grants permission.
- Crisis routing before normal recommendations: suicide, self-harm, wanting to die, overdose, or danger-to-others language (typos and slang included), or any Gemini safety signal, shows call/text/chat 988, findahelpline.com, and local emergency numbers instead of a habit suggestion.
  The check runs on the device first and again on the server, so it never depends on the network.
- Unsupported clinical-category routing to specialized support.
- Short privacy and terms pages at `/privacy` and `/terms`, linked from onboarding, Settings, and the note field.

Pivot is not medical care, crisis care, or a substitute for a qualified professional.
Realtime voice is intentionally outside this release.

## Stack

- Next.js App Router with TypeScript and React.
- Tailwind CSS with a small custom component and token layer.
- Turso through the libSQL client, with local SQLite-compatible development.
- Auth.js with the GitHub OAuth provider.
- Gemini `gemini-3.1-flash-lite` through a server-only adapter.
- Vitest for unit and SQLite integration tests.
- Playwright for browser end-to-end tests.

## Run locally with SQLite

Install dependencies and start the local SQLite-backed development server.

```bash
npm install
npm run dev:sqlite
```

Open [http://localhost:3000](http://localhost:3000).
The local database is created at `data/pivot.db`, which is excluded from Git.
The app applies idempotent schema migrations automatically for local convenience.
Production releases should run `npm run db:migrate` before promotion.

Use the production build locally with the same SQLite database when checking deployment behavior.

```bash
npm run build
npm run start:sqlite -- --port 3001
```

Open [http://localhost:3001](http://localhost:3001).

Running `npm run dev` without a database uses in-memory persistence for quick UI work only.
Production refuses to use in-memory persistence unless `ALLOW_IN_MEMORY_PERSISTENCE=true` is explicitly set, which should never be enabled for a real deployment.

## Environment variables

Copy `.env.example` to `.env.local` and set only the capabilities you want to enable.

| Variable | Required | Purpose |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | Production | Remote Turso URL or local `file:` URL. |
| `TURSO_AUTH_TOKEN` | Remote Turso | Authenticates the remote database client. |
| `ENABLE_GEMINI_RECOMMENDATIONS` | No | Must be `true` before Pivot can call Gemini. Defaults to deterministic recommendations. |
| `GEMINI_API_KEY` | No | Provides Gemini credentials but does not enable model calls by itself. |
| `AUTH_SECRET` | GitHub sign-in | Encrypts Auth.js cookies and tokens. |
| `AUTH_GITHUB_ID` | GitHub sign-in | GitHub OAuth application client ID. |
| `AUTH_GITHUB_SECRET` | GitHub sign-in | GitHub OAuth application client secret. |
| `WEB_PUSH_VAPID_PUBLIC_KEY` | Notifications | Public browser subscription key from a single persistent VAPID key pair. |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | Notifications | Private VAPID key stored as a sensitive Vercel variable. |
| `WEB_PUSH_SUBJECT` | Notifications | A `mailto:` or HTTPS contact identifier for the push provider. |
| `CRON_SECRET` | Notifications | Protects the hourly notification scheduler route. |
| `COOKIE_SECURE` | Local production only | Set to `false` for local HTTP testing. |

Generate an Auth.js secret with this command.

```bash
npx auth secret
```

## GitHub OAuth setup

Create a GitHub OAuth App under GitHub developer settings.
Use `http://localhost:3000` as the homepage URL for local development.
Use `http://localhost:3000/api/auth/callback/github` as the local authorization callback URL.
For production, replace the origin with the final HTTPS domain.

Set `AUTH_SECRET`, `AUTH_GITHUB_ID`, and `AUTH_GITHUB_SECRET` together.
If any one is missing, the health endpoint reports a degraded configuration and the Settings page leaves GitHub sign-in disabled.
Pivot requests only identity information and does not request repository access.

An anonymous user can connect GitHub without losing current data.
The first connected session becomes canonical, and later connected devices merge their local Pivot data into it.
Signing out rotates the browser to a fresh anonymous session so connected account data is not left visible on a shared device.

## Recommendation behavior

The server validates every replacement against the selected pivot before starting or recording an intervention.
Pivot uses deterministic ranking unless both `ENABLE_GEMINI_RECOMMENDATIONS=true` and `GEMINI_API_KEY` are configured.
Gemini must return structured JSON containing an approved replacement ID, a concise reason, a concrete first step, up to two approved alternatives, and a safety status.
Malformed, delayed, unsafe, unapproved, or empty model output is discarded.
Missing credentials and provider failures use the same deterministic ranking path.

Free-text context is capped, used only for the immediate recommendation and safety route, and not written to the database, History, export, or routine analytics events.

## Android installation and check-ins

Chrome on Android can install Pivot directly from the browser when the site is served over HTTPS.
The installed app uses a standalone layout, Android-safe viewport insets, a network-first app shell, and an offline fallback.
The service worker never caches API routes, authentication, account data, exports, or other user-specific responses.

Notification controls are in Settings and default to off.
Weekly check-ins are due Monday during the recipient's local 9 AM hour, and monthly check-ins are due on the first day of the month during the local 9 AM hour.
The hourly scheduler supports timezones with partial-hour UTC offsets and uses a unique delivery claim so retries cannot duplicate a cadence period.
Push payloads contain only a delivery tag and a safe in-app URL.
The visible message is always `Your Pivot check-in is ready.` and never includes a habit name, urge context, or note.

Generate one VAPID key pair and keep it stable for the lifetime of existing browser subscriptions.

```bash
npx web-push generate-vapid-keys
```

Set the public key normally and protect the private key and cron secret with Vercel's sensitive-variable option.

```bash
vercel env add WEB_PUSH_VAPID_PUBLIC_KEY production
vercel env add WEB_PUSH_VAPID_PRIVATE_KEY production --sensitive
vercel env add WEB_PUSH_SUBJECT production
vercel env add CRON_SECRET production --sensitive
```

The `Notification check-ins` GitHub Actions workflow invokes `/api/cron/notifications` hourly, because the Vercel Hobby plan only allows daily crons.
Set the same `CRON_SECRET` value as a repository secret (`gh secret set CRON_SECRET`) to turn it on; without it the workflow does nothing.
The workflow sends `CRON_SECRET` as a bearer token, and the route rejects every request without an exact match.
Set the `PIVOT_URL` repository variable if the production URL changes.

## Privacy and safety

Settings provides event-level History deletion, full JSON export, and complete data deletion.
Deleting all data removes pivots, actions, interventions, follow-ups, privacy events, rate-limit records owned by the anonymous session, the anonymous session, and a connected Pivot account link.
Custom context tags are stored because the user explicitly creates them for reuse.
One-time context notes are not stored.

High-risk language routes away from habit recommendations and directs users in the United States or Canada to call or text 988.
Unsupported clinical categories route to specialized professional support.
The safety matcher is a conservative product boundary, not a clinical assessment system.
It lives in `src/lib/crisis.ts` and errs toward showing resources: negations such as "I'm not suicidal" still show them, and only clear everyday idioms are excluded.
Every phrase it must catch or ignore is listed in `src/lib/crisis.test.ts`, which CI runs as its own required "Crisis safety tests" check.

## Health and operations

`GET /api/health` checks database initialization and reports only non-secret capability states.
A healthy production response must report persistent storage as `turso` or `sqlite`.
A partial GitHub configuration returns HTTP 503 with `status: "degraded"`.
Database initialization failure or missing production persistence returns HTTP 503 with `status: "unavailable"`.

Security headers include a restrictive content security policy, frame denial, MIME sniffing protection, a strict referrer policy, and disabled camera, microphone, and geolocation permissions.
Mutation routes use database-backed per-session request limits that remain consistent across application instances.
Browser mutations reject mismatched origins, and sensitive state responses are marked as non-cacheable.
Connect structured error reporting before increasing public traffic.

The production checklist and operational runbooks are in [`docs/production-readiness.md`](docs/production-readiness.md).
The complete step-by-step launch walkthrough is in [`docs/production-launch-checklist.md`](docs/production-launch-checklist.md).

## Verification

Run the complete local quality suite.

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Playwright starts the production build on port 3101 against an isolated `data/pivot-e2e.db` database.
It never reuses the manual-testing server or `data/pivot.db`.
The suite uses one worker because every browser test intentionally shares that single isolated SQLite server.
Legacy API-mocking flows block service workers, while the dedicated PWA suite enables them for install, update, and offline verification.
The GitHub workflow runs the same gates on pushes to `main` and pull requests.

## Deploy to Vercel

Create a Turso database and set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in the Vercel project before the first production request.
Migrations run automatically on the first request after a deploy; `npm run db:migrate` runs them ahead of time.
Set the four Web Push variables described above, then the `CRON_SECRET` repository secret, to turn on check-ins.
Leave `ENABLE_GEMINI_RECOMMENDATIONS=false` until model-backed recommendations are intentionally released.
Add `GEMINI_API_KEY` and enable the release flag together when that later capability is ready.
Add all three Auth.js and GitHub variables together when GitHub sign-in is ready.
Configure the production GitHub OAuth callback as `https://YOUR_DOMAIN/api/auth/callback/github`.

After deployment, check `/api/health`, complete one full pivot in a test session, refresh during the active action, finish the follow-up, verify History, download an export, and delete the test data.
