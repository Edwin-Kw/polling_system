# Implementation Plan: High-Concurrency Polling System

**Date:** 2026-11-07  
**Assignment:** [Coding assignment](./P&T%20High-Concurrency%20Polling%20System%20-%20Coding%20assignment.md)  
**Status:** Voting and required Socket.IO live updates implemented and validated on 2026-11-08. All 68 unit/UI tests, 18 real PostgreSQL/socket integration tests, type checks, build, and Docker tests passed. The latest changes still need a user-requested commit/push.

## 1. Summary and scope

Build a small TypeScript monorepo using React, Node.js, Express, and PostgreSQL. Run it locally with Docker Compose. Prioritize correct vote recording, optimistic rollback, and test evidence over extra features.

PostgreSQL is feasible for local development: Docker supplies the database, so only Docker Desktop with Compose is required for the containerized workflow. A named Docker volume preserves votes across restarts.

This implementation seeds one active poll with four options and uses a stable mock user identifier. Socket.IO must deliver live change notifications; HTTP polling every two seconds is a disconnected/recovery fallback, not a replacement for sockets. The poll/option quantities and fallback interval are MVP choices, not quantities or intervals mandated by the assignment. The written requirements ask for the active poll; the reference screenshot also shows a poll switcher, which this implementation does not provide. Database tables still use poll IDs.

The original assignment does not prohibit authentication, Redis, microservices, ORMs, repository abstractions, global state libraries, or WebSockets. Polling, WebSockets, and Server-Sent Events are all explicitly allowed by that document. The user's subsequent instruction, "where is the socket io it is a must", makes Socket.IO mandatory for this repository implementation. Keep mock identity, direct PostgreSQL queries, and React hooks; these do not conflict with Socket.IO.

Tailwind CSS and shadcn/ui are additional user preferences, not requirements in the original assignment. Keeping setup/agent commentary out of the product UI is also a product presentation choice.

### Requirements from the original assignment

- React frontend and Node.js backend with poll display, answer selection, and submission.
- Immediate optimistic UI updates, plus vote counts and percentages.
- A mechanism to keep results current, with polling, WebSockets, or SSE given as examples.
- Endpoints to fetch the active poll, submit a vote, and fetch results.
- Concurrency-safe storage that records all 100 concurrent votes for the same option without lost updates. A database of choice or a robust in-memory structure is permitted.
- A simulated 15% submission failure rate, with graceful rollback and contextual errors.
- Backend-enforced prevention of repeat voting by the same user; mock user ID, session, or IP simulation is permitted. Real authentication is not required.
- Git source, atomic logical commits, a locally runnable application, at least one critical-failure automated test suite, and honest AI workflow documentation.

## 2. Technical context

| Area | Choice | Why |
|------|--------|-----|
| Language | TypeScript throughout | Shared API types and testable interfaces |
| Runtime | Node.js 24 LTS recommended; Node.js 22.18+ also supported | Docker uses Node.js 24; current host uses Node.js 22.20 |
| Workspace | npm workspaces | One lockfile and root commands; no extra monorepo tooling |
| UI | `react`, `react-dom`, Vite | Small SPA with a fast development server |
| Backend | `express` | Straightforward routing and centralized error handling |
| Live updates | `socket.io`, `socket.io-client` | Required push notifications; reconnect and safe HTTP fallback |
| Database | PostgreSQL 17 with `pg` | SQL constraints enforce vote integrity |
| Runtime validation | `zod` | Validate incoming API data; TypeScript alone cannot do this |
| Backend tests | `vitest`, `supertest` | Unit tests and HTTP integration tests without binding a port |
| Frontend tests | `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom` | Test observable behavior and accessibility |
| Development | `typescript`, native Node.js TypeScript execution, `concurrently`, appropriate type packages | Type checking, backend watch mode, and one command for both development servers |
| Styling | Tailwind CSS and shadcn/ui | Reusable accessible primitives and semantic theme tokens |
| Deployment | Multi-stage `Dockerfile`, `compose.yaml` | Build the SPA and serve it with Express; one app container plus database |

