# Tembo Agent Studio (TAS)

> Status: **pre-v0.1**. Planning and definition phase.

Tembo Agent Studio is a self-hosted control plane for teams that want to operate real agents — not toys — without sacrificing the software discipline they already rely on (Git, PRs, audits, RBAC).

The product ships in four phases. Each phase is a complete release with its own user value, not a checkpoint toward a distant launch.

| Phase | Theme | One-line outcome |
| ----- | ----- | ---------------- |
| **0.1** | Foundation | Deploy TAS, sign in via your IdP, connect Git + Tembo, run an agent. |
| **0.2** | Authoring velocity | Create and edit agents from chat; output is a reviewable PR. |
| **0.3** | Governance depth | Immutable `who/when/why` audit, rich HITL forms, per-agent ops surfaces. |
| **0.4** | Adaptive intelligence | Corrections become PRs; variants manage divergence; optional Mycelium. |

## Operating Principles

1. **Git is the system of record.** Agent definitions live in a repository the customer owns.
2. **Every change is reviewable.** Even chat-authored and correction-driven edits ship as PRs.
3. **Adaptation is allowed; drift is governed.** Variants and policy controls keep evolution safe.
4. **Self-hostable first.** Identity, data, and runtime stay inside the customer's environment.
5. **Phases ship value, not promises.** v0.1 is usable on its own; later phases compound.

## Where to Read More

- [`context/README.md`](./context/README.md) — strategy overview and phase index
- [`context/0.1/`](./context/0.1/) — Foundation (deploy, auth, connect, run)
- [`context/0.2/`](./context/0.2/) — Authoring velocity (chat → PR)
- [`context/0.3/`](./context/0.3/) — Governance (audit, HITL, dashboards)
- [`context/0.4/`](./context/0.4/) — Adaptive intelligence (corrections, variants, Mycelium)

Each phase folder contains:
- `README.md` — PRFAQ-style launch doc
- `BLOG_POST.md` — external-facing announcement draft
- `USER_STORIES.md` — Connextra-format stories with acceptance criteria
- `DEMO_SCRIPT.md` — timed demo flow with narration cues
