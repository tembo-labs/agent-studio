# Blog Post: Tembo Agent Studio v0.1 - Foundation Before Acceleration

Tembo Agent Studio is built around a simple idea: non-technical teams should be able to operate real agents without sacrificing software rigor. But before we can deliver fast chat-based authoring, we need a reliable foundation.

That is what v0.1 is for.

## Why This Release Exists
Most teams do not fail at generating agent ideas. They fail at turning those ideas into repeatable, governed execution. Identity is bolted on later, repository wiring is inconsistent, and runtime ownership is unclear.

v0.1 addresses that directly by making deploy, auth, integration, and execution the first milestone.

## What You Can Do in v0.1
With v0.1, teams can:
- deploy TAS in a self-hosted environment,
- authenticate through `better-auth` so enterprise identity policies are respected,
- connect a Git repository and Tembo API key at workspace setup,
- create or import a baseline agent,
- run the agent and inspect logs.

This is the minimum operational baseline required for confident rollout.

## Why the Scope Is Intentionally Narrow
v0.1 is not trying to be impressive. It is trying to be dependable.

Later phases introduce chat authoring, richer human-in-the-loop controls, and adaptive learning from corrections. Those only work if the underlying runtime and ownership boundaries are already stable.

## What Comes Next
- v0.2: chat-driven creation and edit loops via PRs.
- v0.3: governance depth (who/when/why traceability and rich HITL operations).
- v0.4: adaptive intelligence (correction-to-code, variants, and optional Mycelium networking).

If your team is evaluating TAS, v0.1 is where to validate platform fit and operational readiness.
