# Agent-assisted workflow

## Scope so far

This document records repository setup and subsequent UI foundation refinements. It is not a claim that the full assignment is complete.

## Tools and prompt strategy

The user asked an AI assistant using Copilot SDK in VS Code to convert the assignment PDF, prepare a repository plan, and then set up the approved React/Node.js/PostgreSQL/Docker stack.

The setup request was: "the stack is good, help me setup first".

Work was bounded to scaffolding, shared types, database readiness, runtime packaging, and test foundations. Voting behavior remains a separate slice. The original assignment and plan were retained as context.

## Decisions audited during setup

- The machine has Node.js 22.20, while the planned Docker runtime is Node.js 24. Native TypeScript execution works on the supported Node.js versions, so an extra `tsx` dependency is unnecessary.
- The newest inspected `jsdom` release requires a newer Node.js patch than the host provides. The scaffold uses the compatible 26.x line rather than installing a known incompatible version.
- Docker Desktop was not found. Database readiness failures are surfaced as HTTP 503 and visible UI errors; no in-memory database or fake success was substituted.
- Backend app construction is separate from server startup. Unit tests inject database checks; a separate integration test requires real PostgreSQL.

## Pending implementation notes

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

The current product screen shows connection loading, actionable failure/retry, or voting-unavailable state. It does not claim that database health implies an active poll, fabricate votes, or implement a pretend submission flow. Poll persistence and voting remain pending.

Validation after this refinement: type checks, all 14 unit/UI tests, and the production build passed. Browser checks verified the real connection-error state, keyboard activation of retry, and a 375px mobile viewport without horizontal overflow. A controlled health response verified the voting-unavailable state without poll data; this was UI testing, not proof of a live PostgreSQL connection. Tailwind styles were confirmed through computed background and card radius. The temporary preview server was stopped afterward.
