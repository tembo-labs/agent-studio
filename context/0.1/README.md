# Tembo Agent Studio

> **Headline:** TAS is the smallest deployable footprint that proves a team can run an agent inside their own environment, on their own identity, against their own repo — repeatedly.
>
> **Audience:** platform/IT teams running an internal pilot.

## Problem

Three things break in every early agent rollout:

1. **Identity is bolted on.** Most agent tools assume their own login or expect SSO to be added later. Security teams stall pilots while this gets sorted.
2. **Definitions drift.** Agents end up living in some SaaS console with no version history. A junior changes a prompt and nobody can answer "what did this look like last Tuesday?"
3. **Runs are opaque.** "It worked on my laptop" is not an operational story. Without a run log a team trusts, no second team adopts it.

These are not glamorous problems, but they decide whether a tool gets a second project. Every later TAS phase (chat authoring, governance, adaptive learning) inherits fragility if TAS cannot be trusted.

## Our Solution

A self-hosted TAS instance that:

- deploys with a documented Docker path,
- authenticates users through `better-auth` (so existing IdPs plug in),
- pairs each workspace with a Git repo and a Tembo API key at onboarding,
- lets an operator create or import a baseline agent definition,
- runs that agent manually and shows status + logs that a human can actually read.

We are not trying to be impressive yet. We are trying to be dependable enough that a team commits to the next phase.

## What is Shipped

- **Self-hosted deploy.** Docker Compose path + environment variable reference. Single-node target.
- **`better-auth` integration.** Email/password baseline plus SSO adapter slots so customers can wire their own IdP.
- **Workspace onboarding.** Connect one Git repository and store one Tembo API key per workspace.
- **Baseline agent definition.** Create from a starter template (Pydantic AI `AgentSpec` YAML by default; Cargo AI JSON also supplied), import an existing Pydantic AI or Cargo AI definition, or point at an existing code-defined agent (e.g., a Python module using the OpenAI Agents SDK, Pydantic AI's code mode, LangGraph, CrewAI, or a TypeScript module using Mastra). See [`AGENT_FORMAT.md`](./AGENT_FORMAT.md) for the format decision and which formats are wired in v0.1 vs v0.1+.
- **Manual run + logs.** "Run now" button, status (queued/running/succeeded/failed), tail of run output.

## Out of Scope for v0.1

- Chat-driven authoring (v0.2).
- PR-output workflows (v0.2).
- Immutable `who/when/why` audit (v0.3).
- Rich HITL forms (v0.3).
- Correction-to-code and variant lifecycle (v0.4).
- Mycelium shared learning (v0.4).

If a user asks for any of the above during v0.1 evaluation, the answer is "on the roadmap" with a link to the relevant phase doc — never "soon."

## Strategy

Build the minimum trustworthy control plane first. Resist the temptation to demo authoring before runs are reliable; the rest of the product depends on that floor.

## Technical Details

- **Frontend:** Next.js 15 + Tailwind + shadcn/ui.
- **Backend:** Rust API for runtime and orchestration.
- **Auth:** `better-auth` with adapter slots for SAML/OIDC.
- **Tembo integration:** API-key mode (a future phase may add MCP-based auth when public MCP is stable).
- **Agent format:** TAS supports multiple formats. Two declarative defaults — Pydantic AI `AgentSpec` (YAML or JSON) and Cargo AI JSON — ship as starters. Code-defined frameworks (LangGraph, OpenAI Agents SDK, Mastra, CrewAI, Pydantic AI's code mode) are also first-class supported, because complex agents need custom code. The PR policy engine (review-required vs YOLO auto-merge, per agent) and the production-promotion gate handle governance regardless of format. See [`AGENT_FORMAT.md`](./AGENT_FORMAT.md) for the full framework matrix and the development-vs-production policy model. Format is treated as an implementation detail in v0.1 — users do not need to learn any of them to import a starter template.
- **Storage:** workspace-local Postgres for run metadata; Git for agent source.

## Customer Quote (Drafted)

> "Before TAS, our 'agent' was a Python script someone ran from their laptop. Tembo Agent Studio gave us a real deploy, SSO that our security team already approved, and a Git repo we audit like any other service. That alone made it a different conversation internally."
>
> — _Director of Platform Engineering, mid-sized financial services firm_

## FAQ

### Who should adopt Tembo Agent Studio?

Platform and IT teams preparing an internal pilot — typically the people who would otherwise be reviewing a vendor's SOC2 report before letting product teams touch it.

### Why not include chat authoring yet?

Authoring speed without operational reliability creates downstream governance and trust failures. Skipping v0.1 to chase v0.2 is the most common failure mode for this product category.

### What proves success in this phase?

Three things, in order: (1) a security review passes, (2) the same workspace produces ten consecutive successful runs over a week, (3) at least one second team in the same org asks to be onboarded.

### Is this just a wrapper around an LLM call?

No. TAS is the control plane: identity, repo wiring, runs, observability. The actual model invocations happen inside agent definitions that live in the customer's repo.

### What does "manual run" actually mean?

A user picks an agent, clicks "Run", and watches a status panel. No scheduling, no chat, no PR generation. That all comes later.

## Exit Bar (Definition of Done for v0.1)

- [ ] A new team can complete the deploy → auth → connect → run flow in under 30 minutes with the published docs.
- [ ] At least one external pilot customer has run an agent in their own environment.
- [ ] Failure modes (bad API key, repo wiring issue, run crash) produce actionable error messages, not stack traces.
- [ ] Auth integrates with at least one non-trivial IdP (e.g. Okta, Azure AD) in a documented way.

## Open Questions Before v0.2

- Which default PR policy should be preselected at workspace onboarding when v0.2 ships?
- What minimum run metadata must already be visible in v0.1 so that v0.3's audit feature feels like an extension, not a rewrite?
- Should we ship a "starter agent library" in v0.1, or hold those until chat authoring exists?