Resolve mutually compatible package versions when scaffolding and commit `package-lock.json`. Do not assume every package's newest release works with every other package.

### Principles and applicable guidelines

This is a new project; there is no existing codebase, constitution, topology, or upstream architecture artifact to migrate. The assignment is the source of requirements. Available migration guidelines concern Java/Spring and do not apply here.

- Keep data integrity in PostgreSQL, not frontend state or process-local locks.
- Separate pure calculations, UI components, HTTP wiring, and SQL access.
- Use real PostgreSQL for tests claiming concurrency or constraint guarantees.
- Report errors explicitly; never replace failed requests with success-shaped defaults.
- Keep the original assignment unchanged and record actual AI-assisted work honestly.

## 3. Proposed repository structure

```text
polling_sys/
  package.json                    # private npm workspace and root commands
  package-lock.json
  tsconfig.base.json
  vitest.config.ts                 # unit and UI test selection
  vitest.integration.config.ts     # database-backed test selection
  .gitignore
  .dockerignore
  .env.example                    # documented development placeholders, no real secrets
  Dockerfile
  compose.yaml
  README.md
  AGENT_WORKFLOW.md                # written from actual implementation experience
  plan.md
  DELIVERABLES.md
  apps/
    web/
      package.json
      tsconfig.json
      vite.config.ts
      index.html
      src/
        main.tsx
        App.tsx
        styles.css
        api/polls.ts               # typed fetch wrappers; accept AbortSignal
        identity/mockUser.ts       # stable localStorage ID, injectable in tests
        hooks/usePoll.ts           # loading, refresh, submission and reconciliation
        hooks/usePoll.test.tsx
        state/pollState.ts         # pure reducer and optimistic result derivation
        state/pollState.test.ts
        components/
          PollVotingForm.tsx
          PollVotingForm.test.tsx
          PollResults.tsx
          OptionResult.tsx
          StatusMessage.tsx
        test/setup.ts
    api/
      package.json
      tsconfig.json
      src/
        app.ts                     # createApp(dependencies); no listen or global pool
        server.ts                  # config, pool, startup, static SPA and shutdown
        config.ts                  # validate environment once at startup
        routes/polls.ts
        services/voteService.ts
        services/voteService.test.ts
        db/pool.ts
        db/pollRepository.ts       # parameterized SQL; small explicit interface
        db/schema.sql
        db/seed.sql
        db/migrate.ts              # repeatable schema/seed setup
        middleware/errorHandler.ts
        testing/failurePolicy.ts   # configurable random source and rate
        testing/failurePolicy.test.ts
      test/
        database.ts                # unique test schema setup and teardown
        votes.integration.test.ts
  packages/
    shared/
      package.json
      tsconfig.json
      src/
        index.ts                   # request/response types and error codes
        results.ts                 # pure count-to-percentage function
        results.test.ts
```

The tree describes the implemented architecture. Startup initializes the SQL schema/seed; routes call the vote service and repository. Additional focused client, identity, poll-contract, and TCP runtime tests cover the same requirements.

## 4. Reuse and unit-test boundaries

- `PollVotingForm` receives options, selection, disabled state, and callbacks. It does not fetch data.
- `PollResults` receives already derived results and refresh status. `OptionResult` renders each result row.
- `StatusMessage` consistently renders loading, refresh warnings, and submission errors with appropriate accessible roles.
- `usePoll` owns orchestration; components remain presentational.
- `ActivePollSelect` composes the shadcn Select primitive with semantic blue accents, wrapped poll questions, and selected checkmarks. It receives only poll data, disabled/loading state, and callbacks. Preserve arrow-key navigation, Escape focus restoration, and pending/reconciliation locks.
- `pollState` is a pure reducer. Model confirmed server results separately from a pending local vote.
- `results.ts` calculates totals and percentages in one place. Zero votes produce 0%, never `NaN`; rounding is display-only and may not sum to exactly 100%.
- `api/polls.ts` owns headers, JSON handling, non-2xx errors, and cancellation. Do not duplicate fetch handling inside components.
- `api/pollUpdates.ts` owns the Socket.IO client, message validation, reconnection, and cleanup. The hook injects its subscription interface for deterministic tests.
- The shared package exports transport types and pure helpers, not server configuration or database code. HTTP input still requires runtime validation.
- `packages/shared/src/transport.ts` is the source of API paths/router patterns, the mock identity header, and Socket.IO path/event names. Clients, Express, Vite, and request tests reuse those definitions; contract tests independently assert the published strings.
- `packages/shared/src/development.ts` is a separate Node-side export for host/port defaults, address validation, and origin formatting. API configuration and Vite use the same root `.env` address settings with shell overrides; database configuration stays in the API workspace. Vite reads only address fields without letting the backend's `NODE_ENV` change browser build mode.
- `createApp` accepts the repository and failure policy. Importing it does not open a port or connect to PostgreSQL.
- Inject `random`, the frontend API interface, and the mock user provider for deterministic tests. Use fake timers for refresh tests.
- Keep pure unit tests independent of Docker. Do not mock SQL and describe that as a concurrency proof.

