# Tembo Agent Studio v0.1

## Problem
Teams want a non-technical way to run useful agents, but the setup is fragmented: identity, repo wiring, runtime setup, and execution visibility are usually spread across different tools.

Without a stable foundation, later features like chat authoring, governance, and adaptive learning are unreliable.

## Our Solution
v0.1 delivers a deployable foundation for TAS:
- self-hosted deployment,
- enterprise-friendly authentication,
- workspace connection to Git and Tembo,
- first agent import/create and run workflow.

This phase intentionally prioritizes infrastructure confidence over advanced behavior.

## What Ships in v0.1
- Docker-first self-hosted deployment path.
- `better-auth` integration for internal identity alignment.
- Workspace onboarding with Git repository + Tembo API access key.
- Baseline agent creation/import.
- Manual run with basic run status and logs.

## Out of Scope for v0.1
- Chat-driven authoring loops.
- Rich governance dashboards.
- Correction-to-code automation.
- Variant/lineage lifecycle.
- Mycelium shared learning mode.

## Strategy
Build the minimum trustworthy control plane first. If deploy/auth/connect/run is weak, every later phase inherits fragility.

## Technical Details
- Frontend: Next.js 15 + Tailwind + shadcn/ui.
- Backend: Rust API runtime/orchestration.
- Auth: `better-auth` adapters.
- Tembo integration: API key mode.
- Agent format: Cargo AI JSON (technical implementation detail).

## FAQ
### Who should adopt v0.1?
Platform and IT teams preparing an internal pilot.

### Why not include chat authoring yet?
Because authoring speed without operational reliability creates downstream governance and trust failures.

### What proves success in this phase?
A team can deploy TAS, authenticate users, wire Git + Tembo, and execute real agent runs repeatedly.

## Open Questions Before v0.2
- Which default PR policy should be preselected at onboarding?
- What minimum run metadata must be visible before teams trust automation?
