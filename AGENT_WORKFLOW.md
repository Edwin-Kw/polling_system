# Agent-assisted workflow

## Scope so far

This document records repository setup, UI foundation refinements, and the verified voting implementation. Publishing the latest changes and the final commit-history handoff remain user-controlled.

## Tools and prompt strategy

The user asked an AI assistant using Copilot SDK in VS Code to convert the assignment PDF, prepare a repository plan, and then set up the approved React/Node.js/PostgreSQL/Docker stack.

The setup request was: "the stack is good, help me setup first".

Work was bounded to scaffolding, shared types, database readiness, runtime packaging, and test foundations. Voting behavior remains a separate slice. The original assignment and plan were retained as context.

## Decisions audited during setup

- The machine has Node.js 22.20, while the planned Docker runtime is Node.js 24. Native TypeScript execution works on the supported Node.js versions, so an extra `tsx` dependency is unnecessary.
- The newest inspected `jsdom` release requires a newer Node.js patch than the host provides. The scaffold uses the compatible 26.x line rather than installing a known incompatible version.
- Docker Desktop was not found. Database readiness failures are surfaced as HTTP 503 and visible UI errors; no in-memory database or fake success was substituted.
- Backend app construction is separate from server startup. Unit tests inject database checks; a separate integration test requires real PostgreSQL.

## Implementation recording policy

Record actual prompts, bugs observed, fixes made, and exact validation results as the voting slices are implemented. Do not invent audit findings or report unexecuted tests as passing.

## Observed test flaw and correction

The first frontend readiness test waited for an element with role `status`. That element already existed during loading, so the assertion ran before the success message arrived. The test failed with "Checking API and PostgreSQL..." instead of the expected connected message. It was corrected to wait for the exact success text using `waitFor`, rather than weakening the assertion or changing application behavior.

## Setup validation results

- Type checks passed for application code, tests, and Vitest configuration.
- All 14 unit/UI tests passed after correcting the asynchronous assertion.
- Shared, API, and frontend production builds passed.
- Both development servers and the Vite API proxy were verified through actual HTTP requests; the temporary validation servers were stopped afterward.
- The compiled server served frontend HTML/assets successfully and explicitly reported the unavailable PostgreSQL database.
- The real PostgreSQL connectivity test failed with connection refused because Docker/PostgreSQL are unavailable. Docker builds and container execution are not claimed validated.
- Dependency installation reported zero known vulnerabilities.

## Product UI refinement

The user requested `AGENTS.md`, Tailwind CSS, shadcn/ui, and removal of interview/setup commentary from the application. Repository rules now separate product-facing content from development documentation.

Tailwind's Vite plugin and semantic theme variables replace the handcrafted layout styles. The shadcn CLI generated Button, Card, and Alert primitives. Its generated files import `class-variance-authority`, but the CLI did not install that dependency; it was declared directly rather than depending on an unrelated transitive installation.

At that stage, the product screen showed connection loading, actionable failure/retry, or voting-unavailable state. It did not claim that database health implied an active poll, fabricate votes, or implement a pretend submission flow. Poll persistence and voting were still pending.

Validation after this refinement: type checks, all 14 unit/UI tests, and the production build passed. Browser checks verified the real connection-error state, keyboard activation of retry, and a 375px mobile viewport without horizontal overflow. A controlled health response verified the voting-unavailable state without poll data; this was UI testing, not proof of a live PostgreSQL connection. Tailwind styles were confirmed through computed background and card radius. The temporary preview server was stopped afterward.

## Voting implementation - 2026-11-08

### Actual user prompts and scope

The user reported: "Voting is currently unavailable. Please check back soon. waht is the next step". After the assistant explained that this was the scaffold's placeholder, the user asked: "please go on".

The assistant used the assignment, existing plan, and repository rules to implement the planned voting slice end to end. No commits or pushes were made by the assistant in this slice.

### Implementation and audited edge cases

- PostgreSQL stores one row per vote. A unique `(poll_id, user_id)` constraint resolves competing duplicates, and a composite option/poll foreign key rejects cross-poll options. No read-modify-write counters or process-local voting locks were introduced.
- Results aggregate counts and the current user's option in one statement snapshot, rather than combining unrelated reads.
- Failure simulation is injectable and occurs after input/poll/option validation but before insertion. Threshold tests use 0.149 and 0.15 rather than probabilistic assertions.
- The UI keeps confirmed results separate from the pending overlay. Tests verify that rollback preserves newer votes from other users, and that an acknowledged vote is not undone when the follow-up GET fails.
- Network loss and unknown server errors are not treated as proof of rejection. Reconciliation locks resubmission until a successful authoritative read; POST is never automatically retried.
- Request generations and cancellation prevent stale refresh results from overwriting submission state. Timeouts bound stalled requests to eight seconds, and refreshes use completion-scheduled timeouts rather than overlapping intervals.
- SQL files are explicitly copied during the API build so compiled Docker startup uses the same migrations as local development.

### Observed failures and verification

Tests were added before implementation. The first backend/calculation run failed because the new result calculation and `active` result field did not exist yet; the first frontend run failed on missing voting client/hook/reducer imports. Both were expected red tests, not reported as passes.

During browser validation, a delayed Playwright route interception stalled and the client timed out. The UI correctly reconciled and reported that no vote was recorded, but the intended mocked-500 assertion timed out. The test was corrected to use a one-shot browser-local fetch mock, which verified the immediate pending total, rollback message, and enabled manual retry. This mocked check is not a database persistence claim.

Independent real browser requests returned 201, remained recorded after reload and a Docker app restart, and showed another user's vote through automatic refresh. Restarting the temporary app interrupted a GET; the UI recovered without losing confirmed results.

