# AI-Assisted Development Workflow

## Tools and prompt strategy

I used GitHub Copilot in VS Code to help plan, implement, test, and refine the polling application.

I divided the work into focused stages: project setup, PostgreSQL storage, API validation, optimistic voting, Socket.IO updates, UI styling, and concurrency testing. I supplied the assignment and existing plan as context, then clarified requirements when the generated approach differed from my expectations.

My prompts emphasized important invariants: database-enforced duplicate prevention, no JavaScript read-modify-write counters, honest error reporting, and separation of confirmed results from pending votes. Later requests addressed specific improvements, including mandatory Socket.IO, matching the reference image, and reusing API paths and server settings.

## Bugs, Architectural Flaws, and Edge Cases Audited

I used AI assistance for implementation, debugging, and testing. I guided requirements and challenged incorrect assumptions, while several technical defects were discovered through tests and browser checks performed by the assistant. I did not independently discover or manually code every fix.

### Issues I challenged directly

- **Incorrect assignment interpretation:** The AI initially presented architecture choices as assignment restrictions. I requested a review of the original assignment, and the plan was corrected.
- **Missing requested functionality:** I explicitly requested Socket.IO, reference-image styling, and a working active-poll dropdown. These were follow-up requirements, not defects in the original assignment.
- **Repeated configuration:** I noticed repeated API paths and server addresses and requested shared definitions to make them easier to maintain.

### Issues found during AI-assisted validation

- **Socket.IO handler conflict:** Browser validation exposed duplicate handling of HTTP polling requests, causing `ERR_HTTP_HEADERS_SENT`. The assistant corrected the handler attachment order and added a regression test.
- **Stale error messages:** A regression test revealed that an earlier rejection remained visible after the server confirmed a vote from another tab. The assistant updated the state handling to clear obsolete errors.
- **Incorrect frontend build mode:** During configuration refactoring, the build output revealed that loading backend environment settings through Vite selected development-mode frontend code. The assistant revised environment loading and added a regression test.

### Edge cases verified

Tests covered duplicate concurrent submissions, optimistic rollback, uncertain network outcomes, stale responses, and poll-switching state isolation.

The synchronized test verified 100 saved votes from 100 distinct users. It did not achieve or claim exact-same-millisecond arrival; actual timing was measured and reported.

My contribution was directing the work, questioning assumptions, and reviewing the explanations and evidence. Implementation and corrections remained AI-assisted.