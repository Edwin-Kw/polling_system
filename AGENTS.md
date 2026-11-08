# Repository Agent Rules

## Role and context

Act as a full-stack engineer building a usable polling product. Read the [assignment](./P&T%20High-Concurrency%20Polling%20System%20-%20Coding%20assignment.md), [plan](./plan.md), and relevant existing implementations before changing behavior. Inspect related callers and tests, not just the selected line.

## Stack and boundaries

- Frontend: React, TypeScript, Vite, Tailwind CSS, and shadcn/ui.
- Backend: Node.js, Express, PostgreSQL with `pg`, and Zod validation.
- State: React hooks and pure state helpers; do not introduce Zustand or another global state library without approval.
- Workspaces: `apps/web`, `apps/api`, and `packages/shared`, with one root npm lockfile.
- Keep shared transport types and pure calculations in `packages/shared`; never export database configuration to the browser.
- Keep HTTP startup separate from injectable app construction. Put database operations in the API workspace.

## Product UI

- Show only content that helps users view polls, vote, understand results, or recover from an error.
- Never display interview notes, technology lists, setup milestones, implementation roadmaps, or agent commentary in the application. Keep those in repository documentation.
- Never invent polls, counts, successful submissions, or connection status. Surface unavailable features and failed requests honestly.
- Reuse shadcn primitives from `apps/web/src/components/ui`; compose product components outside that folder.
- Use Tailwind utilities and semantic theme tokens from `apps/web/src/styles.css`. Do not hardcode colors, spacing, or inline presentation styles in components.
- Keep presentation components independent of fetch calls. Preserve labels, keyboard navigation, focus indicators, and accessible loading/error announcements.

## Correctness and testability

- Keep strict TypeScript types. Do not introduce `any` or casts that bypass validation.
- Validate HTTP inputs with Zod; use parameterized SQL.
- Enforce one vote per user per poll through database constraints, not frontend checks or process-local locks.
- Never implement vote counts with a JavaScript read-modify-write cycle.
- Keep confirmed results separate from optimistic pending votes. Roll back only the pending overlay; reject stale responses and reconcile uncertain submissions before retry.
- Inject network/database dependencies and randomness for deterministic unit tests. Use real PostgreSQL for concurrency claims.
- Log unexpected server failures and show contextual user errors. Do not swallow failures or substitute fake success.
- Make focused changes, preserve unrelated worktree edits, and update directly related tests and documentation.

## Dependencies and generated files

- Install, remove, or update task-relevant npm packages without asking for separate approval. Prefer existing dependencies and compatible versions; avoid unrelated upgrades.
- Add or adjust npm scripts and workspace manifests as needed for implementation, development, builds, and tests without separate approval.
- Regenerate `package-lock.json` with npm when dependencies change; do not hand-edit it.
- Use the shadcn CLI to add UI primitives; do not create parallel copies of existing helpers/components.
- Never commit `.env`, credentials, dependencies, build outputs, or database data.
- Do not modify the original assignment, remove persistent database volumes, or rewrite Git history without explicit approval.
- Make logical commits only when requested; never fabricate incremental development history.

## Routine tool permissions

- Run task-relevant npm commands, including install, ci, exec, dev, build, typecheck, and tests, without asking for separate approval. Inspect unfamiliar scripts before executing them.
- Start local development or preview servers and use browser tools to open the local application, inspect it, take screenshots, and exercise UI flows without separate approval.
- Browser tests may create disposable test data and intercept requests for deterministic validation. Clearly distinguish mocked evidence from real integration results.
- Reuse shared browser pages where appropriate. Do not interact with unrelated tabs, accounts, or external services without authorization.
- Stop temporary validation servers afterward. Leave a server running only when it is needed for the user's ongoing use, and report its URL.
- Ask before destructive actions affecting persistent data, production deployments, publishing packages, or major changes to the agreed architecture.
- These rules express repository-level consent; they do not override VS Code, browser-sharing, or tool-runtime approval requirements.

## Verification

Run the smallest relevant tests while working, then these checks for code/dependency changes:

```powershell
npm run typecheck
npm test
npm run build
```

For database changes, also run `npm run test:integration` against real PostgreSQL. For container changes, verify `docker compose up --build` and `docker compose --profile test run --build --rm test`.

There is no `npm run lint` script; do not claim lint passed. Report missing Docker/database prerequisites explicitly rather than skipping tests silently. Verify user-visible UI changes in a browser when available. Do not claim the assignment is complete before critical concurrency and optimistic rollback tests pass.

See [README](./README.md) for runtime commands and [deliverables](./DELIVERABLES.md) for handoff requirements. Record actual AI prompts and observed fixes in [AGENT_WORKFLOW.md](./AGENT_WORKFLOW.md).
