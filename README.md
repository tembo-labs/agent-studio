# Tembo Agent Studio

> Self-hosted control room for AI agents. Definitions live in Git, every
> change is a PR, runs and audits stay inside your environment.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

## Overview

Imagine your team has a handful of "AI assistants" — one answers customer
email, one triages support tickets, one drafts internal reports. Today,
those assistants probably live inside some vendor's website. Someone with a
login edits a prompt. Nobody is sure what changed, when, or why. When the
assistant says something embarrassing, nobody can rewind it. When a new
team wants their own assistant, you start from zero.

**Tembo Agent Studio (TAS) is the control room for those assistants.**

You run it inside your own walls. Your people log in with the same accounts
they already use. The assistants themselves are described in plain files,
stored in a Git repository **you own** — the same way you store the rest
of your code. When someone wants to change how an assistant behaves, they
describe it in chat. TAS turns that description into a pull request. Your
team reviews the diff like any other change. When it's merged, the new
behavior is live. When an end user clicks "this answer was wrong," that
correction can become its own PR, too.

No black box. No console drift. No "what did this prompt look like last
Tuesday?"

## Vision

Most teams treat agents like toys: clever demos that live outside the
rules. The ones that try to make agents serious usually do it by ripping
up the rules — bypassing review, hiding edits, locking definitions inside
vendor SaaS, and calling the result "magic."

We think that trade is unnecessary. Software engineering already solved
most of these problems decades ago: version control, code review, audit
logs, identity, role-based access. Agents don't need a parallel universe.
They need to **inherit** the discipline you already use for production
systems — and then go faster *because* of it, not in spite of it.

That belief shapes every part of the product:

1. **Git is the system of record.** Agent definitions live in a repository
   you own.
2. **Every change is reviewable.** Whether the author was an engineer in
   their editor, a PM in chat, or an end user clicking "correct this" —
   the artifact is a PR.
3. **Adaptation is allowed; drift is governed.** Agents are allowed to
   evolve. They are not allowed to evolve in ways you can't explain.
4. **Self-hostable first.** Identity, data, and runtime stay inside your
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
