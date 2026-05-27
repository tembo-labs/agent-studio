# Tembo Agent Studio v0.3: The Operator's Floor

*Draft — internal review*

By the time TAS v0.3 ships, our pilot customers are already shipping changes in minutes via chat-to-PR. The conversations have shifted. They're no longer about whether the platform can move fast — they're about whether the platform's *operating* surface keeps up.

That's the audience v0.3 is for. Not the auditor (that's v0.4). Not the end user driving adaptation (that's v0.5). The *operator* — the reviewer doing real domain work, the workspace admin checking run health on a normal Monday, the support engineer paged at 2am.

## What v0.3 Adds

- **Rich HITL forms.** Multi-field forms with conditional fields, file uploads, previews, and validation.
- **Per-agent operational dashboards.** Run pass/fail, time-to-resolution, top failure reasons, active human-blocked steps.
- **Failure investigation flow.** From a failed run, reach the last human action and the most recent change in three clicks or fewer.

## The Two Conversations v0.3 Closes Out

**1. The HITL conversation.**
> "Pause/resume was enough for our internal triage agent. For the contract-redlining workflow we need a reviewer to upload a PDF, pick a redline category, and confirm a structured summary."

v0.3's form schema covers exactly this.

**2. The support conversation.**
> "Our first-line support team can't tell whether a misbehaving agent is a bad run or a regression from a recent change."

v0.3's per-agent dashboard answers it: this run, this history, these recent changes, these active human tasks.

## What v0.3 Is Not

- Not the audit release. Immutable `who/when/why`, RBAC, and policy templates are [v0.4 (Governance depth)](../../0.4/).
- Not the learning release. Correction-to-code is [v0.5 (Adaptive intelligence)](../../0.5/).
- Not a Datadog replacement. Operational dashboards target triage, not SRE-grade observability.

## Why Operations Is Its Own Phase

Most platforms staple HITL forms onto a generic UI library and call it done. Then a reviewer needs to upload a 40MB PDF and the staple breaks.

We pulled HITL and the operator dashboard into their own phase because they're the surface every other phase compounds on. v0.4's audit log is only as useful as the structured events v0.3 produces. v0.5's correction-to-code only works if the reviewer surface is real enough to *be* corrected. v0.3 builds those primitives once, deliberately.

## Foundation for v0.4

v0.4 introduces governance depth: an immutable `who/when/why` changelog, RBAC, and org-level policy templates. The events the audit log records are produced by v0.3 — HITL responses, dashboard-visible state changes, run completions. v0.3 is what makes v0.4 worth auditing.

## What's Next

- **v0.4 — Governance depth.** Audit log, RBAC, org-level policy templates. Lands *before* adaptive loops so the loop can't outrun the audit trail.
- **v0.5 — Adaptive intelligence.** End-user corrections become PRs. Variants manage divergence.
- **v0.6 — Mycelium.** Optional cross-deployment pattern exchange, under explicit policy.

If v0.1 proved TAS can run and v0.2 proved TAS can iterate, v0.3 proves TAS is a place an *operator* can actually live.
