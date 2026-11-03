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
| `WEB_PUSH_VAPID_PRIVATE_KEY` | Notifications | Private VAPID key, stored as a Worker secret. |
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

Store the pair and the cron secret as Worker secrets; `WEB_PUSH_SUBJECT` is a plain variable in `wrangler.jsonc`.

```bash
npx wrangler secret put WEB_PUSH_VAPID_PUBLIC_KEY
npx wrangler secret put WEB_PUSH_VAPID_PRIVATE_KEY
npx wrangler secret put CRON_SECRET
```

An hourly Cron Trigger (`7 * * * *` in `wrangler.jsonc`) calls `/api/cron/notifications` in-process with `CRON_SECRET` as a bearer token, and the route rejects every request without an exact match.
Without `CRON_SECRET` the trigger does nothing.

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
The GitHub workflow runs the same gates on pushes to `main` and pull requests, plus a `Worker build` job (binding types, the OpenNext build and a dry-run bundle).

`PLAYWRIGHT_BASE_URL=<url>` runs the suite against a running deployment instead of a local build.
`PIVOT_E2E_DB_URL` (and `PIVOT_E2E_DB_AUTH_TOKEN`) then name that deployment's throwaway database, and `PIVOT_E2E_CRON_SECRET` its cron secret; without a database the specs that read rows directly are skipped (see [`e2e/env.ts`](e2e/env.ts)).
To run the whole suite on the Workers runtime locally, start a libSQL server with `turso dev -p 8089 -f data/pivot-e2e-worker.db`, write `.dev.vars` with `TURSO_DATABASE_URL=http://127.0.0.1:8089`, `COOKIE_SECURE=false`, a VAPID pair and `CRON_SECRET=pivot-e2e-cron-secret`, then run `npm run preview:worker -- --port 8788` and `PLAYWRIGHT_BASE_URL=http://localhost:8788 PIVOT_E2E_DB_URL=http://127.0.0.1:8089 npm run test:e2e`.

## Hosting on Cloudflare Workers

Pivot runs on Cloudflare Workers, built with [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare), at https://pivot.n8builds.dev.
[`wrangler.jsonc`](wrangler.jsonc) holds the Worker config: the hourly Cron Trigger and the plain variables, including `AUTH_URL`.
[`worker/index.ts`](worker/index.ts) is the entry point; it serves the Next.js app and adds the Cron Trigger handler from [`worker/handlers.ts`](worker/handlers.ts).
[`.dev.vars.example`](.dev.vars.example) lists every secret.

```bash
npm run build:worker     # OpenNext build into .open-next/
npm run preview:worker   # build, then serve it locally in workerd (reads .dev.vars)
npm run deploy:worker    # build, then deploy
npm run cf-typegen       # regenerate cloudflare-env.d.ts after changing wrangler.jsonc or .dev.vars.example
```

Keep `.env*` files with secrets out of the working tree when building for a deploy: OpenNext copies Next.js `.env` files into the Worker bundle.
The [`Deploy`](.github/workflows/deploy.yml) workflow deploys `main` after CI passes on it, once the `CLOUDFLARE_API_TOKEN` repository secret exists; until then it skips.
Only `main` deploys, so `release/*` branches from the release train never do (on Vercel, `vercel.json` turns them off).
Auth.js builds its URLs from `AUTH_URL`, so register `https://pivot.n8builds.dev/api/auth/callback/github` as the GitHub OAuth app's callback URL.

### Reading the logs

Workers Logs keeps every request (`observability` in `wrangler.jsonc`, `head_sampling_rate: 1`).
In the Cloudflare dashboard, open Workers & Pages, then the `pivot` Worker, then Logs.
To stream them live, run `npx wrangler tail pivot --format pretty`.
`--search` matches log messages only, not request URLs, so use `--status error` or no filter to see requests.
Failures log one JSON line with `event`, `reason` and `route`: Auth.js errors as `auth_error` with the error type (such as `CallbackRouteError` or `InvalidCheck`), a masked message and the provider's OAuth error code, and errors thrown in pages, route handlers or the proxy as `unhandled_exception` with the route (`src/instrumentation.ts`).
They never carry secrets, tokens, OAuth codes or state values, cookies, emails or other personal data.

## Deploy

Create a Turso database and set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` as Worker secrets before the first production request.
Migrations run automatically on the first request after a deploy; `npm run db:migrate` runs them ahead of time.
Set the Web Push secrets and `CRON_SECRET` described above to turn on check-ins.
Leave `ENABLE_GEMINI_RECOMMENDATIONS=false` until model-backed recommendations are intentionally released.
Add `GEMINI_API_KEY` and enable the release flag together when that later capability is ready.
Add all three Auth.js and GitHub variables together when GitHub sign-in is ready.
Configure the production GitHub OAuth callback as `https://YOUR_DOMAIN/api/auth/callback/github`.

After deployment, check `/api/health`, complete one full pivot in a test session, refresh during the active action, finish the follow-up, verify History, download an export, and delete the test data.