## 5. Data integrity and API behavior

### Storage approach

Use `polls`, `poll_options`, and `votes` tables.

- `polls`: ID, question, active flag. Seed one active poll.
- `poll_options`: ID, poll ID, label, and display order.
- `votes`: poll ID, option ID, mock user ID, and creation time.
- Enforce `UNIQUE (poll_id, user_id)` on votes.
- Enforce option membership using a composite foreign key `(poll_id, option_id)` referencing a unique `(poll_id, id)` on `poll_options`.
- Fetch counts using an aggregate over stored votes and a left join so options with zero votes remain visible.

Do not read a counter, increment it in JavaScript, and write it back. Each accepted vote is a single inserted row; SQL aggregation derives the counts. Concurrent duplicate requests compete on the unique constraint, rather than a vulnerable "check then insert" sequence.

Use one SQL insert statement to record a vote for an active poll. If a later implementation introduces multi-statement writes, use a transaction on one checked-out connection. Convert only the known duplicate-user constraint into a 409; log and surface unexpected database errors.

Return results using one consistent database snapshot, including this user's recorded option. Do not assemble counts and `myVote` from unrelated queries that could observe different states.

### Proposed endpoints

All API requests use `/api`. The stable mock identifier is sent as `X-Mock-User-Id` and validated for presence, format, and length.

| Endpoint | Successful behavior | Important failures |
|----------|---------------------|--------------------|
| `GET /api/polls/active` | 200 with poll ID, question, ordered options | 404 if no active poll |
| `GET /api/polls/:pollId/results` | 200 with per-option counts, total votes, and `myVote` (option ID or null) | 400 invalid ID; 404 unknown poll |
| `POST /api/polls/:pollId/votes` | Body `{ optionId }`; 201 after the vote is committed | 400 invalid body/option; 404 unknown poll; 409 duplicate/closed poll; 500 simulated failure |
| `GET /api/health` | 200 only when the database is reachable and initialized | 503 while not ready |

Use an explicit error body such as `{ error: { code, message } }`. Validate body shape and identifiers; reject an option belonging to another poll. Never interpolate user input into SQL.

The identifier is a simulation, not authentication: clearing localStorage or changing the header can impersonate another mock user. Document this limitation rather than claiming production-grade abuse prevention.

### Required Socket.IO contract

Attach Socket.IO to the API HTTP server after its Express request handler has been registered, so the engine exclusively handles `/socket.io/` requests. Vite proxies both HTTP and WebSocket traffic on that path.

After each committed vote, emit `poll:changed` with exactly `{ pollId }`. Rejections, duplicate votes, and simulated failures emit nothing. Do not broadcast `myVote`, user identifiers, or personalized results; clients fetch their own authoritative snapshot through HTTP. If publishing throws after commit, log it without misreporting the saved vote as rejected.

Clients connect after loading the poll, validate incoming events, and ignore events for other polls. A notification triggers an immediate non-overlapping GET; bursts coalesce into one follow-up read. Socket connection/reconnection also refreshes the snapshot to recover changes missed while offline. Connection status shown in the UI must reflect actual connection events.

