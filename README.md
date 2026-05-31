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

TAS is the control plane. Authoring — turning a chat message into a
diff — is delegated to the [Tembo Coding Agent Platform](https://tembo.io).
Plug in a Tembo API key in workspace settings and TAS uses it to open
PRs against your repo: new agents from chat, and "improve the agent"
submissions from any run.

TAS calls out to Tembo coding agents the way a CI system calls out to
compilers.

## Current state

Today you can:

- Self-host the whole stack via `docker compose up`, or deploy the
  web tier on Vercel and the api tier on a long-lived host — see
  [`guides/VERCEL_DEPLOY.md`](./guides/VERCEL_DEPLOY.md).
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
- Schedule agents to run on a cron via **Automations**, or fire them from
  external events via Composio-backed **Triggers** (Gmail messages, Slack
  mentions, GitHub PR events, ~1,000 toolkits).
- Authorize external services per-user (Slack, Gmail, Google Sheets,
  Notion, GitHub, …) and reference them by named slot from an agent's
  `connections:` field.
- Read a per-agent operational dashboard (30-day health, success rate,
  spend, failure groups) and a workspace-wide dashboard that rolls up
  the same shape across all agents.
- Inspect every change with the **Audit** timeline — append-only,
  filterable by source / actor / agent / time, exportable as JSON.
- Manage workspace members with three roles (workspace_admin / operator
  / viewer) enforced at the API layer.

See [`CHANGELOG.md`](./CHANGELOG.md) for the full list of what's landed,
and [`ROADMAP.md`](./ROADMAP.md) for where it's headed.

## Guides

- [`guides/VERCEL_DEPLOY.md`](./guides/VERCEL_DEPLOY.md) — deploy the web
  tier on Vercel with the api on Fly/Render and managed Postgres.

## Repository layout

```
agent-studio/
├── web/        Next.js 16 + Tailwind v4 + shadcn/ui + better-auth (control plane UI)
├── api/        Rust (axum + sqlx) — runtime + orchestration, owns Postgres migrations
├── agents/     Seed agent fixtures (see context/shipped/0.1/AGENT_FORMAT.md)
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

### Running from published images (no source build)

For a deploy that pulls prebuilt images from GHCR instead of compiling
from source, use `compose.release.yaml`:

```bash
cp .env.example .env
# Set BETTER_AUTH_SECRET, TAS_ENCRYPTION_KEY, INTERNAL_API_TOKEN.
# Pin a release with TAS_VERSION (defaults to the current version).
docker compose -f compose.release.yaml pull
docker compose -f compose.release.yaml up -d
```

Images (`ghcr.io/tembo/tas-api`, `ghcr.io/tembo/tas-web`) are published
per release tag by `.github/workflows/release.yml`. Upgrading is `bump
TAS_VERSION → pull → up -d`; the API applies any new migrations on boot.

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
