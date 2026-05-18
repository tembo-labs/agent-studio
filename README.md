# Tembo Agent Studio

**Chat agents into existence. Use them. Correct them. Let them evolve.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tembo](https://img.shields.io/badge/Powered%20by-Tembo.io-10b981)](https://tembo.io)

Tembo Agent Studio (TAS) is an **open-source, self-hosted** chat-first platform for creating, running, and governing production-grade AI agents. It is the non-technical companion to [tembo.io](https://tembo.io).

TAS is intentionally designed as a clean, governance-oriented web control plane in the spirit of Paperclip-style operational UX, while remaining its own product and architecture.

---

## Core Product Notes

- **Chat-first workflow**: users describe agents and changes in plain language.
- **Tembo-powered coding changes**: TAS routes implementation work to Tembo coding agents through PRs.
- **PR policy control**: teams can choose review-required or YOLO auto-merge on green.
- **Built-in HITL**: agents can pause and request human input using rich web forms.
- **Continuous learning**: user corrections can trigger targeted source-code updates.
- **Biological model**: agents can diverge into variants, then be reconciled or speciated.

---

## Phased Rollout

### `v0.1` Foundation (Deploy, Authenticate, Connect, Run)
- Self-hosted deployment path (Docker-first)
- `better-auth` integration and org/workspace sign-in
- Workspace onboarding: connect Git repo + store Tembo API access key
- Create/import first agent definition
- Run agent on demand and view basic run logs

### `v0.2` Authoring Flow (Chat to Build + Operate)
- Chat-driven agent creation via Tembo coding agent PRs
- Chat-driven agent updates via PRs
- PR policy controls: require review vs auto-merge on green
- Basic scheduling (cron-like)
- Basic HITL pause/resume workflow

### `v0.3` Governance and Collaboration (Control at Scale)
- Immutable changelog (who/when/why)
- Rich HITL forms (approvals, inputs, files, conditional fields, previews)
- Agent-level dashboard views (history, runs, active forms, policies)
- Admin controls for multi-team operation and audit readiness

### `v0.4` Adaptive Intelligence (Learning, Variants, Network Effects)
- Correction-to-code loop: feedback creates targeted PRs
- Explicit Modify + Rerun flow
- Divergence detection with variant creation + lineage view
- Admin controls: reconcile variants, force speciation, archive, manual variant creation
- Optional Tembo Mycelium sharing/import with privacy controls
- Optional Tembo MCP integration mode (when publicly available)

---

## Architecture

- **Frontend**: Next.js 15 + Tailwind + shadcn/ui
- **Backend**: Rust API server (agent execution, HITL orchestration, lineage/variant policy controls)
- **Auth layer**: `better-auth` adapters for enterprise identity integration
- **Tembo bridge**:
  - Primary: Tembo API access key
  - Future: Tembo MCP connection mode
- **Coding changes**: agent creation/edits/learning updates flow through Tembo coding agents via PRs
- **Agent format**: Cargo AI JSON (inputs, agent_schema, actions, HITL schemas) as internal technical representation
- **Deployment**: self-hosted per organization

---

## Repo Structure

```bash
agents/
  arr-guardian/
    agent.json                    # Cargo AI definition + HITL form schemas
    tools/                        # Optional custom Rust tools
    _variant_metadata.json        # TAS lineage & divergence state (v0.4+)
.tembo/
  mycelium/                       # Optional shared knowledge cache (v0.4+)
  lineage/                        # Lineage metadata (v0.4+)
  skills/                         # Reusable patterns
context/
  README.md
  planning/
    USER_STORIES.md
    PROJECT_NOTES_FULL_CONTEXT.md
  strategy/
    FEATURE_DETAILS.md
    MYCELIUM.md
  demos/
    DEMO_SCRIPT_01.md
```

---

## Quick Start

```bash
git clone https://github.com/tembo/agent-studio.git
cd agent-studio
docker compose up -d
```

1. Configure `better-auth` for your org identity provider.
2. Sign in and create a workspace.
3. Connect a GitHub repo and add a Tembo API access key.
4. Create/import an agent and run it.

---

## Documentation

- [context/README.md](./context/README.md): index of product context docs
- [context/planning/USER_STORIES.md](./context/planning/USER_STORIES.md): Connextra user stories grouped by `v0.1` to `v0.4`
- [context/planning/PROJECT_NOTES_FULL_CONTEXT.md](./context/planning/PROJECT_NOTES_FULL_CONTEXT.md): full historical notes and decisions from planning
- [context/strategy/FEATURE_DETAILS.md](./context/strategy/FEATURE_DETAILS.md): detailed feature context and implementation notes
- [context/strategy/MYCELIUM.md](./context/strategy/MYCELIUM.md): Tembo Mycelium model, operating modes, and governance
- [context/demos/DEMO_SCRIPT_01.md](./context/demos/DEMO_SCRIPT_01.md): demo flow for the `v0.1` milestone

---

## Philosophy

TAS treats agents like living systems:
- They **adapt** through human feedback and corrections
- They **speciate** into variants when user groups diverge
- They can optionally **connect** via Mycelium to share learning across organizations
- Everything stays auditable, version-controlled, and human-governed

---

## License

MIT © Tembo

[GitHub](https://github.com/tembo/agent-studio) • [tembo.io](https://tembo.io)