A final regression test exposed a cross-tab state flaw: an earlier rejection message survived after an authoritative snapshot confirmed that the same user had voted in another tab. The test failed with "Your vote wasn't saved." where no error was expected. Confirmation now clears that obsolete error, and the regression passes.

Final validation passed: strict type checks, 53 unit/UI tests, 13 real PostgreSQL integration tests, production build, Docker startup, and the containerized 53+13 test run. Concurrency tests asserted all 100 distinct-user submissions succeeded and only one of 100 duplicate submissions succeeded.

Browser checks also verified keyboard selection and a 375px mobile layout. Docker validation used port 3001 rather than stopping the existing development servers. Only the two explicitly created browser test voters were cleaned up; existing database votes and volumes were preserved.

### Remaining limitations

Mock identity is not authentication; changing the header or browser storage creates another simulated user. The app has one seeded active poll, no administration UI, and HTTP polling rather than WebSockets. Overlapping-request tests are integrity evidence, not a production load benchmark. Commit history contains the actual initial commit; no synthetic iterative history was generated.

## Assignment wording correction

The user challenged the plan's "Do not add authentication, Redis, microservices, an ORM, a generic repository framework, a global state library, or WebSockets" paragraph and requested a review of the original assignment.

The original assignment does not impose those bans. It explicitly permits polling, WebSockets, or SSE, accepts a database of choice or concurrency-safe in-memory storage, and permits mock identity without requiring authentication. The plan now distinguishes these requirements from the chosen MVP architecture and the user's Tailwind/shadcn preferences. The original assignment and application architecture were not changed.

## Updated-plan verification

The user then requested: "please follow the updated plan". The implementation was checked against the revised plan; the wording correction did not require adding another technology or changing the selected architecture.

Type checks, all 53 unit/UI tests, all 13 real PostgreSQL integration tests, and the production build passed again. A fresh visible browser page verified answer selection and enabled submission, optimistic pending results and rollback with a one-shot mocked 500, and a real accepted vote arriving through a separate HTTP request followed by automatic refresh. The authoritative choice replaced the local selection, cleared the earlier rejection message, disabled duplicate submission, and survived reload.

Earlier attempts on the hidden browser page timed out during interaction; these were not counted as passing checks. Opening a visible validation page resolved the tooling limitation. The one disposable voter created for this follow-up was removed with parameterized SQL, the original browser identity was restored, and existing votes and development servers were preserved. No commit or push was made.

## Required Socket.IO implementation

The user explicitly requested: "where is the socket io it is a must". This adds a concrete technology requirement beyond the original assignment's choice of polling, WebSockets, or SSE.

Socket.IO server/client dependencies were added to their respective workspaces, and npm regenerated the single root lockfile. The API emits `poll:changed` with only `{ pollId }` after commit; each client fetches its own personalized snapshot. Rejected votes emit nothing. The UI subscribes after loading a poll, refreshes on connect/reconnect and changes, coalesces bursts, and preserves pending/confirmed vote state. It polls every two seconds only during disconnected/error recovery, with a 30-second safety read while connected. No state library, authentication system, or Redis dependency was needed.

The first notifier regression test failed because no notification callback was wired. New frontend tests failed because socket events did not yet drive refresh. Implementing the server/client and hook wiring made those tests pass.

Browser execution caught a genuine wiring bug that WebSocket-only integration tests missed: Socket.IO was attached before a separate Express request listener was added. Both listeners handled engine HTTP polling handshakes, leading to `ERR_HTTP_HEADERS_SENT` and a runtime crash. A new real HTTP-polling Socket.IO test reproduced the failure. Registering Express before attaching Socket.IO fixed it; both transports now pass.

Type checking also caught an incorrectly typed close callback in the test harness; the close promise now rejects shutdown errors rather than treating them as success.

Final validation: 68 unit/UI tests, 18 real PostgreSQL/socket integration tests, strict type checks, production build, Docker startup, and the same 68+18 suites in Docker passed. Socket integration tests verified two real clients, no personalized data in events, no events on rejection, 100 notifications for 100 concurrent committed votes, and reconnect read-back.

Browser checks captured an actual `poll:changed` WebSocket frame through the Vite proxy and verified the results changed. On the production Docker page, only Socket.IO requests were intercepted to simulate a transport outage; real HTTP/database voting continued and the two-second fallback updated results. Removing interception restored connected status. The mobile viewport remained free of horizontal overflow.

Runtime checks initially found no reachable development API. A development launch did not remain attached to its tool session; Docker was used for validation. Once a development API was listening on port 3000, Docker startup encountered a port conflict, so a temporary port-3001 override avoided stopping the active development server. Only the two explicitly created socket-validation voters were removed; existing votes and database data were preserved. The temporary Docker app and override are cleaned up after validation. No commits or pushes were made.

## Measured synchronized voting test

The user asked: "can you preform a testing for many users submit a vote for the exact same option at the exact same millisecond".

A new integration suite opens 100 independent TCP connections before releasing all vote bodies in a synchronous loop. It runs the actual Express API against real PostgreSQL in a unique test-owned schema, with simulated failures disabled. It measures monotonic client-release and server-body-completion timestamps rather than claiming network arrival is perfectly simultaneous.

The measured distinct-user run accepted and persisted all 100 votes for the same option. Body release spanned 7.990 ms, server body completion spanned 82.730 ms, and the largest one-millisecond bucket contained five requests. A second burst using one user accepted one vote and rejected 99 duplicates; direct SQL confirmed one stored row for that user. Missing identity was rejected without changing the saved count. All three tests passed with exit code 0.

This is real API/database evidence, not a browser simulation or an exact-same-millisecond arrival claim. The temporary server and test schema are cleaned up by the suite; ordinary application votes and volumes are untouched.
