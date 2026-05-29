# Tembo Agent Studio v0.4 — Governance Depth

> **Headline:** Authored fast, operated well, audited deeply. v0.4 makes every change, every human action, and every run explainable — and puts who-can-do-what under explicit policy — before adaptive loops begin to write back into source.
>
> **Audience:** platform admins, compliance/security teams, org admins, and the auditors who will eventually ask "who changed this, when, and why?"

## Problem

After v0.3, customers have fast authoring (v0.2) and a real operator surface (v0.3). The next failure mode is governance:

- **The audit trail is thin.** Git tells you who merged a PR, but not who authored it in chat, what they originally said, or which run history motivated the change.
- **Admin controls are workspace-wide only.** Larger orgs need role boundaries and policies that scale beyond a single workspace.
- **Adaptive loops are coming and can't run on a thin audit.** v0.5 introduces end-user corrections turning into PRs. That's only safe if every input to the loop — actor, time, source, intent — is already audited and access-controlled.

Without these, scale doesn't compound — it amplifies risk. And the adaptive intelligence in v0.5 cannot ship responsibly on top of an incomplete audit trail.

## Our Solution

v0.4 is the governance release. Two interlocking capabilities:

1. **Immutable `who/when/why` changelog.** Every agent change, run, human intervention, and policy switch is recorded with the actor, timestamp, and originating intent (chat session ID, PR number, correction ID).
2. **Role-based access control (RBAC).** Workspace admin → operator → viewer, enforced at the API layer, not just the UI.

A third originally-planned capability — **org-level policy templates** — was scoped out of v0.4 and lives in [`context/backlog/`](../../backlog/USER_STORIES.md#us-backlog-01--org-level-policy-templates). It needs an org concept (a scope above workspace) plus a generic policy substrate, and the rest of v0.4 ships cleanly without it.

## What Ships in v0.4

- **Immutable changelog API + UI.** Per-agent and per-workspace views. Filter by actor, time, source (chat / PR / HITL response / dashboard event / correction / human action).
- **RBAC.** Workspace admin → operator → viewer. Org-admin tier deferred until cross-workspace endpoints exist; custom roles deferred to post-v0.6 unless a customer blocks.
- **Cross-system export.** Per-agent JSON export at v0.4. Streaming to a SIEM is in the v0.5 open-questions list — pilot destinations welcome.

## Out of Scope for v0.4

- Rich HITL forms and per-agent dashboards — already shipped in [v0.3 (Operational surface)](../0.3/). v0.4 reads the events v0.3 produced; it doesn't reproduce them.
- Org-level policy templates — moved to [Backlog](../../backlog/USER_STORIES.md#us-backlog-01--org-level-policy-templates). The substrate (org concept + policy resolver + tightening/loosening rule) was disproportionate to the rest of v0.4; pull forward when scheduled.
- Correction-to-code learning, variant lifecycle — [v0.5 (Adaptive intelligence)](../../0.5/).
- Cross-deployment shared learning — [v0.6 (Mycelium)](../../0.6/).
- Custom RBAC roles beyond the four built-ins — post-v0.6 unless a customer blocks.

## Strategy

Increase trust and access discipline **before** introducing adaptive change. We refuse to ship v0.5 learning loops on top of a thin audit trail — the failure mode is "the agent changed and we can't explain why," and that kills the product's enterprise story. Ordering governance ahead of adaptive intelligence is a deliberate, expensive choice and we are making it on purpose.

## Technical Details

- **Changelog model.** Append-only event store. Every event has `actor`, `at`, `source`, `target`, `payload`. v0.3 already emits the right shape of structured events; v0.4 puts them under audit and access control. Render layers compute the per-agent and per-workspace views.
- **RBAC.** Identities continue to flow through `better-auth`. Roles are first-class objects with their own audit entries on assignment changes. Enforcement is at the API layer; the UI mirrors API state, never softens it.
- **Policy templates.** Versioned, org-scoped JSON templates. Workspaces inherit; overrides require a free-text justification persisted to the changelog. Policy diffs render cleanly so the auditor's question is "what changed, who changed it, why" — not "what was the state on March 12."

## Customer Quote (Drafted)

> "When the auditors asked who approved the change that altered our customer-reply tone last quarter, we showed them the chat session, the PR, the reviewer, and the timestamp — in one screen. Three months ago that would have been a four-day spelunking exercise."
>
> — *Head of Compliance, regulated B2C platform (draft persona)*

## FAQ

### Why isn't governance bundled with the v0.3 operator surface?
Because the audiences are different. v0.3 is for the operator doing their job. v0.4 is for the auditor and the org admin shaping who can do what. Bundling them muddies both — and a thinner v0.3 ships faster, which is the whole point of phasing.

### Why land governance before adaptive intelligence in v0.5?
Because adaptive intelligence rewrites agents based on end-user signal. The cost of *not* auditing those rewrites compounds the first time something goes wrong. We ship the audit substrate first, on purpose, even though "adaptive" demos better than "audit."

### Is the changelog actually immutable, or just hard to edit?
Append-only at the storage layer. Corrections (e.g., wrong actor recorded) are added as new events with `kind=correction` referencing the original — the original never disappears.

### How does this interact with the v0.2 PR policy?
PR policy is now itself a recorded thing. Changing a policy creates an event. Auto-merges create events. Reviewer approvals create events.

### What about custom RBAC roles?
The four built-ins (org admin / workspace admin / operator / viewer) cover the cases we've seen in pilots. Custom roles are deferred post-v0.6 unless a customer blocks. Policy templates plus per-workspace overrides cover most of the asks we'd otherwise get there.

## Exit Bar (Definition of Done for v0.4)

- [ ] A compliance reviewer can, in under five minutes, answer "who changed this agent, when, why, and who approved it?" for any agent in any workspace.
- [ ] RBAC roles are enforced at the API layer, not just the UI (verified by a deny-test).
- [ ] Per-agent changelog JSON export works for at least one pilot customer's reporting flow.

(The originally-planned policy-override exit-bar item moved to [Backlog](../../backlog/USER_STORIES.md#us-backlog-01--org-level-policy-templates) along with the rest of US-0.4-03.)

## Open Questions Before v0.5

- What thresholds in run patterns or correction frequency should trigger divergence alerts in v0.5?
- Which v0.4 changelog event kinds become inputs to v0.5's correction-to-code analysis?
- Should chat sessions themselves be first-class audit objects, or remain attached to the PR they produced?
- How do we expose the audit timeline outside the UI (e.g., to a customer's SIEM) before v0.5 demands it?
