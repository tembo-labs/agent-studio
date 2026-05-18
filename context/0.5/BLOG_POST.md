# Tembo Agent Studio v0.5: Mycelium — Shared Learning, On Your Terms

*Draft — internal review*

Two TAS deployments, in the same industry, solving the same problem in parallel.

Neither knows. Both pay the iteration cost. The pattern that hardened over three months at one customer is invisible to a peer customer who would have happily traded notes — if there had been a safe way to.

TAS v0.5 introduces **Tembo Mycelium**, the optional substrate for that exchange. Everything we built through v0.4 — corrections-as-PRs, variants, the v0.3 audit timeline — was the closed loop *inside* a single deployment. Mycelium extends that loop *between* deployments. Optionally. Under explicit policy. Without ever turning trust into a default.

## Why Mycelium is its Own Phase

We considered shipping Mycelium inside v0.4. We decided not to, on purpose.

Mycelium is a fundamentally different trust conversation. v0.1–v0.4 ask: *can you trust this system to manage your agents inside your walls?* Mycelium asks: *under what conditions, if any, do you want this system to exchange behavior with another organization's deployment?*

Bundling those questions invites the wrong answer. Most enterprise customers will say "no" reflexively to any feature that smells like cross-tenant flow, and then dismiss the rest of the product because of it. By making Mycelium an explicit, separately-planned, off-by-default capability, we make "stay in island mode forever" a first-class choice — not a stepchild.

## Four Policy Levels

Mycelium is governed by org-level policy. Workspaces inherit and can only select more conservative settings, never more permissive ones.

- **Island.** Nothing leaves. Nothing enters. **Default.** Many customers will stay here indefinitely, and that's a supported outcome.
- **Share patterns only.** Anonymized behavioral patterns flow outbound; nothing inbound. For organizations that want to contribute without absorbing external influence.
- **Share + receive.** Two-way exchange with attribution required on both sides.
- **Receive only.** Import patterns from a partner deployment without contributing.

There is no centralized "marketplace" of agents. Mycelium is bilateral or group-policy. Attribution and provenance travel with every pattern. Imports never bypass review — they land as PRs on the receiving deployment, scored and labeled as Mycelium-sourced.

## What a Pattern Is (and Isn't)

A **pattern** is a structured, anonymized behavioral signal — for example, the shape of a successful variant scope, or a classified correction pattern. No raw prompts. No user content. No PII.

This is the boundary that makes Mycelium *not* a data-sharing feature. Patterns are about *what worked*, not *what was said*. The schema is versioned, designed with backward-compatible reads, and reviewed by regulated-customer compliance teams before v0.5 GA.

## Audit, Inherited

Mycelium imports land in the same v0.3 changelog as every other change. There is no separate "AI changes" surface or "Mycelium activity" tab. An auditor asking "where did this behavior come from?" gets the same answer for an internal correction, an engineer's PR, and a Mycelium-sourced import: the changelog, with attribution.

This was a hard constraint, not an aesthetic one. The moment Mycelium gets its own audit surface, it stops being trustworthy.

## What v0.5 Is Not

- Not a public marketplace or registry of agents.
- Not data sharing. Patterns are anonymized behavioral signals, full stop.
- Not federated agent execution. v0.5 exchanges patterns between deployments; it does not execute agents across them.
- Not on by default. Default is, and will remain, island.
- Not a bypass for v0.4 review surfaces. Imports produce PRs.

## Why This Order

We could have shipped Mycelium earlier. We chose not to because the trust ladder runs the other way:

- v0.1 earns trust to **deploy**.
- v0.2 earns trust to **iterate quickly**.
- v0.3 earns trust to **explain every change**.
- v0.4 earns trust to **adapt from end-user signal**.
- v0.5 earns trust to **learn beyond your own walls** — and only because the four steps below it are solid.

A customer who reaches v0.5 has already seen TAS adapt under their own audit trail for months. The question Mycelium asks them is qualitatively different at that point.

## What's Next

Beyond v0.5, the roadmap shifts to depth in specific verticals (regulated industries, multilingual operations) and to platform extensibility. Those will get their own phase documents when planned.

If v0.4 proved TAS can grow, v0.5 proves TAS can grow *together with peer deployments* — never by default, never without attribution, always under your audit trail.
