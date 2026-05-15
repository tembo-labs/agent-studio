# Tembo Agent Studio

**Chat agents into existence. Use them. Correct them. Let them evolve.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tembo](https://img.shields.io/badge/Powered%20by-Tembo.io-10b981)](https://tembo.io)

Tembo Agent Studio (TAS) is an **open-source, self-hosted** chat-first platform for creating, running, and governing production-grade AI agents. It pairs beautifully with [tembo.io](https://tembo.io) — you chat or correct in natural language, Tembo’s coding agents turn those changes into clean Git PRs, and TAS runs the agents with rich human-in-the-loop controls.

Agents evolve biologically: they improve from every human correction and naturally **speciate into variants** when users diverge in preferences.

---

## ✨ Features

### Core Experience
- **Chat-first creation & editing** — Describe what you want in plain English
- **One-click “Modify + Rerun”** — Give feedback and instantly see the improved agent
- **Rich Human-in-the-Loop** — Dynamic web forms (approvals, data entry, file uploads, conditional fields, previews)
- **Built-in runtime** — Reliable execution with scheduling, logging, and real-time updates

### Continuous Improvement
- Every output correction or feedback automatically triggers a **targeted PR** via Tembo coding agents
- Full **immutable changelog** — who, when, and exactly why every change was made

### Biological Evolution (Variants & Lineage)
- Automatic **divergence detection** when users have conflicting preferences
- **Variants** are created automatically (admin-configurable) — shown as “diverging” until reconciled or speciated
- Beautiful **lineage tree** showing parent agents and their variants
- Admin tools to reconcile, force speciation, or merge variants back together

### Governance & Visibility
- Paperclip.ing-style clean dashboard
- Per-agent changelog, feedback history, and learning summary
- Admin-configurable policies (auto-variant creation, visibility, etc.)
- All agents live in a Git repo — full version control and auditability

---

## 🚀 Quick Start

### 1. Deploy TAS
```bash
git clone https://github.com/tembo/agent-studio.git
cd agent-studio
docker compose up -d
```

Or use Nix / Kubernetes — see [Deployment Guide](docs/deployment.md).

### 2. Connect to Tembo
- Sign in with your Tembo account (OAuth/SSO)
- Create or connect a GitHub repo
- Designate it as your Agent Studio project

### 3. Create Your First Agent
Open the chat and say:
> “Create a Tweet Crafter that writes engaging Twitter threads from Linear tickets. Never use em-dashes. Show me a form to approve before posting.”

That’s it. TAS + Tembo will generate the agent, open a PR, and you can run it immediately.

---

## Architecture

```
Frontend (Next.js) ←→ Rust Backend (Cargo AI runtime + HITL)
                     ↓
               Tembo.io (coding agents + PRs)
                     ↓
               GitHub Repo (source of truth)
```

- **Agent format**: Cargo AI JSON (`agents/{name}/agent.json`) — declarative, powerful, and easy for LLMs to edit
- **Runtime**: Fully inside TAS (with optional Tembo scheduler integration)
- **Data**: Git + lightweight SQLite for fast UI queries (lineage, changelog, variants)

All changes to agent logic go through Tembo coding agents for consistency and safety.

---

## Repo Structure

```bash
agents/
  tweet-crafter/
    agent.json                 # Cargo AI definition + HITL forms
    tools/                     # optional custom Rust tools
    _variant_metadata.json     # TAS lineage info
  tweet-crafter-marketing/     # auto-created variant
.tembo/
  lineage/
  skills/                      # reusable patterns
```

---

## Screenshots

*(Coming in v0.1 — dashboard, lineage tree, correction → PR flow, HITL forms)*

---

## Roadmap

**v0.1 (MVP)**
- Chat + Tembo coding agents
- Run / schedule + rich HITL forms
- Correction → auto PR + Modify+Rerun
- Full changelog
- Divergence detection + automatic variants
- Lineage tree + admin reconciliation

**Future**
- Visual low-code editor
- Multi-agent orchestration
- Variant marketplace
- Deeper Tembo analytics
- Per-user private variants

---

## Philosophy

TAS treats agents like living systems:
- They **adapt** through human feedback
- They **speciate** when groups diverge
- They remain **auditable** and **governed**

We believe the best agents are not static prompts — they evolve with their users.

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md).

Big thanks to the Tembo team and early users shaping this vision.

---

## License

MIT © Tembo

---

**Made with ❤️ for teams that want agents that actually improve over time.**

[Try it now](https://github.com/tembo/agent-studio) • [tembo.io](https://tembo.io) • [Discord / Discussions](https://github.com/tembo/agent-studio/discussions)
