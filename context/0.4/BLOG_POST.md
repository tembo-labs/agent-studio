# Tembo Agent Studio v0.4: Governance as a First-Class Feature

*Draft — internal review*

By v0.4, our pilot customers have three things: fast authoring (v0.2), a real operator surface (v0.3), and a backlog of compliance questions they couldn't answer cleanly with either. They're no longer asking whether the platform can move fast — they're asking whether it can move fast *and* survive an auditor.

That's the audience v0.4 is for.

## What v0.4 Adds

- **Immutable `who/when/why` changelog.** Every agent change, run, human intervention, and policy switch is recorded with the actor, the time, and the originating intent.
- **Role-based access control.** Workspace admin → operator → viewer, enforced at the API layer.

(Org-level policy templates — the third capability originally scoped to v0.4 — moved to [Backlog](../backlog/USER_STORIES.md#us-backlog-01--org-level-policy-templates). The substrate is comparable in size to v0.3 Connections; the rest of v0.4 ships cleanly without it.)

## The Compliance Conversation v0.4 Closes Out

> "When auditors ask who approved the change that altered our customer-reply tone last quarter, we want to show them one screen — not start a four-day spelunking exercise."

v0.4 makes that one screen real. And it makes it the *same* screen — whether the change came from a chat-authored PR, an operator's hand edit, or (in v0.5) an end-user correction.

## Why Governance Before Adaptive

We could have gone to v0.5's adaptive intelligence next. The demo would have been flashier. We didn't, and the order is the strategy.

Adaptive systems rewrite source. The first time something goes wrong on a rewrite — and at scale, something will — the question is "who or what changed this, and why?" If the answer is "we don't fully know yet, audit is coming in v0.6," the customer doesn't come back. So governance lands first, *deliberately*, before the loop that needs it.

## What v0.4 Is Not

- Not the operator surface. HITL forms and per-agent dashboards shipped in [v0.3 (Operational surface)](../0.3/).
- Not the learning release. Correction-to-code is [v0.5 (Adaptive intelligence)](../0.5/).
- Not cross-deployment exchange. That's [v0.6 (Mycelium)](../0.6/), opt-in and off by default.
- Not a place where governance becomes optional — v0.4 raises the floor for the platform.

## Why Governance Is Its Own Phase

Most platforms treat governance as a v2 add-on or a customer-success problem. We disagree. The first time a v0.2 customer ships ten chat-authored changes in a week, the second question they ask (after "this is great") is "how do we explain this?"

If the answer is "we'll add audit later," the third question is "we'll evaluate later." Phase ordering is product strategy.

## Foundation for v0.5

v0.5 introduces correction-to-code: real user corrections become targeted PRs. That's only safe if every input to the loop — the correction, the actor, the surrounding run, the resulting PR — is already audited. v0.4 builds exactly that substrate, on top of the structured events v0.3 already emits.

## What's Next

- **v0.5 — Adaptive intelligence.** Corrections from end users become PRs. Variants manage divergence.
- **v0.6 — Mycelium.** Optional cross-deployment pattern exchange, under explicit policy.

If v0.1 proved TAS can run, v0.2 proved TAS can iterate, and v0.3 proved TAS can be operated, v0.4 proves TAS can be trusted at scale — and earns the right to ship adaptive loops on top.
