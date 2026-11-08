# High-Concurrency Polling System

A polling application built with React, TypeScript, Tailwind CSS, shadcn/ui, Node.js, Express, and PostgreSQL.

## Status

The repository currently provides the frontend shell, database health endpoint, shared API types, tests, and Docker configuration.

Voting, poll storage, duplicate-vote prevention, optimistic updates, and live results are not implemented yet.

## Quick start

Requires Docker Desktop with Linux containers and Docker Compose.

```powershell
docker compose up --build
```

Open **http://localhost:3000**.

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

Copy the environment template only if `.env` does not already exist. Do not commit real credentials.

- Frontend: **http://127.0.0.1:5173**
- API health: **http://127.0.0.1:3000/api/health**
- PostgreSQL: **127.0.0.1:5433**

Vite proxies `/api` to port 3000. Keep the default API port for local development. Restart the development servers after changing shared-package source to rebuild its exports.

## Validation

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

Type checks, 14 unit/frontend tests, and the production build have passed. Docker execution and real PostgreSQL integration remain unverified; the current tests do not establish concurrency or optimistic rollback guarantees.

## Structure

```text
apps/web         React UI and frontend tests
apps/api         Express API and backend tests
packages/shared  API types and runtime response validation
```

UI primitives live in `apps/web/src/components/ui`. Product components compose these primitives, using Tailwind utilities and semantic theme tokens. Backend app construction is separate from server startup to support dependency-injected tests.

See [AGENTS.md](./AGENTS.md) for repository conventions.
