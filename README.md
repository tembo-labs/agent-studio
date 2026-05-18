# Tembo Agent Studio

**Chat agents into existence. Use them. Correct them. Let them evolve.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tembo](https://img.shields.io/badge/Powered%20by-Tembo.io-10b981)](https://tembo.io)

Tembo Agent Studio (TAS) is an **open-source, self-hosted** chat-first platform for creating, running, and governing production-grade AI agents. It is the non-technical companion to [tembo.io](https://tembo.io).

---

## Product Direction

TAS ships in phased milestones so teams can adopt foundations first, then layer on advanced adaptive behavior.

- **Authentication**: TAS uses **better-auth** so customers can connect internal identity systems (OIDC/SAML-compatible providers via their auth stack).
- **Tembo integration (now)**: TAS integrates with Tembo using an **API access key**.
- **Tembo integration (future)**: TAS can add an **MCP-based integration mode** once the Tembo platform exposes a public MCP server.

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
- Rich HITL forms (approvals, inputs, files, conditional fields)
- Agent-level dashboard views (history, runs, active forms, policies)
- Admin controls for multi-team operation and audit readiness

### `v0.4` Adaptive Intelligence (Learning, Variants, Network Effects)
- Correction-to-code loop: feedback creates targeted PRs
- Explicit Modify + Rerun flow
- Divergence detection with variant creation + lineage view
- Optional Tembo Mycelium sharing/import with privacy controls
- Optional Tembo MCP integration mode (when publicly available)

---

## Architecture

- **Frontend**: Next.js 15 + Tailwind + shadcn/ui
- **Backend**: Rust API server (agent execution, HITL orchestration, policy controls)
- **Auth layer**: `better-auth` adapters for enterprise identity integration
- **Tembo bridge**:
  - Primary: Tembo API access key
  - Future: Tembo MCP connection mode
- **Coding changes**: Agent creation/edits flow through Tembo coding agents via PRs
- **Agent format**: Cargo AI JSON (inputs, agent_schema, actions, HITL schemas)
- **Deployment**: Self-hosted per organization

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

- [USER_STORIES.md](./USER_STORIES.md): Connextra user stories grouped by `v0.1` to `v0.4`
- [DEMO_SCRIPT_01.md](./DEMO_SCRIPT_01.md): demo flow for the `v0.1` milestone

---

## Philosophy

TAS treats agents like living systems:
- They **start from a stable operational foundation**
- They **improve through governed iteration**
- They **adapt through human feedback over time**
- Everything is auditable, version-controlled, and human-governed

---

## License

MIT © Tembo

[GitHub](https://github.com/tembo/agent-studio) • [tembo.io](https://tembo.io)
