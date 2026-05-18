# Tembo Agent Studio v0.3: Governance as a First-Class Feature

*Draft — internal review*

By the time TAS v0.3 ships, our pilot customers are already shipping changes in minutes via chat-to-PR. The conversations have shifted. They're no longer about whether the platform can move fast — they're about whether the platform can move fast *and* survive an auditor.

That's the audience v0.3 is for.

## What v0.3 Adds

- **Immutable `who/when/why` changelog.** Every agent change, run, human intervention, and policy switch is recorded with the actor, the time, and the originating intent.
- **Rich HITL forms.** Multi-field forms with conditional fields, file uploads, previews, and validation.
- **Per-agent operational dashboards.** Run pass/fail, time-to-resolution, top failure reasons, active human-blocked steps.
- **Org-level RBAC and policy templates.** Defaults inherited by workspaces, with explicit override events.

## The Three Conversations v0.3 Closes Out

**1. The compliance conversation.**
> "When auditors ask who approved the change that altered our customer-reply tone last quarter, we want to show them one screen — not start a four-day spelunking exercise."

v0.3 makes that one screen real.

**2. The HITL conversation.**
> "Pause/resume was enough for our internal triage agent. For the contract-redlining workflow we need a reviewer to upload a PDF, pick a redline category, and confirm a structured summary."

v0.3's form schema covers exactly this.

**3. The support conversation.**
> "Our first-line support team can't tell whether a misbehaving agent is a bad run or a regression from a recent change."

v0.3's per-agent dashboard answers it: this run, this history, these recent changes, these active human tasks.

## What v0.3 Is Not

- Not the learning release. Correction-to-code is v0.4.
- Not a Datadog replacement. Operational dashboards target triage, not SRE-grade observability.
- Not the place where governance becomes optional — v0.3 raises the floor for the platform.

## Why Governance Is Its Own Phase

Most platforms treat governance as a v2 add-on or a customer-success problem. We disagree. The first time a v0.2 customer ships ten chat-authored changes in a week, the second question they ask (after "this is great") is "how do we explain this?"

If the answer is "we'll add audit later," the third question is "we'll evaluate later." Phase ordering is product strategy.

## Foundation for v0.4

v0.4 introduces correction-to-code: real user corrections become targeted PRs. That's only safe if every input to the loop — the correction, the actor, the surrounding run — is already audited. v0.3 builds exactly that substrate.

## What's Next

- **v0.4 — Adaptive intelligence.** Corrections from end users become PRs. Variants manage divergence. Optional Mycelium connects deployments for shared learning.

If v0.1 proved TAS can run and v0.2 proved TAS can iterate, v0.3 proves TAS can be trusted at scale.