This MVP has a single API instance and the default in-process Socket.IO adapter. Multiple API instances do not share notifications; a future multi-instance deployment would require an appropriate shared adapter or database event bridge. PostgreSQL vote integrity remains authoritative independently of the notification transport.

### Failure simulation

For valid vote submissions, apply a configurable policy before any database mutation. Default rate: 0.15, with `random() < failureRate` returning an explicit HTTP 500 and a stable error code.

The assignment allows a 500 error or a three-second delay; use the 500 branch for this MVP. A plain successful three-second delay is not necessarily a failed vote, so do not invent a rollback requirement for a delayed 201.

Set the rate to zero for concurrency tests. Inject exact random values to test both sides of the 0.15 threshold. Do not rely on a flaky statistical assertion over random requests.

## 6. Optimistic UI and refresh behavior

1. Fetch the active poll and its results; display loading, empty, and error states explicitly.
2. On submit, immediately overlay one vote on the selected option and recompute totals and percentages.
3. Disable resubmission while pending and after a confirmed `myVote`. The backend remains authoritative.
4. Abort or invalidate an in-flight refresh before submitting. Use a request generation token so stale responses cannot overwrite newer state.
5. On 201, remove the local overlay, mark the user's vote confirmed, and fetch authoritative results. A failed follow-up refresh must not undo a confirmed vote.
6. On a known 500 rejection, remove only the pending overlay, retain the latest confirmed results, display a contextual error, and allow retry. Do not restore an entire old snapshot that discards other users' votes.
7. On 409, remove the overlay and refetch `myVote` and results; disable voting if a vote is already recorded.
8. On connection loss or client cancellation, the server may already have committed. Remove the overlay, display "Vote status unknown; checking", and reconcile through the results endpoint before offering another submission. Never automatically repeat the POST.
9. Refresh immediately on Socket.IO changes and reconnects. Queue/coalesce changes during an in-flight refresh, and defer them while submitting. Use two-second completion-scheduled polling while sockets are disconnected or results/reconciliation need recovery; use a 30-second safety read while connected. Reconciliation reads remain allowed, but never repeat a POST automatically. Clean up socket listeners, timers, and requests on unmount.
10. A refresh failure keeps the last confirmed results visible with a warning. Recover on the next scheduled refresh; do not show invented zero counts.

The unique database constraint prevents a retry from recording a second vote even after an ambiguous network failure.

## 7. Docker and local commands

These commands are implemented. Docker startup was validated with a temporary port-3001 override to avoid interrupting the existing development API on port 3000.

### Containerized workflow

```powershell
docker compose up --build
# Open http://localhost:3000

docker compose --profile test run --build --rm test

docker compose down
```

- `db`: PostgreSQL container, named volume, and `pg_isready` health check.
- `app`: production image; build shared code, Vite assets, and backend in dependency order. Express serves the built SPA and API on port 3000, bound to `0.0.0.0`.
- Start the app only after the database is healthy; run idempotent schema/seed initialization before listening.
- `test`: test-profile service using a Docker build target with development dependencies and source tests. Its command runs unit/UI tests and real PostgreSQL integration tests.
- API URLs stay relative to `/api`; no Nginx or CORS package is required for the same-origin deployment.
- A Vite development proxy forwards `/api` and `/socket.io` (including WebSocket upgrades) to the backend when running outside Docker.
- Publish PostgreSQL only on `127.0.0.1:5433` if host-based development/testing needs it. Inside Compose, connect to `db:5432`, never `localhost`.
- Supply visibly local-only database placeholders through Compose defaults and `.env.example`; never commit real credentials or `.env`.
- Use `npm ci`, non-root runtime execution, a named data volume, and SIGTERM cleanup of Socket.IO clients, the HTTP server, and the database pool.
- `docker compose down` preserves data. Document volume deletion separately as destructive; do not include it in routine cleanup.

### Host development and validation

```powershell
npm ci
docker compose up -d db
# Copy .env.example to .env and configure the host database URL.
npm run db:setup
npm run dev
npm run typecheck
npm test
npm run test:integration
npm run build
```

