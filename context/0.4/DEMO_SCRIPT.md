# v0.4 Demo Script

**Target audience:** prospective customer's compliance/security stakeholder plus the engineering manager who has already seen v0.2 and v0.3.
**Target duration:** 22–28 minutes.
**Goal of the demo:** prove that v0.4 makes every change explainable — and puts access under explicit policy — without slowing the v0.2 authoring loop or duplicating the v0.3 operator surface.

## Pre-Demo Checklist (Off-Screen)

- Workspace already at v0.3 baseline, with **at least 3 recent PR-driven changes** to one agent (creates realistic changelog history).
- A handful of v0.3 HITL form submissions and dashboard-visible state changes in the past week — to demonstrate that v0.3's structured events become first-class changelog entries in v0.4.
- Org-level policy template `customer-facing-agents-require-review` already set; one workspace deviating from it (set up to demonstrate the override audit entry with justification).
- Three browser users: an org admin, a workspace admin, and a viewer (to demo the deny path).

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
> "Four built-in roles. Enforcement at the API layer — UI just mirrors API state. No 'we hid the button' safety nets. Custom roles are deferred; the four built-ins plus policy templates cover everything we've seen in pilots."

### 4. Policy templates and overrides (13:00 – 20:00)
**Switch to:** the org admin user.
**Show:**
- The org settings → policy templates list.
- The "Customer-facing agents require review" template.
- The list of workspaces and which are deviating.
- Click the deviating workspace → show the override audit entry with its justification.

**Do:**
- Edit the template to bump version; show the diff.
- Show the audit entry naming the actor and the policy delta.

**Say:**
> "Org admins set defaults; workspace admins can tighten but loosening requires a justification that lands in the audit trail. Policy templates themselves are versioned and audited — changing a policy is itself a change."

### 5. Audit export (20:00 – 24:00)
**Do:**
- Filter the changelog by a single agent over a 90-day window.
- Export to JSON.
- Show that a viewer's export would be scoped to entries they could see.

**Say:**
> "Per-agent JSON export at v0.4. Streaming to a SIEM is on the v0.5 open-questions list — if you have a preferred destination, bring it to the pilot."

### 6. Wrap and v0.5 pointer (24:00 – 28:00)
**Show:** the six-phase roadmap.
**Say:**
> "v0.4 closes the governance question. v0.5 opens the adaptive one — when an end user corrects an output, that correction becomes a PR, and lands in *this* changelog, using *this* RBAC. We deliberately built v0.4 first so v0.5 has somewhere safe to land."

## Live-Demo Failure Plan

| If… | Then say… |
| --- | --------- |
| The override audit entry is missing | "Let me show you yesterday's — same shape, real data." |
| API deny test doesn't return cleanly | "The enforcement is at the API layer — let me show you the test from CI that runs this nightly." |
| Policy diff renders awkwardly | "Visual polish — the underlying versioning is settled. Here's the JSON of the version transition." |

## Success Criteria (Demo)

- A complete `who/when/why` story is shown end-to-end for at least one chat-authored change and one v0.3 HITL response.
- An RBAC denial is demonstrated live at both UI and API.
- A policy override with required justification is shown end-to-end.
- The audience leaves understanding *why governance precedes adaptive intelligence* in the phase order.

## Common Questions & Crisp Answers

- **"Is the changelog exportable?"** Per-agent JSON export at v0.4. Streaming to a SIEM is on the v0.5 open-questions list — bring your preferred destination to the pilot.
- **"What about role permissions outside the four built-ins?"** Custom roles deferred past v0.6 unless a customer blocks on it; the policy template + per-workspace overrides cover most asks.
- **"Why isn't v0.5 first — adaptive demos better?"** Because adaptive systems without audit substrate are how customers get burned. We ship the substrate first, on purpose. v0.5 lands in this changelog.
- **"How does this relate to v0.6 Mycelium?"** Mycelium imports also land in this changelog with attribution. There's no separate "Mycelium activity" audit surface — it's the same trail.
