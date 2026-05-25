# Tembo Agent Studio

> Self-hosted control room for AI agents. Definitions live in Git, every
> change is a PR, runs and audits stay inside your environment.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

## Overview

Tembo Agent Studio (TAS) is a self-hosted control plane for AI agents.
Agent definitions live as files in a Git repository you own. Every change
— whether an engineer typed it, a PM described it in chat, or an end user
clicked "this is wrong" — flows through the same PR review your team
already uses for code. Runs, audit logs, and identity stay inside your
environment.

Agents are software. Most teams treat them as something else: prompts
edited in vendor consoles, no diff, no review, no rewind. TAS lets agents
inherit the discipline you already use for production code — version
control, code review, audit logs, identity, RBAC.

**Principles**

- **Git is the system of record.** Agent definitions live in your repo.
- **Every change is a PR.** Human or AI author — the artifact is always a
  reviewable diff.
- **Adaptation is allowed; drift is governed.** Agents may evolve; they
  may not evolve in ways you can't explain.
- **Self-hostable first.** Identity, data, and runtime stay inside your
  environment.

## Tembo integration

TAS is the control plane — identity, repos, runs, audits, policy. The
authoring side — reading an agent definition, understanding what someone
wants changed in plain English, writing a clean diff — is delegated to the
[Tembo Coding Agent Platform](https://tembo.io). Plug in a Tembo API key
in workspace settings and TAS can:

- Generate a new agent from a chat description.
- Take an "improve the agent" submission and open a targeted PR.
- (Later phases) turn end-user corrections into candidate PRs, and
  propose variants when two teams want incompatible behavior.

TAS keeps the work governed; Tembo's coding agents do the diff writing.
The two are designed together but the integration boundary is clean — TAS
calls out to Tembo coding agents the way a CI system calls out to
compilers.

## Current state

Today (v0.2, in progress on top of the v0.1 foundation shipped in May
2026) you can:

- Self-host the whole stack via `docker compose up`.
- Sign in with Google and connect a GitHub repository as the workspace's
  source of truth.
- List, create, edit (via chat-to-PR), and run agents in two frameworks —
  Pydantic AgentSpec and Cargo AI. Both run as passthrough subprocess
  calls into the upstream tool, so you get the full power of each.
- Chat with an agent to probe its behavior, then submit a change request
  that opens a PR via Tembo.
- Submit "Improve the Agent" feedback from any run — TAS hands it to
  Tembo, opens a PR, and correlates the merged PR back to your submission
  so you can see the status from the dashboard.
- Schedule agents to run on a cron via **Automations**, with each
  scheduled run linked back to the automation that fired it.
- Inspect token usage and approximate cost on every run.

See [`CHANGELOG.md`](./CHANGELOG.md) for the full list of what's landed,
and [`ROADMAP.md`](./ROADMAP.md) for where it's headed.

## Repository layout

```
agent-studio/
├── web/        Next.js 16 + Tailwind v4 + shadcn/ui + better-auth (control plane UI)
├── api/        Rust (axum + sqlx) — runtime + orchestration, owns Postgres migrations
├── agents/     Seed agent fixtures (see context/0.1/AGENT_FORMAT.md)
├── context/    Phase docs (PRFAQ, blog, user stories, demo script per phase)
└── docker-compose.yml
```

## Running locally

Requires Docker (or OrbStack), Node 22+, and Rust 1.93+.

```bash
cp .env.example .env
# Required: set BETTER_AUTH_SECRET. Generate one with:
#   openssl rand -base64 32
docker compose up --build
```

Once healthy:

- Web: http://localhost:3000
- API: http://localhost:8080/health
- Postgres: localhost:5432 (user/db: `tas`, password from `.env`)

Database migrations live in `api/migrations/` and are applied by the Rust
API on boot via `sqlx::migrate!()`. The first migration
(`0001_better_auth.sql`) creates the `user`, `session`, `account`, and
`verification` tables that better-auth expects.

### Developing without Docker

```bash
# Postgres only via Docker, app code on host
docker compose up -d postgres

# Terminal 1 — API
cd api && cargo run

# Terminal 2 — web
cd web && pnpm install && pnpm dev
```

## License

[MIT](./LICENSE) — see `LICENSE` for the full text.
