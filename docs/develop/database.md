# Development database — PostgreSQL 16, two independent paths

`DATABASE_URL` is the **only** database interface this repository knows (plan §4.1).
No script, test, Makefile or npm task may invoke `docker` as a prerequisite for
development. CI provisions Postgres as a service container, independent of any
local daemon.

## The two paths

| Path | How | When to use |
|---|---|---|
| **A — Docker** | `docker compose --env-file .env.local -f docker-compose.dev.yml up -d db` → `postgres:16-alpine`, bound to `127.0.0.1:5432` only, password from `.env.local` (no default), named volume `dosrevival-pgdata` | **The default on this machine as of 20.08.2026** (Docker engine recovered; Q13 resolved). Closest to CI. |
| **B — Native or hosted** | A native Windows/WSL2 PostgreSQL 16 install, or a hosted dev instance (managed free tier). Configuration is *only* `DATABASE_URL` in `.env.local` / `packages/server/.env` | Fallback whenever Docker is unavailable. If hosted: fixture data only, never personal data (feeds Q3). |

## Setup

1. Copy `.env.example` → `.env.local`; set a strong `POSTGRES_PASSWORD` and the
   matching `DATABASE_URL`.
2. Create `packages/server/.env` containing the same `DATABASE_URL` (the Prisma CLI
   reads it from there). Both files are gitignored — secrets never enter the repo
   (plan §8.8); `DATABASE_URL` is a secret.
3. Path A only: `docker compose --env-file .env.local -f docker-compose.dev.yml up -d db`,
   wait for the healthcheck (`pg_isready`). Path B: skip — just point `DATABASE_URL`
   at your instance.
4. Generate the Prisma client **before anything imports it**: `npx prisma generate`
   from `packages/server/`. This step is not optional on a fresh clone —
   `scripts/db/check.ts` imports the generated client, which is gitignored, so
   running the check first fails with `ERR_MODULE_NOT_FOUND` rather than a
   connection error. (`prisma migrate dev` also generates, so step 5 covers it too;
   this step exists so the *verify* step below never runs against nothing.)
5. Migrations: `npx prisma migrate dev` from `packages/server/` (at M0 the schema is
   datasource + generator only, so this reports "already in sync"; the first real
   migrations land in M3a).
6. Verify: `npx tsx scripts/db/check.ts` from the repository root — prints the server
   version, fails loudly below PostgreSQL 16, and reports which path is in use.

## Prisma 7 layout note

Prisma 7 removed `url = env(...)` from `schema.prisma`. The connection now lives in
two places, both fed by the same `DATABASE_URL`:

- **CLI (migrate/generate):** `packages/server/prisma.config.ts` reads `DATABASE_URL`
  (auto-loading `packages/server/.env` via Node's `process.loadEnvFile`).
- **Runtime:** `PrismaClient` takes a driver adapter — `@prisma/adapter-pg` with
  `connectionString: DATABASE_URL` (see `scripts/db/check.ts` for the pattern).

The generated client lands in `packages/server/src/generated/prisma/` (gitignored;
regenerate with `npx prisma generate` from `packages/server/`).

## Hard rules

- The dev container binds `127.0.0.1` only and requires a password — the legacy
  unauthenticated `mongo:3.2` published to the host (`legacy/docker-compose.yml`)
  is the documented anti-pattern this setup must never reproduce (N17).
- This compose file is never a production topology; production hardening is
  WU-M4-12 (SCRAM, TLS, least-privilege roles, no published port).
