# High-Concurrency Polling System

A polling application built with React, TypeScript, Tailwind CSS, shadcn/ui, Node.js, Express, PostgreSQL, and Socket.IO.

## Status

Voting is implemented end to end: one seeded active poll, persistent votes, database-enforced duplicate prevention, optimistic updates and rollback, and Socket.IO-driven live counts and percentages.

Repository: https://github.com/Edwin-Kw/polling_system

## Quick start

Requires Docker Desktop with Linux containers and Docker Compose.

```powershell
docker compose up --build
```

Open **http://localhost:3000**.

Startup initializes the schema and seed before accepting requests. If a development API already uses port 3000, stop that development command before starting the containerized app.

```powershell
docker compose down
```

Database data is stored in a named volume and survives shutdown. The included database credentials are for local development only, not production.

## Local development

Requires Node.js 24 LTS (or Node.js 22.18+ in the 22.x release line), npm 10+, and PostgreSQL.

```powershell
npm ci
Copy-Item .env.example .env
docker compose up -d db
npm run dev
```

Copy the environment template only if `.env` does not already exist. Do not commit real credentials. The API initializes the database on startup; `npm run db:setup` also runs the same idempotent setup without starting a server.

- Frontend: **http://127.0.0.1:5173**
- API health: **http://127.0.0.1:3000/api/health**
- PostgreSQL: **127.0.0.1:5433**

Vite proxies `/api` and `/socket.io` (including WebSocket upgrades) to the API's configured `HOST` and `PORT`. Both read the root `.env`, with shell environment variables taking precedence. Defaults remain API port 3000 and web port 5173. Restart the development servers after changing address settings or shared-package source.

### Managing shared paths and addresses

- [Shared transport definitions](./packages/shared/src/transport.ts) own the API base path, poll route patterns/path builders, mock-user header, Socket.IO path, and poll-change event name. The server, browser clients, proxy, and tests reuse them.
- [Development address definitions](./packages/shared/src/development.ts) own default host/ports, address validation, and HTTP-origin formatting. Import them through `@polling/shared/development` only in Node configuration or tests; they are separate from browser transport exports.
- Change `HOST` and `PORT` in the root `.env` to point both the API listener and Vite proxy at a different development address. For example, `PORT=3100` moves the API and its proxy target together; the web URL stays on port 5173.
- Wildcard bind addresses (`0.0.0.0` or `::`) are translated to loopback for the local proxy connection. IPv6 origin formatting is supported.
- Browser requests remain same-origin relative paths. The root `.env`, database URL, and server configuration are never injected into browser code. Reading API address settings does not change the frontend's production build mode.
- Docker port mappings and database settings remain deployment-specific in [compose.yaml](./compose.yaml); they are not imported into shared/browser code. The development `PORT` setting does not change Compose's fixed port mapping.

Contract tests retain literal expected URLs to detect unintended API changes. Other tests build requests from the same definitions as the application.

## Voting and resilience

- Select one answer and submit. Results immediately include a pending local vote while the request is in flight.
- **Switch active poll** uses a styled shadcn menu with a blue selected row and checkmark. Long questions wrap on mobile; arrow keys navigate, Enter selects, and Escape closes the menu and restores focus. Selecting a poll updates both voting and results. Switching remains disabled while saving or reconciling a vote.
- A known rejection removes only the pending vote, displays an error, and permits a manual retry.
- A lost connection or unrecognized server failure may occur after commit. The UI removes the pending overlay and checks authoritative results before permitting another submission. It never automatically repeats a POST.
- A confirmed vote remains confirmed even if the following refresh fails. Refresh warnings retain the last known results and recover automatically.
- Socket.IO pushes `poll:changed` notifications after committed votes. Each viewer immediately fetches their own results; notifications never contain another user's identity or `myVote`.
- Notifications are coalesced while a GET is in progress and deferred during submission. Reconnecting immediately fetches authoritative results. Older responses cannot overwrite newer state.
- While disconnected or recovering from a results error, HTTP polling refreshes every two seconds after the preceding request completes. Connected clients also perform a 30-second safety read. The UI reports the actual live-connection state.
- The default `VOTE_FAILURE_RATE=0.15` simulates HTTP 500 rejection before writing. Set it to `0` for a failure-free local demo or `1` to demonstrate rollback. Valid values are 0 through 1. Restart the development API or recreate the app container after changing it. Compose reads this variable from `.env`.

The mock user ID is stored in browser localStorage and sent as `X-Mock-User-Id`. It is a simulation, not authentication: a different browser profile or changing this header creates a different mock voter. PostgreSQL enforces one vote per `(poll_id, user_id)`, but this is not production-grade identity or abuse prevention.

## API

