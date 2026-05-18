# Tembo Agent Studio v0.5: From Usage to Evolution

*Draft — internal review*

Every agent starts smart and gets dumber.

Not because the model regresses, but because the world moves: new vendor names, new tone preferences, new edge cases, new regulations. The first version captures what was true on launch day. Day 90, you're patching it manually. Day 180, you're not patching it at all and your team has stopped clicking "thumbs down" because nothing happens when they do.

TAS v0.5 is the release that fixes this — within a single TAS deployment — without sacrificing the audit trail and access discipline we built in v0.4. (Sharing what you've learned with *other* TAS deployments is its own conversation: [v0.6 Mycelium](../0.6/).)

## The Loop, Closed

In v0.5, a correction is not just a thumbs-down. It's a structured event:

1. A user marks an output wrong and provides a correction.
2. TAS captures the original, the correction, and the surrounding run context.
3. A Tembo coding agent classifies the correction (style / fact / scope / policy) and either:
   - opens a targeted PR against the agent definition,
   - recommends a variant if the correction conflicts with established behavior, or
   - flags the correction for human review.
4. The PR flows through the same review policy as any other change. The same v0.4 `who/when/why` audit timeline records it, and the same RBAC governs who can merge it.

Operators get a one-click **Modify + Rerun**: merge the queued PR (subject to policy), reload the agent, and rerun the previous input — diffed against the original output side-by-side.

## When Preferences Conflict

Adaptive agents usually fail in one of two ways:

1. They average conflicting feedback into a mush nobody asked for.
2. They overfit to whoever clicked most recently.

v0.5 introduces **variants** for this exact problem. When TAS detects that incoming corrections conflict with the agent's established direction along a clear axis (region, team, brand, tier), it proposes a variant instead of merging the change into the base.

Variants have parents, scopes, and audit history. Admins can later **reconcile** (merge a variant back) or **speciate** (commit a variant as its own line) — both explicit, both audited.

The operating principle: **adaptation is allowed, drift is governed.**

## What v0.5 Is Not

- Not autonomous self-modification. Every change is a PR.
- Not a behavioral A/B testing framework — that's a separate, later conversation.
- Not a way to bypass v0.4 governance. Every correction and variant lands in the same changelog, under the same RBAC.
- Not cross-deployment shared learning. That's [v0.6 (Mycelium)](../0.6/) — a deliberately separate, opt-in capability.

## Why This Order

We could have shipped correction-to-code as v0.1's headline feature. Several of our competitors did. None of them are still in production at the customers we talk to.

The reason is simple: adaptive systems without audit substrate are how customers get burned, and a burned customer doesn't come back. v0.1 paid the deploy bill. v0.2 paid the velocity bill. v0.3 paid the operator bill. v0.4 paid the audit and access bill. v0.5 collects on all four — inside a single deployment, where the boundaries are clearest.

## What's Next

v0.5 is the close of the intra-deployment arc. [v0.6 (Mycelium)](../0.6/) extends the same loop *across* deployments — optional, policy-governed pattern exchange between TAS instances. Beyond that, our roadmap shifts to depth in specific verticals (regulated industries, multilingual operations) and to platform extensibility, planned in their own phase documents when the time comes.

If v0.1 proved TAS can run, v0.2 proved TAS can iterate, v0.3 proved TAS can be operated, and v0.4 proved TAS can be trusted, v0.5 proves TAS can *grow* — under your team's control, on your audit trail.
