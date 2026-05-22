# Tembo Agent Studio

> Status: **building v0.1** — empty-but-runnable skeleton is in place (Next.js web, Rust API, Postgres, better-auth). Real user stories land on top.

## What this is, in plain English

Imagine your team has a handful of "AI assistants" — one answers customer email, one triages support tickets, one drafts internal reports. Today, those assistants probably live inside some vendor's website. Someone with a login edits a prompt. Nobody is sure what changed, when, or why. When the assistant says something embarrassing, nobody can rewind it. When a new team wants their own assistant, you start from zero.

**Tembo Agent Studio (TAS) is the control room for those assistants.**

You run it inside your own walls. Your people log in with the same accounts they already use. The assistants themselves are described in plain files, stored in a Git repository **you own** — the same way you store the rest of your code. When someone wants to change how an assistant behaves, they describe it in chat. TAS turns that description into a pull request. Your team reviews the diff like any other change. When it's merged, the new behavior is live. When an end user clicks "this answer was wrong," that correction can become its own PR, too.

No black box. No console drift. No "what did this prompt look like last Tuesday?"

## The bigger idea

Most teams treat agents like toys: clever demos that live outside the rules. The ones that try to make agents serious usually do it by ripping up the rules — bypassing review, hiding edits, locking definitions inside vendor SaaS, and calling the result "magic."

We think that trade is unnecessary. Software engineering already solved most of these problems decades ago: version control, code review, audit logs, identity, role-based access. Agents don't need a parallel universe. They need to **inherit** the discipline you already use for production systems — and then go faster *because* of it, not in spite of it.

That belief shapes every part of the product:

1. **Git is the system of record.** Agent definitions live in a repository you own.
2. **Every change is reviewable.** Whether the author was an engineer in their editor, a PM in chat, or an end user clicking "correct this" — the artifact is a PR.
3. **Adaptation is allowed; drift is governed.** Agents are allowed to evolve. They are not allowed to evolve in ways you can't explain.
4. **Self-hostable first.** Identity, data, and runtime stay inside your environment.

## What gives it superpowers: the Tembo Coding Agent Platform

TAS is the control plane — identity, repos, runs, audits, policy. But the *magic* — reading an agent definition, understanding what someone wants changed in plain English, and writing a clean diff for it — that's the [Tembo Coding Agent Platform](https://tembo.io). TAS calls out to Tembo coding agents the way a CI system calls out to compilers.

The dependency is light in Phase 0.1 (you plug in a Tembo API key and runs work). It becomes the engine of the product as we go:

- **Phase 0.2 — chat to PR.** A Tembo coding agent reads the existing definition, the chat context, and the change request, then opens a targeted pull request.
- **Phase 0.5 — corrections to PR.** A Tembo coding agent turns end-user corrections into candidate PRs.
- **Phase 0.5 — variant proposals.** A Tembo coding agent helps detect divergence and propose a variant rather than silently averaging incompatible behaviors.
- **Phase 0.6 — Mycelium.** Patterns proven in one TAS deployment can flow — by explicit policy — to another, attribution and provenance preserved.

TAS keeps the work governed; Tembo makes the work possible. The two are designed together.

## How we're building it: six phases

TAS reaches users as one product. Internally, we're building it in six phases — a construction plan, not a release train. Each phase is a coherent slab of capability that the next one builds on; sequencing them this way is how we keep the floor trustworthy before we add the floors above it.

### [Phase 0.1 — Foundation](./context/0.1/) · *The trustworthy floor*

Build the floor first: a self-hosted deploy, identity through your IdP, a Git repo wired to a workspace, and a baseline agent that runs reliably with readable logs. Nothing flashy. Everything that follows depends on this layer being dependable, so this is where we resist the urge to demo authoring before runs are solid.

### [Phase 0.2 — Authoring velocity](./context/0.2/) · *Chat to PR*

Build the loop that lets a non-engineer change an agent without an engineering queue. They describe the change in chat; a Tembo coding agent reads the existing definition, produces a targeted diff, and opens a pull request. Reviewers approve or comment. On merge, the new behavior is live. The PR is the contract — even when the author wasn't human.

### [Phase 0.3 — Operational surface](./context/0.3/) · *Forms and dashboards*

Build the day-to-day surface that fast authoring demands. Rich human-in-the-loop forms (uploads, conditional fields, validation) so a reviewer can do real work, not just click "approve." Per-agent operational dashboards so when something misbehaves at 2am, the triage answer is one screen, not four hours of log spelunking.

### [Phase 0.4 — Governance depth](./context/0.4/) · *Audit and access*

Build the controls organizations need to scale usage from one team to many. An immutable `who/when/why` changelog records every change, run, human action, and policy switch — chat sessions, PRs, corrections, and overrides all resolve into the same timeline. Role-based access and org-level policy templates let large orgs draw boundaries that workspaces inherit. The bar is one screen, not four days of spelunking, to answer "who changed this, when, and why?" Governance lands *before* adaptive loops so the loop can't outrun the audit trail.

### [Phase 0.5 — Adaptive intelligence](./context/0.5/) · *Corrections and variants*

Build the closed loop inside a single TAS deployment. When an end user corrects an output, TAS bundles the original, the correction, and the run context, and a coding agent proposes a targeted PR. When two teams want incompatible behaviors, TAS proposes a **variant** rather than silently averaging. Every adaptive change is still a PR. Adaptation is allowed; drift is governed.

### [Phase 0.6 — Mycelium](./context/0.6/) · *Cross-deployment learning, by policy*

Build the optional inter-deployment substrate. Tembo Mycelium lets TAS instances exchange patterns — never raw data — under explicit policy: island, share patterns only, share + receive, or receive only. Bilateral or group-policy, never a public marketplace. Attribution and provenance travel with every pattern, and every import lands in the same v0.4 changelog as any other change. The default is island; opting in is a deliberate org-admin action.

## Where to read more

- [`context/README.md`](./context/README.md) — strategy overview and phase index
- [`context/0.1/`](./context/0.1/) — Foundation (deploy, auth, connect, run)
- [`context/0.2/`](./context/0.2/) — Authoring velocity (chat → PR)
- [`context/0.3/`](./context/0.3/) — Operational surface (HITL forms, dashboards)
- [`context/0.4/`](./context/0.4/) — Governance depth (audit log, RBAC, policy)
- [`context/0.5/`](./context/0.5/) — Adaptive intelligence (corrections, variants)
- [`context/0.6/`](./context/0.6/) — Mycelium (cross-deployment shared learning)

Each phase folder contains a PRFAQ-style `README.md`, a `BLOG_POST.md` external announcement draft, a `USER_STORIES.md`, and a `DEMO_SCRIPT.md`.

## Repository layout

```
agent-studio/
├── web/        Next.js 16 + Tailwind v4 + shadcn/ui + better-auth (control plane UI)
├── api/        Rust (axum + sqlx) — runtime + orchestration, owns Postgres migrations
├── agents/     Seed Pydantic AI `AgentSpec` fixtures (see context/0.1/AGENT_FORMAT.md)
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

Database migrations live in `api/migrations/` and are applied by the Rust API on boot via `sqlx::migrate!()`. The first migration (`0001_better_auth.sql`) creates the `user`, `session`, `account`, and `verification` tables that better-auth expects.

### Developing without Docker

```bash
# Postgres only via Docker, app code on host
docker compose up -d postgres

# Terminal 1 — API
cd api && cargo run

# Terminal 2 — web
cd web && pnpm install && pnpm dev
```