`npm run dev` uses `concurrently` to start Vite and the backend watcher together, terminating both when either fails. `npm test` covers pure/backend unit and frontend behavior tests without PostgreSQL. `npm run test:integration` requires a database and must fail clearly if unavailable. `npm run test:all` runs both and is used by the test container. Document actual frontend and API development ports.

## 8. Test plan and acceptance criteria

| Test | Deterministic setup | Required assertion |
|------|---------------------|--------------------|
| Concurrent distinct users | Disable simulated failures; submit 100 HTTP requests concurrently with different user IDs | Exactly 100 responses are 201; exactly 100 persisted votes; chosen option count increases by 100 |
| Concurrent duplicate user | Send 100 concurrent submissions for one user and poll | Exactly one 201, 99 duplicate 409s, and one persisted vote |
| Option validation | Submit unknown option and option from another poll | 400; no inserted vote |
| Missing/malformed user | Missing or invalid mock header | 400; no inserted vote |
| Failure threshold | Inject random values 0.149 and 0.15 | First rejects; second passes; rejected request does not write |
| Optimistic success | Control a deferred API promise | Count changes before completion; after success, authoritative result is shown without a second increment |
| Optimistic rollback | Reject controlled submission with known 500 | Pending vote disappears; confirmed counts remain; error appears; retry is enabled |
| Refresh race | Resolve an older GET after submission starts | Stale response does not erase the pending or newly confirmed vote |
| Uncertain submission | Simulate connection loss, then resolve reconciliation with recorded vote | No automatic POST retry; correct confirmed result; voting disabled |
| Refresh recovery | Fail a GET, then succeed on the next refresh | Last data remains visible; warning appears then clears |
| Pure result calculations | Zero votes and varied counts | Correct totals, 0% for empty poll, stable display rounding |
| Docker readiness/persistence | Start app, cast successful vote, restart without deleting volume | Health endpoint responds; SPA works; accepted vote remains |

The concurrency tests demonstrate 100 overlapping requests, not guaranteed arrival at the literal same millisecond. The insert and unique constraints provide the integrity guarantee.

The synchronized TCP suite additionally preconnects 100 clients and releases their request bodies in one synchronous loop. It reports client release span, server body-completion span, and the largest group in one millisecond bucket using a monotonic clock. Timing is measured, not asserted to be exactly one millisecond: TCP and event-loop scheduling prevent that guarantee. Run it with `npm run test:integration -- apps\api\test\synchronizedVotes.integration.test.ts --reporter=verbose --silent=false`.

Use a unique, generated PostgreSQL schema per integration suite and configure every test connection to use it. Apply schema and seed there; tear down only that exact test-owned schema after closing its pool. Never truncate the normal application database or use a shared development schema. Wait for all test requests to settle before teardown.

Minimum assignment evidence is one critical-failure suite. Aim to deliver both the concurrency suite and optimistic rollback suite; do not trade them away for optional UI features.

## 9. Implementation steps and inline tasks

The following REQ IDs are planning labels derived from the assignment, not IDs present in the source document. Implementation and validation are complete; publishing and meaningful subsequent commits remain user-controlled.

### Phase 1: Setup - 25 minutes

**Plan 1.1:** Create the workspace, shared transport types, and scripts.  
**Requirements:** REQ-001, REQ-004, REQ-009.

- [x] T001 [Plan:1.1] Scaffold root `package.json`, `tsconfig.base.json`, and workspace manifests in `apps/web/package.json`, `apps/api/package.json`, and `packages/shared/package.json`; generate one lockfile.
- [x] T002 [Plan:1.1] Define request/response types and error codes in `packages/shared/src/index.ts`; configure workspace build order and frontend proxy in `apps/web/vite.config.ts`.

### Phase 2: Database and backend foundation - 45 minutes

**Plan 2.1:** Implement persistent poll storage and database-enforced single voting.  
**Requirements:** REQ-004, REQ-005, REQ-007.

- [x] T003 [Plan:2.1] Implement constraints and repeatable seed/setup in `apps/api/src/db/schema.sql`, `apps/api/src/db/seed.sql`, and `apps/api/src/db/migrate.ts`.
- [x] T004 [Plan:2.1] Implement parameterized insert and snapshot-consistent results query in `apps/api/src/db/pollRepository.ts` with connection setup in `apps/api/src/db/pool.ts`.

