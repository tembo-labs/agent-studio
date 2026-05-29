# v0.4 Demo Script

> **Update (2026-05-27):** Org-level policy templates moved out of
> v0.4 to [Backlog](../../backlog/USER_STORIES.md#us-backlog-01--org-level-policy-templates).
> Section 4 (Policy templates and overrides) and the policy beats
> in success criteria + pre-demo checklist are stubbed out below.
> Re-enable when the substrate ships.

**Target audience:** prospective customer's compliance/security stakeholder plus the engineering manager who has already seen v0.2 and v0.3.
**Target duration:** 15–20 minutes (the policy section accounted for ~7 minutes of the original 22–28 estimate).
**Goal of the demo:** prove that v0.4 makes every change explainable — and puts access under explicit role boundaries — without slowing the v0.2 authoring loop or duplicating the v0.3 operator surface.

## Pre-Demo Checklist (Off-Screen)

- Workspace already at v0.3 baseline, with **at least 3 recent PR-driven changes** to one agent (creates realistic changelog history).
- A handful of v0.3 HITL form submissions and dashboard-visible state changes in the past week — to demonstrate that v0.3's structured events become first-class changelog entries in v0.4.
- ~~Org-level policy template `customer-facing-agents-require-review` already set; one workspace deviating from it.~~ *Removed — policy templates moved to backlog.*
- Two browser users: a workspace admin, and a viewer (to demo the deny path). *Original three-user setup included an org admin; drop until org tier exists.*

## Flow (with rough timings)

### 1. 60-second recap of v0.2 + v0.3 (0:00 – 1:00)
**Say:**
> "v0.2 made changes fast. v0.3 gave your operators a real surface to do their job. Today, v0.4 is what happens when your compliance team and your auditors arrive — and asks whether every one of those changes and every one of those operator actions can be explained, scoped, and bounded."

### 2. The changelog: who/when/why (1:00 – 8:00)
**Show:** the per-agent changelog view.
**Do:**
- Filter to "last 7 days".
- Click an event from a chat-authored PR → expand to show the chat session, the PR link, the reviewer, the merge time.
- Click an event from a v0.3 HITL form submission → show form fields submitted, actor, run reference.
- Click an event from a policy change → show actor and justification.

**Say:**
> "Every actor, every timestamp, every source — chat, PR, HITL response, dashboard event, policy change — lands here. The HITL response is the *same* event v0.3 emits; we put it under audit in v0.4 instead of re-instrumenting it. This is append-only at the storage layer. If something is wrong, we add a correction event; we don't rewrite history."

### 3. RBAC enforcement (8:00 – 13:00)
**Switch to:** the viewer-role user.
**Do:**
- Try to trigger a run via the UI — denied.
- Try the same via the API — denied with a clear error.
- Switch to the operator-role user — runs allowed, policy changes denied.
- Switch to the workspace admin — workspace-scoped policy changes allowed, cross-workspace denied.

**Say:**
> "Three built-in roles. Enforcement at the API layer — UI just mirrors API state. No 'we hid the button' safety nets. An org-admin tier and custom roles are deferred until concrete cross-workspace endpoints exist."

### 4. ~~Policy templates and overrides~~ — moved to backlog
> *Stubbed; this section re-enables when [US-BACKLOG-01](../../backlog/USER_STORIES.md#us-backlog-01--org-level-policy-templates) is scheduled into a phase.*

### 5. Audit export (13:00 – 17:00)
**Do:**
- Filter the changelog by a single agent over a 90-day window.
- Export to JSON.
- Show that a viewer's export would be scoped to entries they could see.

**Say:**
> "Per-agent JSON export at v0.4. Streaming to a SIEM is on the v0.5 open-questions list — if you have a preferred destination, bring it to the pilot."

### 6. Wrap and v0.5 pointer (17:00 – 20:00)
**Show:** the six-phase roadmap.
**Say:**
> "v0.4 closes the governance question. v0.5 opens the adaptive one — when an end user corrects an output, that correction becomes a PR, and lands in *this* changelog, using *this* RBAC. We deliberately built v0.4 first so v0.5 has somewhere safe to land."

## Live-Demo Failure Plan

| If… | Then say… |
| --- | --------- |
| API deny test doesn't return cleanly | "The enforcement is at the API layer — let me show you the policy unit (`web/scripts/rbac-policy.test.mjs`) that locks in the role-ordering invariant." |

## Success Criteria (Demo)

- A complete `who/when/why` story is shown end-to-end for at least one chat-authored change and one v0.3 HITL response.
- An RBAC denial is demonstrated live at both UI and API.
- The audience leaves understanding *why governance precedes adaptive intelligence* in the phase order.

## Common Questions & Crisp Answers

- **"Is the changelog exportable?"** Per-agent JSON export at v0.4. Streaming to a SIEM is on the v0.5 open-questions list — bring your preferred destination to the pilot.
- **"What about role permissions outside the three built-ins?"** An org-admin tier lands when concrete cross-workspace endpoints exist; custom roles past that are deferred past v0.6 unless a customer blocks. Org-level policy templates (the typical "fine-grained permission" extension) are tracked in [Backlog](../../backlog/USER_STORIES.md#us-backlog-01--org-level-policy-templates).
- **"Why isn't v0.5 first — adaptive demos better?"** Because adaptive systems without audit substrate are how customers get burned. We ship the substrate first, on purpose. v0.5 lands in this changelog.
- **"How does this relate to v0.6 Mycelium?"** Mycelium imports also land in this changelog with attribution. There's no separate "Mycelium activity" audit surface — it's the same trail.
