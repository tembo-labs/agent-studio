# Tembo Agent Studio

**Chat agents into existence. Use them. Correct them. Let them evolve.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tembo](https://img.shields.io/badge/Powered%20by-Tembo.io-10b981)](https://tembo.io)

Tembo Agent Studio (TAS) is an **open-source, self-hosted** chat-first platform for creating, running, and governing production-grade AI agents. It pairs beautifully with [tembo.io](https://tembo.io).

Agents evolve biologically: they improve from every human correction and naturally **speciate into variants** when users diverge.

---

## ✨ Features

### Core Experience
- **Chat-first creation & editing**
- **One-click “Modify + Rerun”**
- **Rich Human-in-the-Loop** forms (approvals, conditional fields, file uploads, previews)
- Built-in runtime with scheduling and real-time updates

### Continuous Improvement
- Automatic improvement PRs via Tembo coding agents on every correction
- Full immutable **changelog** (who, when, why)

### Biological Evolution
- Automatic **divergence detection** → **variants**
- Beautiful **lineage tree**
- Admin tools for reconciliation and speciation

### Tembo Mycelium (Shared Learning Network)
Admins can optionally connect their TAS instance to **Tembo Mycelium** — a global, permissioned knowledge network for agents.

- **Auto-share** successful agent patterns, templates, and learned behaviors (with full attribution and privacy controls)
- **Discover & import** high-quality agents and variants from other organizations
- Work completely **on an island** (air-gapped / fully private) **or** participate in the collective intelligence
- Granular controls: share only templates, share anonymized lessons, share full variants, etc.

---

## 🚀 Quick Start

```bash
git clone https://github.com/tembo/agent-studio.git
cd agent-studio
docker compose up -d
```

Sign in with Tembo → connect a repo → start chatting.

---

## Architecture

- **Frontend**: Next.js  
- **Backend**: Rust (Cargo AI runtime + HITL + Mycelium sync)  
- **Coding Changes**: Tembo.io agents (PRs)  
- **Source of Truth**: Your Git repo  
- **Optional**: Tembo Mycelium sync (secure, opt-in)

---

## Philosophy

TAS treats agents like living organisms in an ecosystem:
- They **adapt** through feedback
- They **speciate** when groups diverge
- They can **connect** through the Mycelium to share wisdom across organizations

---

## License

MIT
