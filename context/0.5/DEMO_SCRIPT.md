# v0.5 Demo Script

**Target audience:** prospective customer with a live agent in production at a v0.4 baseline — typically a product owner and an EM.
**Target duration:** 25–35 minutes.
**Goal of the demo:** prove that adaptation can be both fast and governed *inside a single TAS deployment*. Cross-deployment learning (Mycelium) has its own demo in [v0.6](../0.6/DEMO_SCRIPT.md).

## Pre-Demo Checklist (Off-Screen)

- Workspace at v0.4 baseline, with at least one `customer-reply` agent in heavy use.
- Pre-staged corrections from "end users":
  - Two corrections aligned on tone (informal → more formal). Used in the correction-to-PR segment.
  - Four corrections that conflict on tone across two scopes (`team-eu`: formal, `team-us`: informal). Used for divergence.
- A `regulatory-drafting` agent with correction capture disabled (for the toggle demo).

## Flow (with rough timings)

### 1. 90-second recap of v0.4 (0:00 – 1:30)
**Say:**
> "Three weeks since v0.4 governance landed, this customer is shipping changes via chat, every change is in the audit timeline under explicit RBAC, and ops engineers triage from the per-agent dashboard we shipped in v0.3. Today is v0.5 — what happens when *end users* drive change, not just operators."

### 2. End-user correction → PR (1:30 – 9:00)
**Show:** an end-user view of a customer-reply output that's slightly off.
**Do:**
- Click "this isn't right" → fill the correction form with the desired tone fix and a one-line rationale.
- Submit.
- Switch to the operator view → show the correction event in the v0.4 changelog.
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

### 7. Wrap and pointer to v0.6 (33:00 – 35:00)
**Show:** the six-phase roadmap with 0.1–0.5 marked complete and 0.6 (Mycelium) queued.
**Say:**
> "v0.1 made TAS deployable, v0.2 made it iterable, v0.3 gave operators a real surface, v0.4 made it auditable, v0.5 made it adaptive — all inside one deployment. v0.6 (Mycelium) is the optional next step: letting two TAS deployments learn from each other under explicit policy. That's a separate conversation with a separate demo, because the trust model is different."

## Live-Demo Failure Plan

| If… | Then say… |
| --- | --------- |
| The correction-to-PR step produces a bad PR | "Worth seeing — same as a junior engineer's first PR. Reviewer rejects, correction stays in the changelog, no auto-retry on the same bad output." |
| Divergence detection doesn't fire on the staged corrections | "Thresholds are tunable per agent. Let me trigger the manual 'propose variant' path so we can show the lifecycle anyway." |

## Success Criteria (Demo)

- An end-user correction produces a live PR with a targeted diff.
- Modify + Rerun is executed live with a visible behavioral difference.
- A variant is created (via accepted divergence proposal **or** manual creation) and the lineage view is shown.
- The audience leaves understanding "adaptation is allowed; drift is governed" — not just "TAS does AI."

## Common Questions & Crisp Answers

- **"Will the model adapt without us approving every change?"** No. Every adaptation is a PR. PR policy from v0.2 and RBAC from v0.4 govern whether and by whom review is required.
- **"Can we opt out of correction-to-code on specific agents?"** Yes — per-agent toggle. Other agents in the workspace are unaffected.
- **"Can our agents learn from another company's TAS deployment?"** Only under v0.6 (Mycelium), which is opt-in and off by default. v0.5 stays inside your deployment on purpose.
- **"What's after v0.5?"** v0.6 (Mycelium), then depth in specific verticals and platform extensibility.
- **"Does v0.5 require us to upgrade our LLM provider?"** No. TAS routes through whichever coding model your customer has configured — we treat that as substitutable.
