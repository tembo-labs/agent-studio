# Introducing Tembo Agent Studio

The first agent your team puts into production is rarely the one anyone demoed. It is the one that survived a security review, a runtime outage, an SSO migration, and a question from compliance about who changed line 47 of the prompt last Tuesday.

That is the audience Tembo Agent Studio is built for.

## What Tembo Agent Studio Is — and Isn't

We aim to give a platform team the answer to four questions their security and operations peers will ask before any of the rest matters:

1. Where does the agent run? _In your environment. Self-hosted via Docker._
2. Who can sign in? _Whoever your IdP says — TAS auth runs with SAML/OIDC adapters._
3. Where do agent definitions live? _In a Git repo, that your team owns._
4. Can a user actually run an agent today and see what happened? _Yes — manual run, status, logs._

That's it. Nothing else ships in v0.1, and that restraint is the point.

Most agent platforms fail in the same way: the demo nails authoring, but the system can't survive its first real audit. Identity is bolted on. Definitions live in a SaaS console with no version history. Runs are opaque.

We've decided the order of operations matters more than the shape of the v1 demo. Get the boring layer right, and every later phase compounds on top of it. Get it wrong, and even great authoring won't save you.

## What a Pilot Looks Like

A typical pilot has four steps, often spread across a week:

1. **Day 1 — Deploy.** Platform team brings up TAS via Docker in a sandbox environment. Security skims the threat model.
2. **Day 2 — Auth.** Wire up the IdP.
3. **Day 3 — Connect.** Workspace admin links a Git repo and stores a Tembo API key.
4. **Day 4–5 — Run.** Scaffold an agent. Run it. Read the logs. Run it ten more times.

If those five days go cleanly, the next conversation is about which team gets onboarded next — and what else they need.

## What's Next

- **v0.2 — Authoring velocity.** Describe an agent in chat. TAS generates a PR. Reviewers see a diff, not a black box.
- **v0.3 — Governance depth.** Immutable `who/when/why` audit, rich human-in-the-loop (HITL) forms, per-agent dashboards.
- **v0.4 — Adaptive intelligence.** End-user corrections become targeted PRs. Variants manage divergence. Mycelium (optional) connects deployments for shared learning.

---

_Want to pilot? Reach out to the Tembo team._
