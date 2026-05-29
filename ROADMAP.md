# Roadmap

Tembo Agent Studio reaches users as one product. Internally, we build it in
six phases — a construction plan, not a release train. Each phase is a
coherent slab of capability the next one builds on; sequencing them this
way is how we keep the floor trustworthy before we add the floors above
it.

Each phase folder under [`context/`](./context/) contains a PRFAQ-style
`README.md`, a `BLOG_POST.md` external announcement draft, a
`USER_STORIES.md`, and a `DEMO_SCRIPT.md`. The repo's
[`CHANGELOG.md`](./CHANGELOG.md) tracks what has actually shipped.

## [Phase 0.1 — Foundation](./context/shipped/0.1/) · *The trustworthy floor*

> **Shipped May 2026.**

Build the floor first: a self-hosted deploy, identity through your IdP, a
Git repo wired to a workspace, and a baseline agent that runs reliably with
readable logs. Nothing flashy. Everything that follows depends on this
layer being dependable, so this is where we resist the urge to demo
authoring before runs are solid.

## [Phase 0.2 — Authoring velocity](./context/shipped/0.2/) · *Chat to PR*

> **Shipped May 2026.** See [`CHANGELOG.md`](./CHANGELOG.md) for the
> full list of what landed.

Build the loop that lets a non-engineer change an agent without an
engineering queue. They describe the change in chat; a Tembo coding agent
reads the existing definition, produces a targeted diff, and opens a pull
request. Reviewers approve or comment. On merge, the new behavior is live.
The PR is the contract — even when the author wasn't human.

## [Phase 0.3 — Operational surface](./context/shipped/0.3/) · *Forms and dashboards*

> **Shipped May 2026.** See [`CHANGELOG.md`](./CHANGELOG.md) for the
> full list of what landed.

Build the day-to-day surface that fast authoring demands. Per-agent
operational dashboards so when something misbehaves at 2am, the triage
answer is one screen, not four hours of log spelunking. The
human-in-the-loop forms slice of v0.3 anchored on a substrate
larger than the phase could absorb and moved to v0.4 — see the
"Deferred from the v0.3 plan" section in the phase
[`README.md`](./context/shipped/0.3/) for the full set of carve-outs.

## [Phase 0.4 — Governance depth](./context/shipped/0.4/) · *Audit and access*

Build the controls organizations need to scale usage from one team to
many. An immutable `who/when/why` changelog records every change, run,
human action, and policy switch — chat sessions, PRs, corrections, and
overrides all resolve into the same timeline. Role-based access and
org-level policy templates let large orgs draw boundaries that workspaces
inherit. The bar is one screen, not four days of spelunking, to answer
"who changed this, when, and why?" Governance lands *before* adaptive
loops so the loop can't outrun the audit trail.

## [Phase 0.5 — Adaptive intelligence](./context/0.5/) · *Corrections and variants*

Build the closed loop inside a single TAS deployment. When an end user
corrects an output, TAS bundles the original, the correction, and the run
context, and a coding agent proposes a targeted PR. When two teams want
incompatible behaviors, TAS proposes a **variant** rather than silently
averaging. Every adaptive change is still a PR. Adaptation is allowed;
drift is governed.

## [Phase 0.6 — Mycelium](./context/0.6/) · *Cross-deployment learning, by policy*

Build the optional inter-deployment substrate. Tembo Mycelium lets TAS
instances exchange patterns — never raw data — under explicit policy:
island, share patterns only, share + receive, or receive only. Bilateral
or group-policy, never a public marketplace. Attribution and provenance
travel with every pattern, and every import lands in the same v0.4
changelog as any other change. The default is island; opting in is a
deliberate org-admin action.

## Phase index

| Phase | Theme | Docs |
| ----- | ----- | ---- |
| 0.1 | Foundation (shipped) | [`context/shipped/0.1/`](./context/shipped/0.1/) |
| 0.2 | Authoring velocity (shipped) | [`context/shipped/0.2/`](./context/shipped/0.2/) |
| 0.3 | Operational surface (shipped) | [`context/shipped/0.3/`](./context/shipped/0.3/) |
| 0.4 | Governance depth (shipped) | [`context/shipped/0.4/`](./context/shipped/0.4/) |
| 0.5 | Adaptive intelligence (planned) | [`context/0.5/`](./context/0.5/) |
| 0.6 | Mycelium (planned) | [`context/0.6/`](./context/0.6/) |
| —   | Backlog (unscheduled, no milestone) | [`context/backlog/`](./context/backlog/) |

Shipped phase folders moved under [`context/shipped/`](./context/shipped/) — see [`context/README.md`](./context/README.md) for the convention.

See [`context/README.md`](./context/README.md) for the strategy overview.