Poll endpoints require `X-Mock-User-Id` containing 1-80 letters, digits, underscores, or hyphens. Poll/option IDs must be UUIDs. Responses are JSON; errors have `{ error: { code, message } }`.

| Endpoint | Success | Expected failures |
|----------|---------|-------------------|
| `GET /api/health` | 200 with initialized database reachable | 503 database unavailable |
| `GET /api/polls/active` | 200 with question and ordered options | 400 invalid identity, 404 no active poll |
| `GET /api/polls/:pollId/results` | 200 with counts, total, active flag, and `myVote` | 400 invalid ID/identity, 404 unknown poll |
| `POST /api/polls/:pollId/votes` | 201 with `{ pollId, optionId }`, body `{ optionId }` | 400 invalid body/option/identity, 404 unknown poll, 409 duplicate/closed poll, 500 simulated failure |

Votes are individual inserted rows, not mutable JavaScript counters. A composite foreign key prevents voting for an option from another poll. Counts and `myVote` come from one database statement snapshot.

### Socket.IO

- Engine endpoint: `/socket.io/`, served on the same port as Express.
- Server event: `poll:changed`, payload exactly `{ pollId }`.
- No socket vote submission endpoint: votes still use the validated HTTP POST and PostgreSQL constraints.
- The client uses Socket.IO's polling-to-WebSocket upgrade and automatic reconnection. Socket.IO engine polling is separate from the application's two-second HTTP results fallback.
- No events are sent for rejected/duplicate/simulated-failure votes. Notification failures after commit are logged without changing a successful vote response into a rejection.
- Server implementation: `apps/api/src/realtime/socketServer.ts`; browser subscription: `apps/web/src/api/pollUpdates.ts`.

## Validation

Latest shared-configuration refactor: type checks, 85 unit/UI tests, 26 real PostgreSQL/API/socket integration tests, and production build passed. New integration tests run a real Vite proxy against an ephemeral non-default API port and verify health, voting, result read-back, Socket.IO polling, WebSocket upgrade, and committed-vote notifications.

```powershell
npm run typecheck
npm test
npm run test:integration
npm run build
```

Unit and frontend tests run without PostgreSQL. Integration tests require a reachable PostgreSQL database configured through `.env` or `DATABASE_URL`.

Run both test suites in Docker:

```powershell
docker compose --profile test run --build --rm test
```

Verified on 2026-11-08:

- `npm run typecheck`, `npm test` (68 tests), `npm run test:integration` (18 tests), and `npm run build` passed.
- Docker app build/startup and `docker compose --profile test run --build --rm test` passed. Container tests passed all 68 unit/UI and 18 integration tests.
- Real PostgreSQL tests saved exactly 100 concurrent distinct-user votes; 100 duplicate submissions produced one 201 and 99 duplicate 409s.
- Deterministic frontend tests cover immediate updates, rollback, stale responses, uncertain submissions, refresh recovery, confirmation without double-counting, and cleanup.
- Browser checks verified real submission, reload persistence, automatic refresh after another user's vote, keyboard selection, and a 375px viewport without horizontal overflow. A browser-local mocked 500 verified visible rollback separately from real database evidence.
- A real browser vote survived a Docker app-container restart. The existing database container and its volume were not stopped or deleted.
- Real Socket.IO clients received committed notifications over WebSocket and HTTP polling; 100 concurrent accepted votes produced 100 notifications and exact persisted counts.
- Browser validation captured a real Socket.IO `poll:changed` WebSocket frame through Vite and verified live result updates. Blocking only Socket.IO requests verified HTTP fallback with real PostgreSQL votes and reconnection after unblocking.

Docker runtime validation used a temporary port-3001 override because the existing development API occupied port 3000. The normal Compose port remains 3000. Temporary test votes were removed; existing votes and development servers were preserved.

## Structure

```text
apps/web         React UI and frontend tests
apps/api         Express API and backend tests
packages/shared  API types and runtime response validation
```

UI primitives live in `apps/web/src/components/ui`. Product components compose these primitives, using Tailwind utilities and semantic theme tokens. Backend app construction is separate from server startup to support dependency-injected tests.

See [AGENTS.md](./AGENTS.md) for repository conventions.

## Scope and handoff

This MVP provides one active poll, mock identity, and required Socket.IO live updates, not account authentication, poll administration, or production deployment. Socket notifications are local to one API instance; a future multi-instance deployment needs a shared adapter or database event bridge. The concurrency tests prove 100 overlapping requests, not literal same-millisecond arrival or a throughput benchmark.

See [plan.md](./plan.md), [AGENT_WORKFLOW.md](./AGENT_WORKFLOW.md), and [DELIVERABLES.md](./DELIVERABLES.md). Voting changes are not automatically committed or pushed; commit history must reflect actual work rather than fabricated intermediate commits.
