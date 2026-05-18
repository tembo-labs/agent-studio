# Tembo Agent Studio v0.1 README

## Press Release (PRFAQ Style)

Today we are launching **Tembo Agent Studio v0.1**, the foundation release for a self-hosted, non-technical interface to production-grade agents. Teams can deploy TAS, authenticate with enterprise identity via `better-auth`, connect a Git repo and Tembo API key, and run a first agent end-to-end.

v0.1 is about operational readiness, not advanced autonomy. It establishes the base needed for later phases: chat-driven authoring, governance depth, and adaptive learning.

## FAQ

### Who is this for?
Platform admins, IT/security, and early operator teams validating deployment and runtime wiring.

### What ships in v0.1?
- Self-hosted deployment path (Docker-first)
- `better-auth` sign-in integration
- Workspace onboarding (repo + Tembo API key)
- Create/import baseline agent definition
- Manual run + basic run logs

### What does not ship yet?
Advanced PR authoring loops, full governance dashboards, variant lineage, and Mycelium networking.

## Strategy, Features, Technical Details

### Strategy
Establish trust and infrastructure first so later intelligent behavior is controllable.

### Features
- Deploy TAS
- Authenticate users
- Connect repo and Tembo API integration
- Run first agent and inspect logs

### Technical Details
- Frontend: Next.js 15 + Tailwind + shadcn/ui
- Backend: Rust API runtime and orchestration
- Auth: `better-auth`
- Tembo integration: API key mode
- Agent format: Cargo AI JSON (technical implementation detail)