**Plan 2.2:** Wire validated endpoints and deterministic failure simulation.  
**Requirements:** REQ-004, REQ-006, REQ-007.

- [x] T005 [Plan:2.2] Implement `apps/api/src/services/voteService.ts`, `apps/api/src/routes/polls.ts`, `apps/api/src/app.ts`, and `apps/api/src/middleware/errorHandler.ts` with injected dependencies and explicit error codes.
- [x] T006 [Plan:2.2] Implement injectable pre-write failure policy in `apps/api/src/testing/failurePolicy.ts`, validate environment in `apps/api/src/config.ts`, and wire runtime startup/shutdown in `apps/api/src/server.ts`.

### Phase 3: US1 - Vote with immediate feedback - 45 minutes

**Plan 3.1:** Build reusable presentation and pure result calculations.  
**Requirements:** REQ-001, REQ-002, REQ-008.

- [x] T007 [US1] [Plan:3.1] Implement and test `packages/shared/src/results.ts` and `packages/shared/src/results.test.ts`.
- [x] T008 [US1] [Plan:3.1] Implement accessible `apps/web/src/components/PollVotingForm.tsx`, `PollResults.tsx`, `OptionResult.tsx`, and `StatusMessage.tsx`; compose them in `apps/web/src/App.tsx` with `apps/web/src/styles.css`.

**Plan 3.2:** Implement optimistic overlay, rollback, and stable mock identity.  
**Requirements:** REQ-001, REQ-002, REQ-006, REQ-007.

- [x] T009 [US1] [Plan:3.2] Implement typed request handling in `apps/web/src/api/polls.ts` and injectable stable ID provider in `apps/web/src/identity/mockUser.ts`.
- [x] T010 [US1] [Plan:3.2] Implement pure optimistic state in `apps/web/src/state/pollState.ts` and submission/reconciliation in `apps/web/src/hooks/usePoll.ts`; wire the hook into `apps/web/src/App.tsx`.

### Phase 4: US2 - Keep results live - 20 minutes

**Plan 4.1:** Add non-overlapping refresh, stale-response protection, and recovery.  
**Requirements:** REQ-002, REQ-003, REQ-006.

- [x] T011 [US2] [Plan:4.1] Implement completion-scheduled fallback/recovery refresh and cancellation cleanup in `apps/web/src/hooks/usePoll.ts`; expose stale-result warnings and honest live-connection status in `apps/web/src/components/PollResults.tsx`.

- [x] T017 [US2] [Plan:4.1] Implement required Socket.IO server/client, post-commit invalidations, WebSocket development proxy, burst coalescing, disconnect/reconnect recovery, transport cleanup, and real socket integration tests. Trace REQ-003 and user-added REQ-013.

### Phase 5: Critical validation - 55 minutes

**Plan 5.1:** Prove database integrity and failure behavior.  
**Requirements:** REQ-004, REQ-005, REQ-006, REQ-007, REQ-011.

- [x] T012 [Plan:5.1] Configure `vitest.config.ts` and `vitest.integration.config.ts`; implement isolated-schema harness in `apps/api/test/database.ts` and concurrent/validation HTTP tests in `apps/api/test/votes.integration.test.ts`.
- [x] T013 [Plan:5.1] Test failure thresholds and service error mapping in `apps/api/src/testing/failurePolicy.test.ts` and `apps/api/src/services/voteService.test.ts`.

**Plan 5.2:** Prove optimistic behavior and refresh race handling.  
**Requirements:** REQ-001, REQ-002, REQ-003, REQ-006, REQ-011.

- [x] T014 [Plan:5.2] Implement `apps/web/src/test/setup.ts`, `apps/web/src/state/pollState.test.ts`, `apps/web/src/hooks/usePoll.test.tsx`, and `apps/web/src/components/PollVotingForm.test.tsx` using deferred promises and fake timers.

### Phase 6: Delivery and review - 50 minutes

**Plan 6.1:** Package local runtime and test execution.  
**Requirements:** REQ-009, REQ-010, REQ-011.

