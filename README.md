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
5. **Ship value in every phase.** Each release stands on its own. None of them are checkpoints toward a distant launch.

## How we get there: four phases

TAS ships in four phases. Each one is a complete product on its own — a team could stop at any of them and still be better off than they were before. Later phases compound the earlier ones; they don't replace them.

### [Phase 0.1 — Foundation](./context/0.1/) · *Run an agent you trust*

The minimum trustworthy floor. Deploy TAS, sign in with your identity provider, connect a Git repo and a Tembo API key, import or scaffold an agent, click "Run," watch the logs. Nothing flashy — just an agent running inside your environment, on your identity, against your repo, **dependably**. This is the floor every later phase stands on.

### [Phase 0.2 — Authoring velocity](./context/0.2/) · *Change agents from chat — without giving up review*

Now the bottleneck moves. Deploy is solved; the new wait is "who has time to edit the prompt?" v0.2 lets a non-engineer describe a change in chat. A Tembo coding agent reads the existing definition, produces a targeted diff, and opens a pull request. Your team reviews the diff. On merge, the new behavior is live. For low-stakes internal automations, you can opt into auto-merge on green CI. The PR is the contract — even when the author wasn't human.

### [Phase 0.3 — Governance depth](./context/0.3/) · *Explain every change, every run, every human action*

Once changes are flowing in minutes instead of weeks, the audit surface has to catch up. v0.3 adds an immutable `who/when/why` changelog, rich human-in-the-loop forms (uploads, conditional fields, validation), per-agent operational dashboards, and role-based access with org-level policy templates. When the auditor asks "who changed this, when, and why?" — you answer in one screen, not four days of spelunking.

### [Phase 0.4 — Adaptive intelligence](./context/0.4/) · *Agents that learn — and stay accountable*

The agent you ship is not the agent you'll run six months later. v0.4 closes the loop: when an end user corrects an output, TAS bundles the original, the correction, and the run context, and a coding agent proposes a targeted PR. When two teams want incompatible behaviors, TAS proposes a **variant** rather than silently averaging. And — optionally — Tembo Mycelium lets TAS deployments learn from each other, with attribution, provenance, and the right to stay in island mode forever. Every adaptive change is still a PR. Adaptation is allowed; drift is governed.

## Where to read more

- [`context/README.md`](./context/README.md) — strategy overview and phase index
- [`context/0.1/`](./context/0.1/) — Foundation (deploy, auth, connect, run)
- [`context/0.2/`](./context/0.2/) — Authoring velocity (chat → PR)
- [`context/0.3/`](./context/0.3/) — Governance (audit, HITL, dashboards)
- [`context/0.4/`](./context/0.4/) — Adaptive intelligence (corrections, variants, Mycelium)

Each phase folder contains a PRFAQ-style `README.md`, a `BLOG_POST.md` external announcement draft, a `USER_STORIES.md`, and a `DEMO_SCRIPT.md`.
