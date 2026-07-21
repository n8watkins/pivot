# Pivot

Pivot is a calm, mobile-first web app for choosing a different next step when an urge appears.
It supports any everyday habit, keeps each habit and its replacement actions in a separate pivot, and never uses streaks or judgmental language.

## What is included

- Anonymous-first use with a secure session cookie.
- Any number of pivots and any number of approved replacement actions per pivot.
- Reusable built-in and custom context tags.
- Optional one-time context notes that are sent for recommendation and never stored.
- Deterministic recommendation ranking based on recent helpful and unhelpful outcomes.
- Optional Gemini structured recommendations with deterministic fallback.
- Active-action refresh recovery and a duration countdown.
- Follow-up for current urge, lapse outcome, and explicit helpfulness.
- Pivot-aware History with event deletion and preserved labels after pivot deletion.
- JSON data export and complete account or anonymous-session deletion.
- Optional GitHub sign-in that upgrades and merges an existing anonymous session.
- High-risk and unsupported clinical-category routing before normal recommendations.

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
The app applies schema migrations automatically.

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
| `GEMINI_API_KEY` | No | Enables Gemini recommendations while retaining deterministic fallback. |
| `AUTH_SECRET` | GitHub sign-in | Encrypts Auth.js cookies and tokens. |
| `AUTH_GITHUB_ID` | GitHub sign-in | GitHub OAuth application client ID. |
| `AUTH_GITHUB_SECRET` | GitHub sign-in | GitHub OAuth application client secret. |
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
Gemini must return structured JSON containing an approved replacement ID, a concise reason, a concrete first step, up to two approved alternatives, and a safety status.
Malformed, delayed, unsafe, unapproved, or empty model output is discarded.
Missing credentials and provider failures use the same deterministic ranking path.

Free-text context is capped, used only for the immediate recommendation and safety route, and not written to the database, History, export, or routine analytics events.

## Privacy and safety

Settings provides event-level History deletion, full JSON export, and complete data deletion.
Deleting all data removes pivots, actions, interventions, follow-ups, privacy events, the anonymous session, and a connected Pivot account link.
Custom context tags are stored because the user explicitly creates them for reuse.
One-time context notes are not stored.

High-risk language routes away from habit recommendations and directs users in the United States or Canada to call or text 988.
Unsupported clinical categories route to specialized professional support.
The safety matcher is a conservative product boundary, not a clinical assessment system.

## Health and operations

`GET /api/health` checks database initialization and reports only non-secret capability states.
A healthy production response must report persistent storage as `turso` or `sqlite`.
A partial GitHub configuration returns HTTP 503 with `status: "degraded"`.
Database initialization failure or missing production persistence returns HTTP 503 with `status: "unavailable"`.

Security headers include a restrictive content security policy, frame denial, MIME sniffing protection, a strict referrer policy, and disabled camera, microphone, and geolocation permissions.
Mutation routes use per-session request limits.
For a larger public release, replace the process-local limiter with a distributed limiter and connect structured error reporting before increasing traffic.

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
The GitHub workflow runs the same gates on pushes to `main` and pull requests.

## Deploy to Vercel

Create a Turso database and set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in the Vercel project before the first production request.
Add `GEMINI_API_KEY` only when model-backed recommendations are ready.
Add all three Auth.js and GitHub variables together when GitHub sign-in is ready.
Configure the production GitHub OAuth callback as `https://YOUR_DOMAIN/api/auth/callback/github`.

After deployment, check `/api/health`, complete one full pivot in a test session, refresh during the active action, finish the follow-up, verify History, download an export, and delete the test data.
