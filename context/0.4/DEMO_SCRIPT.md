# v0.4 Demo Script

**Target audience:** prospective customer with a live agent in production at a v0.3 baseline — typically a product owner, an EM, and an enterprise architect.
**Target duration:** 35–45 minutes (the longest demo in the series; consider splitting if time-boxed).
**Goal of the demo:** prove that adaptation can be both fast and governed, and that Mycelium is a real choice — not a default surprise.

## Pre-Demo Checklist (Off-Screen)

- Workspace at v0.3 baseline, with at least one `customer-reply` agent in heavy use.
- Three pre-staged corrections from "end users":
  - Two corrections aligned on tone (informal → more formal). Used in the correction-to-PR segment.
  - Three corrections that conflict on tone across two scopes (`team-eu`: formal, `team-us`: informal). Used for divergence.
- A `regulatory-drafting` agent with correction capture disabled (for the toggle demo).
- A partner TAS instance set up for Mycelium pattern exchange (or recorded video if a real partner isn't available).
- Org Mycelium policy currently set to **island**.

## Flow (with rough timings)

### 1. 90-second recap of v0.3 (0:00 – 1:30)
**Say:**
> "Three weeks since v0.3, this customer is shipping changes via chat, every change is in the audit timeline, and ops engineers triage from the per-agent dashboard. Today is v0.4 — what happens when *end users* drive change, not just operators."

### 2. End-user correction → PR (1:30 – 9:00)
**Show:** an end-user view of a customer-reply output that's slightly off.
**Do:**
- Click "this isn't right" → fill the correction form with the desired tone fix and a one-line rationale.
- Submit.
- Switch to the operator view → show the correction event in the v0.3 changelog.
- Show the queued PR (chat session-style description + targeted diff).

**Say:**
> "Three things to notice. One: the end user's intent is preserved verbatim on the PR. Two: this lands in the same changelog every other change lands in — there is no separate 'AI changes' surface to audit. Three: the system told the end user a PR was opened, so they don't think their feedback disappeared."

### 3. Modify + Rerun (9:00 – 14:00)
**Do:**
- On the operator view, click **Modify + Rerun** on the queued PR.
- The PR merges (this agent has auto-merge-on-green from v0.2), the agent reloads, the previous input is rerun.
- Show the side-by-side: original output vs new output.

**Say:**
> "This is the operator loop in one click. The composite changelog event ties correction → merge → rerun together. Three weeks ago this would have been a ticket."

### 4. Conflict surfaces a variant (14:00 – 24:00)
**Do:**
- Submit two more "end-user corrections" from `team-eu` operators asking for a more formal tone.
- Submit two more from `team-us` asking for a more casual tone.
- Show the divergence detection proposal that appears.

**Show:**
- Linked corrections.
- Suggested variant scope (`team-eu`).
- Recommended parent.

**Do:** accept the proposal. Show the new variant in the agent list and lineage view.
**Say:**
> "We could have averaged the feedback into one definition. We deliberately don't. Conflicting preferences usually mean real structural differences — region, brand, audience. Variants make that explicit and audited instead of hiding it."

### 5. Lineage and admin actions (24:00 – 30:00)
**Show:** the lineage view: parent `customer-reply`, variant `customer-reply [team-eu]`.
**Do:**
- Hover the variant → show creation reason, scope, recent corrections, conflict counter.
- Walk through (without executing) the **Reconcile** action (merge variant back) and the **Speciate** action (commit variant as its own line).
**Say:**
> "Variants are not a one-way door. Admins can pull them back or commit them out — both are explicit, both are audited."

### 6. Correction capture off for sensitive agents (30:00 – 33:00)
**Show:** the `regulatory-drafting` agent's settings.
**Do:** show "Correction capture: disabled" with the audit entry. Switch to an end-user view of that agent — the correction UI is hidden.
**Say:**
> "Not every agent should accept user-driven adaptation. Regulated drafting is the easy example. The toggle is per-agent and the change is audited like any other."

### 7. Mycelium policy (33:00 – 40:00)
**Show:** org-level Mycelium settings, currently set to **island**.
**Do:**
- Walk through the four policy levels (island / share patterns only / share + receive / receive only).
- Flip the org policy to **share patterns only** with a partner-deployment relationship.
- Show one pattern outbound (attribution + provenance), one pattern inbound (preserved attribution).

**Say:**
> "Mycelium is opt-in. Default is island. For regulated customers, 'share patterns only' is the level we recommend — anonymized behavioral patterns, no data. There is no central marketplace. Bilateral or group-policy only."

### 8. Wrap and post-v0.4 pointer (40:00 – 45:00)
**Show:** the four-phase roadmap, completed.
**Say:**
> "v0.4 is the close of the founding arc. v0.1 made TAS deployable, v0.2 made it iterable, v0.3 made it auditable, v0.4 made it adaptive — all on the same surfaces. Beyond this is depth in specific industries and platform extensibility, planned as standalone work."

## Live-Demo Failure Plan

| If… | Then say… |
| --- | --------- |
| The correction-to-PR step produces a bad PR | "Worth seeing — same as a junior engineer's first PR. Reviewer rejects, correction stays in the changelog, no auto-retry on the same bad output." |
| Divergence detection doesn't fire on the staged corrections | "Thresholds are tunable per agent. Let me trigger the manual 'propose variant' path so we can show the lifecycle anyway." |
| Mycelium pattern exchange fails live | Cut to recorded video. Acknowledge: "Mycelium is the v0.4 capability that benefits most from being seen in real use rather than scripted — we can run a guided pilot with your team." |

## Success Criteria (Demo)

- An end-user correction produces a live PR with a targeted diff.
- Modify + Rerun is executed live with a visible behavioral difference.
- A variant is created (via accepted divergence proposal **or** manual creation) and the lineage view is shown.
- Mycelium policy is configured live, with the audit entry visible.
- The audience leaves understanding "adaptation is allowed; drift is governed" — not just "TAS does AI."

## Common Questions & Crisp Answers

- **"Will the model adapt without us approving every change?"** No. Every adaptation is a PR. PR policy from v0.2 governs whether review is required.
- **"Can we opt out of correction-to-code on specific agents?"** Yes — per-agent toggle. Other agents in the workspace are unaffected.
- **"What goes in a Mycelium pattern?"** Anonymized behavioral patterns by default. No data, no user content. Attribution metadata travels with the pattern.
- **"What's after v0.4?"** Depth in specific verticals and platform extensibility. We'll publish phase docs when that work is planned, not before.
- **"Does v0.4 require us to upgrade our LLM provider?"** No. TAS routes through whichever coding model your customer has configured — we treat that as substitutable.
