# Tembo Agent Studio — repo guide

This file is the entry point for coding agents working on TAS itself.
Subdirectories may carry their own `AGENTS.md` that extends this one;
read both when editing files inside that subdir.

## Stack

Monorepo, three runtime pieces, all started by `docker-compose.yml`:

- `web/` — Next.js 16 (App Router, Turbopack) + Tailwind v4 + better-auth.
  Package manager is **pnpm**. See [`web/AGENTS.md`](./web/AGENTS.md).
- `api/` — Rust + axum + sqlx, owns Postgres migrations and the runner.
  See [`api/AGENTS.md`](./api/AGENTS.md).
- `postgres` — single database shared by web and api.

`agents/` holds seed agent fixtures. `context/` holds phase docs (PRFAQ,
user stories, demo scripts per phase). The product user manual lives in
`docs/` (Astro Starlight, published to GitHub Pages) — see
[`docs/README.md`](./docs/README.md).

## Commands

```bash
# Boot everything (postgres + api + web). Idempotent.
docker compose up --build

# Web only — host pnpm against the docker postgres.
docker compose up -d postgres
cd web && pnpm install && pnpm dev

# API only — host cargo against the docker postgres.
docker compose up -d postgres
cd api && cargo run
```

Once healthy: web at `http://localhost:3000`, api at
`http://localhost:8080/health`.

## Database migrations

Postgres migrations live in `api/migrations/` as numbered `.sql`
files. The Rust API runs them at boot via `sqlx::migrate!()`.

- **Never edit a migration that has already been applied to any
  environment.** Add a new numbered file instead. Editing in place
  silently drifts schemas across deployments.
- **Additive by default.** Use `ALTER TABLE … ADD COLUMN IF NOT
  EXISTS` with a `DEFAULT` (or `NOT NULL DEFAULT`) so existing rows
  keep working without a backfill.
- **Renames need both a column and the readers.** When renaming, ship
  the migration + the TS/Rust callers in the same PR.

## Commit style

Conventional commits with the current phase tag — match the existing
history:

```
feat(v0.2): chat-to-edit thread per agent + broader PR scan
fix(v0.2): cargo-ai extractor — keep continuation lines + drop stderr footer
refactor(v0.2): rename feedback → improvement everywhere
docs(readme): merge Overview + Vision into one tighter section
```

The phase tag is whatever phase is in flight per
[`ROADMAP.md`](./ROADMAP.md). Drop the tag for non-product changes
(docs-only, tooling).

## What to leave alone

- `node_modules/`, `target/`, `.next/`, `dist/` — build outputs.
- Applied migrations in `api/migrations/` (see above).
- `pnpm-lock.yaml` and `Cargo.lock` — never hand-edit; let the tools
  regenerate.

## Conventions that apply repo-wide

- **Don't add features beyond what the task requires.** Three similar
  lines is fine; premature abstractions aren't.
- **Don't write comments that just restate the code.** Comments
  exist for the *why* — non-obvious constraints, surprising
  invariants, workarounds for specific bugs.
- **Don't add backwards-compat shims for code you're authoring in the
  same PR.** Internal callers can change in lockstep.
- **No `--no-verify`** and no skipping hooks on commit. If a hook
  fails, fix the underlying issue.
- **Don't estimate how long tasks will take.** No "half a day,"
  "~hour," "multi-day" framing when proposing work. Describe the
  shape and scope of a task (what changes, what depends on what)
  and let the human decide whether to take it on.
