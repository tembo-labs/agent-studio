# Tembo Agent Studio

> Status: **pre-v0.1** — planning and definition phase.

## What this is, in plain English

Imagine your team has a handful of "AI assistants" — one answers customer email, one triages support tickets, one drafts internal reports. Today, those assistants probably live inside some vendor's website. Someone with a login edits a prompt. Nobody is sure what changed, when, or why. When the assistant says something embarrassing, nobody can rewind it. When a new team wants their own assistant, you start from zero.

**Tembo Agent Studio (TAS) is the control room for those assistants.**

You run it inside your own walls. Your people log in with the same accounts they already use. The assistants themselves are described in plain files, stored in a Git repository **you own** — the same way you store the rest of your code. When someone wants to change how an assistant behaves, they describe it in chat. TAS turns that description into a pull request. Your team reviews the diff like any other change. When it's merged, the new behavior is live. When an end user clicks "this answer was wrong," that correction can become its own PR, too.

No black box. No console drift. No "what did this prompt look like last Tuesday?"

## The bigger idea

Most teams treat agents like toys: clever demos that live outside the rules. The ones that try to make agents serious usually do it by ripping up the rules — bypassing review, hiding edits, locking definitions inside vendor SaaS, and calling the result "magic."

We think that trade is unnecessary. Software engineering already solved most of these problems decades ago: version control, code review, audit logs, identity, role-based access. Agents don't need a parallel universe. They need to **inherit** the discipline you already use for production systems — and then go faster *because* of it, not in spite of it.

That belief shapes every part of the product:

1. **Git is the system of record.** Agent definitions live in a repository you own.
2. **Every change is reviewable.** Whether the author was an engineer in their editor, a PM in chat, or an end user clicking "correct this" — the artifact is a PR.
3. **Adaptation is allowed; drift is governed.** Agents are allowed to evolve. They are not allowed to evolve in ways you can't explain.
4. **Self-hostable first.** Identity, data, and runtime stay inside your environment.

## What gives it superpowers: the Tembo Coding Agent Platform

TAS is the control plane — identity, repos, runs, audits, policy. But the *magic* — reading an agent definition, understanding what someone wants changed in plain English, and writing a clean diff for it — that's the [Tembo Coding Agent Platform](https://tembo.io). TAS calls out to Tembo coding agents the way a CI system calls out to compilers.

The dependency is light in Phase 0.1 (you plug in a Tembo API key and runs work). It becomes the engine of the product as we go:

- **Phase 0.2 — chat to PR.** A Tembo coding agent reads the existing definition, the chat context, and the change request, then opens a targeted pull request.
- **Phase 0.4 — corrections to PR.** A Tembo coding agent turns end-user corrections into candidate PRs.
- **Phase 0.4 — variant proposals.** A Tembo coding agent helps detect divergence and propose a variant rather than silently averaging incompatible behaviors.
- **Phase 0.5 — Mycelium.** Patterns proven in one TAS deployment can flow — by explicit policy — to another, attribution and provenance preserved.

TAS keeps the work governed; Tembo makes the work possible. The two are designed together.

## How we're building it: five phases

TAS reaches users as one product. Internally, we're building it in five phases — a construction plan, not a release train. Each phase is a coherent slab of capability that the next one builds on; sequencing them this way is how we keep the floor trustworthy before we add the floors above it.

### [Phase 0.1 — Foundation](./context/0.1/) · *The trustworthy floor*

Build the floor first: a self-hosted deploy, identity through your IdP, a Git repo wired to a workspace, and a baseline agent that runs reliably with readable logs. Nothing flashy. Everything that follows depends on this layer being dependable, so this is where we resist the urge to demo authoring before runs are solid.

### [Phase 0.2 — Authoring velocity](./context/0.2/) · *Chat to PR*

Build the loop that lets a non-engineer change an agent without an engineering queue. They describe the change in chat; a Tembo coding agent reads the existing definition, produces a targeted diff, and opens a pull request. Reviewers approve or comment. On merge, the new behavior is live. The PR is the contract — even when the author wasn't human.

### [Phase 0.3 — Governance depth](./context/0.3/) · *Explain everything*

Build the audit and operational surface that fast authoring demands: an immutable `who/when/why` changelog, rich human-in-the-loop forms (uploads, conditional fields, validation), per-agent operational dashboards, and role-based access with org-level policy templates. The bar is one screen, not four days of spelunking, to answer "who changed this, when, and why?"

### [Phase 0.4 — Adaptive intelligence](./context/0.4/) · *Corrections and variants*

Build the closed loop inside a single TAS deployment. When an end user corrects an output, TAS bundles the original, the correction, and the run context, and a coding agent proposes a targeted PR. When two teams want incompatible behaviors, TAS proposes a **variant** rather than silently averaging. Every adaptive change is still a PR. Adaptation is allowed; drift is governed.

### [Phase 0.5 — Mycelium](./context/0.5/) · *Cross-deployment learning, by policy*

Build the optional inter-deployment substrate. Tembo Mycelium lets TAS instances exchange patterns — never raw data — under explicit policy: island, share patterns only, share + receive, or receive only. Bilateral or group-policy, never a public marketplace. Attribution and provenance travel with every pattern, and every import lands in the same v0.3 changelog as any other change. The default is island; opting in is a deliberate org-admin action.

## Where to read more

- [`context/README.md`](./context/README.md) — strategy overview and phase index
- [`context/0.1/`](./context/0.1/) — Foundation (deploy, auth, connect, run)
- [`context/0.2/`](./context/0.2/) — Authoring velocity (chat → PR)
- [`context/0.3/`](./context/0.3/) — Governance (audit, HITL, dashboards)
- [`context/0.4/`](./context/0.4/) — Adaptive intelligence (corrections, variants)
- [`context/0.5/`](./context/0.5/) — Mycelium (cross-deployment shared learning)

Each phase folder contains a PRFAQ-style `README.md`, a `BLOG_POST.md` external announcement draft, a `USER_STORIES.md`, and a `DEMO_SCRIPT.md`.
