# Tembo Agent Studio v0.3 — Governance Depth

> **Headline:** Authored fast, audited deeply. v0.3 makes every change, every human action, and every run explainable — without slowing v0.2's chat-to-PR loop.
>
> **Audience:** platform admins, compliance/security teams, and the operators who get paged at 2am.

## Problem

After v0.2, customers are shipping changes in minutes instead of weeks. That speed exposes the next failure mode:

- **The audit trail is thin.** Git tells you who merged a PR, but not who authored it in chat, what they originally said, or which run history motivated the change.
- **HITL is too crude.** Free-text pause/resume works for a quoting workflow but not for a reviewer who needs to upload a signed PDF, pick from a conditional dropdown, and confirm a structured summary.
- **Per-agent operational visibility is absent.** When an agent misbehaves, support engineers cobble together a story from raw run logs and Slack screenshots.
- **Admin controls are workspace-wide only.** Larger orgs need role boundaries and policies that scale beyond a single workspace.

Without these, scale doesn't compound — it amplifies risk.

## Our Solution

v0.3 is the governance release. It adds four interlocking capabilities:

1. **Immutable `who/when/why` changelog.** Every agent change, run, human intervention, and policy switch is recorded with the actor, timestamp, and originating intent (chat session ID, PR number, correction ID).
2. **Rich HITL forms.** Multi-field forms with conditional logic, file uploads, image/PDF preview, validation, and structured response persistence.
3. **Per-agent operational dashboards.** Run history, active human tasks, error trends, and SLA-relevant counters per agent.
4. **Stronger admin and policy controls.** Role-based access, org-level policy templates that workspaces inherit, and explicit overrides with their own audit entries.

## What Ships in v0.3

- **Immutable changelog API + UI.** Per-agent and per-workspace views. Filter by actor, time, source (chat / PR / correction / human action).
- **Form schema renderer.** Conditional field visibility, file upload with size and MIME limits, image/PDF preview, required-field validation.
- **Operational dashboards.** Run pass/fail rate, time-to-resolution on HITL tasks, top failure reasons, list of active human-blocked steps.
- **RBAC.** Org admin → workspace admin → operator → viewer. Custom roles deferred to v0.4+.
- **Policy templates.** Org-level defaults (e.g., "all customer-facing agents are review-required") that workspaces inherit; per-workspace override creates an audit entry.

## Out of Scope for v0.3

- Correction-to-code learning (v0.4).
- Variant lifecycle and lineage (v0.4).
- Mycelium shared learning (v0.4).
- Custom RBAC roles (post-v0.4 unless a customer blocks).

## Strategy

Increase trust and operational safety **before** introducing adaptive change. We refuse to ship v0.4 learning loops on top of a thin audit trail — the failure mode is "the agent changed and we can't explain why," and that kills the product's enterprise story.

## Technical Details

- **Changelog model.** Append-only event store. Every event has `actor`, `at`, `source`, `target`, `payload`. Render layers compute the per-agent and per-workspace views.
- **Form schema.** JSON Schema-based, with conditional visibility expressed as a small DSL. Uploaded files are stored in workspace-scoped object storage with the workspace's encryption settings.
- **Dashboards.** Read models built off the run + changelog stores; no shared data with v0.2.
- **RBAC.** Identities continue to flow through `better-auth`. Roles are first-class objects with their own audit entries on assignment changes.

## Customer Quote (Drafted)

> "When the auditors asked who approved the change that altered our customer-reply tone last quarter, we showed them the chat session, the PR, the reviewer, and the timestamp — in one screen. Three months ago that would have been a four-day spelunking exercise."
>
> — *Head of Compliance, regulated B2C platform (draft persona)*

## FAQ

### Why emphasize `who/when/why` now and not at v0.1?
Because at v0.1 there isn't much to audit — one team, manual runs. By v0.3 customers are running multi-team operations and the cost of *not* auditing has overtaken the cost of building the audit surface.

### Is the changelog actually immutable, or just hard to edit?
Append-only at the storage layer. Corrections (e.g., wrong actor recorded) are added as new events with `kind=correction` referencing the original — the original never disappears.

### What if a HITL form needs a field type we don't support yet?
v0.3 covers text, number, enum/dropdown, date, file, structured-confirmation. Anything outside that should be raised as feedback — we'd rather ship the right ten field types than thirty half-broken ones.

### How does this interact with the v0.2 PR policy?
PR policy is now itself a recorded thing. Changing a policy creates an event. Auto-merges create events. Reviewer approvals create events.

### Are dashboards real-time?
Sub-minute latency for active human tasks and run state. Daily rollups for trend dashboards. We're not building a Datadog replacement.

## Exit Bar (Definition of Done for v0.3)

- [ ] A compliance reviewer can, in under five minutes, answer "who changed this agent, when, why, and who approved it?" for any agent in any workspace.
- [ ] A rich HITL form with at least one upload, one conditional field, and one validation rule is in production use at a pilot customer.
- [ ] At least one customer's first-line support team is using the per-agent dashboard as a primary triage surface.
- [ ] RBAC roles are enforced at the API layer, not just the UI.

## Open Questions Before v0.4

- What thresholds in run patterns or correction frequency should trigger divergence alerts in v0.4?
- Which v0.3 changelog events become inputs to v0.4's correction-to-code analysis?
- Should chat sessions themselves be first-class audit objects, or remain attached to the PR they produced?
- How do we expose the audit timeline outside the UI (e.g., to a customer's SIEM)?