- [x] T015 [Plan:6.1] Create `Dockerfile`, `compose.yaml`, `.dockerignore`, `.gitignore`, and `.env.example`; validate typecheck, tests, build, Docker readiness, and persistence using the commands in section 7.

**Plan 6.2:** Document actual workflow and prepare the repository handoff.  
**Requirements:** REQ-009, REQ-010, REQ-012.

- [x] T016 [Plan:6.2] Write verified setup/test commands in `README.md`, actual prompts and audited fixes in `AGENT_WORKFLOW.md`, and record verified/pending handoff items in `DELIVERABLES.md`; inspect repository history and tracked files for the handoff.

Total time budget: 240 minutes. Make logical commits only when requested; never fabricate incremental history. If behind schedule, reduce styling and optional refinements, not integrity checks or required deliverables.

### Dependencies

T002 follows T001. T003 follows T002; T004 follows T003. T005 follows T004; T006 follows T005. T007 follows T002; T008 follows T007. T009 follows T002; T010 follows T007, T008, and T009. T011 follows T010. T012 follows T006; T013 follows T006 and T012. T014 follows T007, T011, and T012. T015 follows the implementation and test tasks. T016 follows T015.

T017 follows T006, T011, and T012, extending the already validated voting flow without changing the HTTP vote contract or database constraints.

These express prerequisites, not a requirement to use parallel agents.

## 10. Requirement mapping

| REQ ID | Assignment requirement | Plan items | Planned implementation evidence |
|--------|------------------------|------------|---------------------------------|
| REQ-001 | React poll display, answer selection, submission | 1.1, 3.1, 3.2, 5.2 | `apps/web/src/App.tsx`, `components/PollVotingForm.tsx` |
| REQ-002 | Immediate optimistic counts and percentages | 3.1, 3.2, 4.1, 5.2 | `packages/shared/src/results.ts`, `state/pollState.ts` |
| REQ-003 | Automatically updated results | 4.1, 5.2 | `hooks/usePoll.ts`, `api/pollUpdates.ts`, realtime hook/socket tests |
| REQ-004 | Node API for active poll, vote, and results with storage | 1.1, 2.1, 2.2, 5.1 | `apps/api/src/routes/polls.ts`, `db/pollRepository.ts` |
| REQ-005 | Record 100 simultaneous distinct-user votes accurately | 2.1, 5.1 | `db/schema.sql`, `test/votes.integration.test.ts` |
| REQ-006 | 15% simulated failure; rollback and contextual errors | 2.2, 3.2, 4.1, 5.1, 5.2 | `testing/failurePolicy.ts`, `hooks/usePoll.test.tsx` |
| REQ-007 | Backend-enforced duplicate prevention and validation | 2.1, 2.2, 3.2, 5.1 | `db/schema.sql`, `routes/polls.ts`, integration tests |
| REQ-008 | Reusable components/functions and unit-testable code | 3.1 | Presentation components, shared helpers, injected dependencies |
| REQ-009 | Git repository containing frontend and backend | 1.1, 6.1, 6.2 | Workspace manifests, `.gitignore`, repository handoff |
| REQ-010 | Locally runnable full-stack app | 6.1, 6.2 | `Dockerfile`, `compose.yaml`, `README.md` |
| REQ-011 | Automated tests covering a critical failure mode | 5.1, 5.2, 6.1 | Concurrency and rollback suites; test-profile service |
| REQ-012 | Atomic logical commits and honest AI workflow notes | 6.2 | Actual Git history, `AGENT_WORKFLOW.md`, delivery checklist |
| REQ-013 | User-required Socket.IO live updates | 4.1, 5.1, 5.2 | `apps/api/src/realtime/socketServer.ts`, `apps/web/src/api/pollUpdates.ts`, `apps/api/test/realtime.integration.test.ts` |

REQ-008 and REQ-013 come from additional user requests, not the original assignment. Functional voting, required Socket.IO, concurrency, rollback, and local-runtime requirements have implementation/test evidence. The commit-history handoff remains pending; passing application tests does not fulfill that separate deliverable.
