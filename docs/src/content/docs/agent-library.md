---
title: Agent library
description: A browsable catalog of ready-made starter agents, ranked by the connections you already have — pick one and it pre-fills the New Agent form.
---

The **Agent library** is the fastest way to stand up your first agents. It's a
browsable catalog of ready-made starters — each a one-task agent with a
copy-paste-ready build prompt — surfaced so the ones you can actually run, given
what you've connected, come first. Open it from **Library** in the sidebar.

## Connection-aware ranking

The library knows which [connections](/agent-studio/connections/) you have, and
ranks starters accordingly. Each card shows its required connections as chips:

- **Ready** — you have every connection it needs; it sorts to the top.
- **Connect _X_** — it needs a connection you can add (the chip links to
  Connections).
- **Not yet** — it needs a category Tembo doesn't connect to yet.

A brand-new workspace still sees the whole library — connect your tools and watch
starters light up as **Ready**. Built-in capabilities (web search and the
[Tasks Inbox](/agent-studio/tasks-inbox/)) never count against readiness.

## Browse by work area, label, or connection

Three facets narrow the list, plus a search box and a **Ready for my
connections** toggle:

- **Work area** — the function it serves (Sales / SDR, Customer Success, RevOps,
  Finance, IT, HR, and more).
- **Label** — primarily the starter's **archetype** (its shape of work), plus
  "New idea" for recent additions.
- **Connection** — show only starters that use a given connection — e.g.
  everything that touches a CRM, or a call recorder.

## Archetypes

Every starter follows one of a small set of archetypes — a proven shape of work
with built-in guardrails. The guardrails are what make these safe first agents:
most are read-only or draft-only, with a human in the loop.

| Archetype | What it does | Guardrail |
| --- | --- | --- |
| **Monitor & Alert** | Watch a source, evaluate a condition, notify an owner | Read-only; never writes back |
| **Hygiene & Flag** | Scan records for a quality problem; flag offenders | Flags, never auto-fixes |
| **Capture & Structure** | Turn unstructured input into a structured record | Asks rather than guessing |
| **Draft** | Assemble context into a draft for review | Never sends or publishes |
| **Knowledge Q&A** | Answer questions from approved sources | Cites sources; no speculation |
| **Workflow Trigger** | On an event, kick off the next steps | Scoped, idempotent steps |
| **Summarize & Digest** | Roll many items into one summary | Read-only |
| **Reconcile** | Compare two systems; surface mismatches | Read-only; flags differences |
| **Extract** | Pull structured fields out of documents | Stages low-confidence values |

## From a starter to a running agent

1. Click **Use this** on a starter. The New Agent form opens, pre-filled with the
   starter's name and its full build prompt.
2. Edit anything — tweak the prompt, rename it, adjust the scope.
3. Click **Create**. Tembo's coding agent writes the agent file and opens a pull
   request (or commits directly), exactly like
   [authoring any agent](/agent-studio/authoring-agents/).
4. Review and merge. [Connect](/agent-studio/connections/) anything still
   missing, then [schedule it](/agent-studio/automations-triggers/) to run on its
   own.

Many starters surface their findings into the
[Tasks Inbox](/agent-studio/tasks-inbox/) for you to review and act on.

## Library vs. Example Agents

The library is the in-app, connection-aware take on
[Example Agents](/agent-studio/example-agents/): the same idea — start from a
proven prompt — but browsable, ranked to what you can run, and one click to
pre-fill. The Example Agents page remains a handy copy-paste reference.

## Under the hood

Each starter is a small YAML file in the platform repo
(`web/src/lib/agent-library/`) — its title, build prompt, connection categories,
and labels. [Self-hosting](/agent-studio/admin-introduction/) instances can add
or edit starters, and they show up in the library on the next deploy.
