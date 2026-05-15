# Tembo Agent Studio

**Chat agents into existence. Use them. Correct them. Let them evolve.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tembo](https://img.shields.io/badge/Powered%20by-Tembo.io-10b981)](https://tembo.io)

Tembo Agent Studio (TAS) is an **open-source, self-hosted** chat-first platform for creating, running, and governing production-grade AI agents. It is the perfect companion to [tembo.io](https://tembo.io).

---

## ✨ Features

### Core Experience
- **Chat-first creation & editing** — Describe agents in plain English
- **Run & Schedule** agents with one click
- **Rich Human-in-the-Loop** — Dynamic web forms for approvals, data entry, file uploads, conditional fields, and rich previews (Paperclip.ing-style interface)
- **One-click “Modify + Rerun”** — Give feedback and instantly retry with improvements applied

### Continuous Improvement
- Every correction or explicit feedback is analyzed by Tembo’s coding agent
- Automatically generates a **targeted PR** updating the agent’s source code (`agent.json`)
- Full **immutable changelog** — who changed what, when, and exactly why (user feedback text + context)

### Biological Evolution (Variants & Lineage)
- **Automatic divergence detection** when different users give conflicting preferences
- Creates **variants** (default: automatic, admin-configurable)
- Variants start as “diverging” (still linked to parent) and can later be reconciled or fully speciated
- Beautiful **lineage tree** showing parent → variants → speciated agents
- Admin controls: reconcile, force speciation, merge, archive

### Tembo Mycelium (Shared Learning Network)
Admins can connect their TAS instance to **Tembo Mycelium** — a global, permissioned knowledge network.

- **Auto-share** successful patterns, templates, and learned behaviors (with attribution + privacy controls)
- **Discover & import** high-quality agents and variants from the network
- Fully optional — run completely **on an island** (air-gapped) or participate in collective intelligence
- Granular controls per instance

### Governance
- Paperclip.ing-inspired clean dashboard
- Org overview with divergence alerts
- Per-agent changelog, feedback history, learning summary, and lineage view
- All agents live in a Git repo (single source of truth)

---

## 🚀 Quick Start

```bash
git clone https://github.com/tembo/agent-studio.git
cd agent-studio
docker compose up -d
```

1. Sign in with Tembo (OAuth/SSO)
2. Connect or create a GitHub repo
3. Start chatting with your first agent

---

## Architecture

- **Frontend**: Next.js 15 + Tailwind + shadcn/ui
- **Backend**: Rust (Cargo AI runtime, HITL state, Mycelium sync, variant management)
- **Coding Changes**: Powered by Tembo.io coding agents (YOLO PRs or review-required)
- **Runtime**: Native in TAS (with scheduling support)
- **Agent Format**: Cargo AI JSON (declarative, LLM-friendly)

---

## Repo Structure

```bash
agents/
  arr-guardian/
    agent.json                    # Main definition + HITL forms
    tools/                        # Optional custom Rust tools
    _variant_metadata.json        # TAS lineage info
  arr-guardian-marketing/         # Auto-created variant
.tembo/
  mycelium/                       # Local cache of shared knowledge
  lineage/
  skills/                         # Reusable patterns
```

---

## Philosophy

TAS treats agents like living organisms:
- They **adapt** through human feedback
- They **speciate** (create variants) when groups diverge
- They can **connect** via Mycelium to share wisdom across organizations
- Everything remains fully auditable and Git-backed

---

## Roadmap

**v0.1 (MVP)**
- Chat + Tembo coding agents
- Run / schedule + rich HITL forms
- Correction → auto PR + Modify+Rerun
- Full changelog
- Divergence detection + automatic variants
- Lineage tree + admin tools
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