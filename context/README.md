# Context

Versioned planning artifacts for Tembo Agent Studio (TAS). Each phase folder is a complete launch package.

## Why Phases, Not a Single v1

Agent platforms typically fail in one of two ways:

1. They ship a flashy authoring experience on top of an unreliable runtime, then collapse the first time governance is needed.
2. They ship a "platform" with no concrete user value, hoping enterprise checklists translate into adoption.

TAS rejects both. Each phase delivers an independently useful product:

- **v0.1 (Foundation)** is the smallest deployable surface that proves identity, repo wiring, and a real run. A team can stop here and still get value.
- **v0.2 (Authoring)** adds the productivity story — chat-to-PR — on top of that proven foundation.
- **v0.3 (Operational surface)** adds the day-to-day operator experience: rich HITL forms and per-agent dashboards so reviewing work and triaging failures are first-class flows.
- **v0.4 (Governance depth)** layers in the controls organizations need to scale usage from one team to many: an immutable audit log of every change, run, and human action, plus RBAC and org-level policy templates. Governance lands *before* adaptive loops so the loop can't outrun the audit trail.
- **v0.5 (Adaptive)** closes the loop from user corrections back into source, with variants to manage divergence — inside a single TAS deployment.
- **v0.6 (Mycelium)** extends the loop across deployments: optional, policy-governed pattern exchange between TAS instances, with attribution and provenance preserved.

Each phase has an exit bar and a set of open questions the next phase must answer.

## Phase Index

| Phase | Folder | Theme |
| ----- | ------ | ----- |
| 0.1 | [`0.1/`](./0.1/) | Foundation |
| 0.2 | [`0.2/`](./0.2/) | Authoring velocity |
| 0.3 | [`0.3/`](./0.3/) | Operational surface (HITL, dashboards) |
| 0.4 | [`0.4/`](./0.4/) | Governance depth (audit log, RBAC) |
| 0.5 | [`0.5/`](./0.5/) | Adaptive intelligence |
| 0.6 | [`0.6/`](./0.6/) | Mycelium (cross-deployment learning) |
| —   | [`backlog/`](./backlog/) | Unscheduled — designed but no milestone yet |

## Folder Conventions

Each numbered phase contains:

- `README.md` — PRFAQ-style launch doc: problem, solution, customer quote, FAQ, exit bar.
- `BLOG_POST.md` — draft of the public announcement.
- `USER_STORIES.md` — Connextra-format stories with acceptance criteria.
- `DEMO_SCRIPT.md` — minute-by-minute demo flow with narration cues.

The `backlog/` folder is leaner — just `README.md` (what goes here vs an in-phase Deferred section) and `USER_STORIES.md` (the stories themselves with provenance lines). Entries graduate into a numbered phase's `USER_STORIES.md` when scheduled.

## How to Use These Docs

- **Product reviews:** read the phase `README.md` first, then `USER_STORIES.md`.
- **Engineering planning:** stories + open questions in the phase `README.md` drive backlog grooming.
- **Sales/marketing:** start from `BLOG_POST.md`, then borrow scenarios from `DEMO_SCRIPT.md`.
- **Internal alignment:** the operating principles in the root `README.md` are the tiebreakers when scope debate breaks out.
