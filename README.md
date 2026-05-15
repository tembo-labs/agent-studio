# Tembo Agent Studio

**Chat agents into existence. Use them. Correct them. Let them evolve.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tembo](https://img.shields.io/badge/Powered%20by-Tembo.io-10b981)](https://tembo.io)

Tembo Agent Studio (TAS) is an **open-source, self-hosted** chat-first platform for creating, running, and governing production-grade AI agents. It is the perfect non-technical companion to [tembo.io](https://tembo.io).

---

## ✨ Features

### Core Experience
- **Sign in with Tembo login** (OAuth/SSO)
- **Setup flow**: Create a repo → add it to Tembo → designate it in Agent Studio
- **Chat agents into existence** — plain English → Tembo.io coding agent generates the agent via YOLO PR (or review-required)
- **Chat at agents to change them** — same flow, Tembo coding agent updates via PR
- **Run agent** — one-click or via chat
- **Schedule agent** — cron-like scheduling via UI or chat
- **Rich Human-in-the-Loop** — Dynamic web forms for approvals, data entry, file uploads, conditional fields, and rich previews (Paperclip.ing-style clean interface)

### Continuous Improvement
- When a user **corrects an agent’s output**, TAS sends the original output + correction + full context to Tembo LLM
- Tembo analyzes the change and automatically creates a **targeted PR** updating the agent’s source code
- **Explicit “Modify + Rerun”** button — e.g. feedback “Never use em-dash in my tweet drafts” → one click → PR created + agent immediately re-runs with the change applied
- Full **immutable changelog** for every agent: **who** changed it, **when**, and **why** (exact user feedback text + context)

### Biological Evolution (Variants & Lineage)
- **Automatic divergence detection** — when different human users give conflicting feedback/preferences to the same agent
- **Variants** are created automatically (default: automatic, admin-configurable)
- A variant is a **different agent in the database** but shows a “**diverging**” state (not fully separated yet, still visibly linked to the parent)
- **Lineage View** — Beautiful biological-style family tree showing:
  - Parent agent
  - Diverging variants (with “diverging” badge)
  - Fully speciated agents
  - Clickable nodes to jump to any variant’s changelog, runs, or settings
- Admin controls: reconcile/merge variants back together, force speciation (permanent split), archive, or manually trigger a new variant
- Default visibility: **all users can see all variants** of shared agents (admin-configurable)

### Tembo Mycelium (Shared Learning Network)
Admins can optionally connect their TAS instance to **Tembo Mycelium** — a global, permissioned knowledge network for agents.

- **Auto-share** successful agent patterns, templates, learned behaviors, and variants (with attribution + granular privacy controls)
- **Discover & import** high-quality agents and variants from other organizations
- Fully optional: run completely **on an island** (air-gapped / fully private) **or** participate in collective intelligence
- Granular controls per instance

### Governance & Dashboard
- Clean **Paperclip.ing-style dashboard** (not compatible — just similar clean governance UI)
- Org overview with divergence alerts
- Per-agent: chat history, run logs, active HITL forms, changelog, learning summary, **Lineage View**
- PR policy toggle per workspace/agent: **Require my review** or **YOLO auto-merge on green**
- Everything is Git-backed (single source of truth)

---

## Architecture (Technical Details)

- **Frontend**: Next.js 15 + Tailwind + shadcn/ui (chat + dynamic forms + lineage tree)
- **Backend**: Rust API server (embeds/runs Cargo AI agents, handles HITL pauses/resumes, variant/lineage management, Mycelium sync)
- **Coding changes**: All changes (creation, edits, learning from feedback) go through **Tembo.io coding agents** via PRs
- **Agent format**: Cargo AI JSON (single-file declarative definition with inputs, agent_schema, actions, and HITL form schemas) — used internally, tucked into technical details
- **Runtime**: Native Cargo AI execution inside TAS (invokable via API)
- **Deployment**: Self-hosted per organization (like Paperclip.ing / OpenClaw)

---

## Repo Structure

```bash
agents/
  arr-guardian/
    agent.json                    # Cargo AI definition + HITL form schemas
    tools/                        # Optional custom Rust tools
    _variant_metadata.json        # TAS lineage & divergence state
  arr-guardian-marketing/         # Auto-created variant (diverging state)
.tembo/
  mycelium/                       # Local cache of shared knowledge
  lineage/                        # Lineage metadata
  skills/                         # Reusable patterns
```

---

## Quick Start

```bash
git clone https://github.com/tembo/agent-studio.git
cd agent-studio
docker compose up -d
```

1. Sign in with Tembo (OAuth/SSO)
2. Create or connect a GitHub repo → designate as TAS project
3. Start chatting: “Create an ARR Guardian that checks Stripe daily...”

---

## Philosophy

TAS treats agents like living biological systems:
- They **adapt** through human feedback and corrections
- They **speciate** (create variants) when user groups diverge
- They can **connect** via Mycelium to share wisdom across organizations
- Everything remains fully auditable, version-controlled, and human-governed

---

## Roadmap

**v0.1 (MVP)**
- Tembo SSO + repo designation
- Chat → Tembo coding agent (review or YOLO)
- Run/schedule + rich HITL forms
- Correction → auto PR + Modify+Rerun
- Full changelog (who/when/why)
- Divergence detection + automatic variants
- Lineage View + admin reconciliation tools
- Basic Tembo Mycelium sync

**Future**
- Visual low-code editor
- Multi-agent orchestration
- Advanced Mycelium marketplace & reputation
- Per-user private variants

---

## License

MIT © Tembo

---

**Made with ❤️ for teams that want agents that actually improve over time.**

[GitHub](https://github.com/tembo/agent-studio) • [tembo.io](https://tembo.io)