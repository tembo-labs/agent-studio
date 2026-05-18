# Tembo Agent Studio v0.3 — Operational Surface

> **Headline:** Fast authoring is only half the job. v0.3 is the day-to-day operating surface — rich human-in-the-loop forms for reviewers, and per-agent dashboards for the operator who gets paged when something breaks.
>
> **Audience:** workspace admins, operators, reviewers, and the first-line support engineers who absorb the 2am pages.

## Problem

After v0.2, customers are shipping changes in minutes instead of weeks. That speed exposes two operating gaps that aren't about *making* changes — they're about *running* the system day to day:

- **HITL is too crude.** Free-text pause/resume works for a quoting workflow but not for a reviewer who needs to upload a signed PDF, pick from a conditional dropdown, and confirm a structured summary.
- **Per-agent operational visibility is absent.** When an agent misbehaves, support engineers cobble together a story from raw run logs and Slack screenshots.

Without these, the v0.2 authoring win is real but the operator experience around it stays brittle. (Audit, RBAC, and org-level policy are a separate trust conversation — addressed in [v0.4 (Governance depth)](../0.4/).)

## Our Solution

v0.3 is the operational-surface release. It adds two interlocking capabilities, both targeted at *day two*:

1. **Rich HITL forms.** Multi-field forms with conditional logic, file uploads, image/PDF preview, validation, and structured response persistence.
2. **Per-agent operational dashboards.** Run history, active human tasks, error trends, and SLA-relevant counters per agent — built so that triage starts on one screen, not in raw logs.

## What Ships in v0.3

- **Form schema renderer.** Conditional field visibility, file upload with size and MIME limits, image/PDF preview, required-field validation.
- **Operational dashboards.** Run pass/fail rate, time-to-resolution on HITL tasks, top failure reasons, list of active human-blocked steps.
- **Failure investigation surface.** From a failed run, surface the last human action, the most recent agent change, and similar past failures — without leaving the page.

## Out of Scope for v0.3

- Immutable `who/when/why` changelog, RBAC, and org-level policy templates — [v0.4 (Governance depth)](../0.4/).
- Correction-to-code learning, variant lifecycle — [v0.5 (Adaptive intelligence)](../0.5/).
- Cross-deployment shared learning — [v0.6 (Mycelium)](../0.6/).

## Strategy

Get the operator experience right *before* layering governance and adaptive loops on top. A reviewer who can't upload a PDF or an oncall who can't read run health on one screen will not care that the platform has a clean audit story. The v0.4 governance work depends on v0.3 forms and dashboards producing structured events worth auditing.

## Technical Details

- **Form schema.** JSON Schema-based, with conditional visibility expressed as a small DSL. Uploaded files are stored in workspace-scoped object storage with the workspace's encryption settings.
- **Dashboards.** Read models built off the run store; no shared data with v0.2's PR surface.
- **Failure investigation.** Cross-reference HITL response store, run store, and PR metadata. No new persistence layer beyond what runs and forms already produce.

## Customer Quote (Drafted)

> "Our reviewers stopped opening tickets to ask 'where do I upload the redlined PDF?' the week v0.3 landed. The dashboard answered our oncall's first three questions on a real Sunday incident before they'd opened Slack."
>
> — *Head of Operations, regulated B2C platform (draft persona)*

## FAQ

### Why isn't audit in v0.3?
Because the audit conversation is fundamentally a *governance* conversation — RBAC, policy templates, org-level inheritance — and bundling it with reviewer forms and dashboards muddies both. v0.3 is what an operator needs to do their job; v0.4 is what an auditor needs to do theirs.

### What if a HITL form needs a field type we don't support yet?
v0.3 covers text, number, enum/dropdown, date, file, structured-confirmation. Anything outside that should be raised as feedback — we'd rather ship the right ten field types than thirty half-broken ones.

### Are dashboards real-time?
Sub-minute latency for active human tasks and run state. Daily rollups for trend dashboards. We're not building a Datadog replacement.

### How does v0.3 interact with the v0.4 changelog?
HITL form responses and dashboard-visible state changes will be the *raw events* the v0.4 changelog renders. v0.3 produces the structured events; v0.4 puts them under audit and access control.

## Exit Bar (Definition of Done for v0.3)

- [ ] A rich HITL form with at least one upload, one conditional field, and one validation rule is in production use at a pilot customer.
- [ ] At least one customer's first-line support team is using the per-agent dashboard as a primary triage surface.
- [ ] A failed run page reaches the most recent agent change and the most recent human action in three clicks or fewer.

## Open Questions Before v0.4

- Which structured events from v0.3 forms and dashboards should be first-class objects in the v0.4 changelog versus rolled-up summaries?
- Should the failure-investigation links from v0.3 also resolve into changelog filters, or live alongside?
- What's the right form field type to defer to v0.4 because it's actually a policy/permissions question (e.g., "this field is editable only by org admins")?
