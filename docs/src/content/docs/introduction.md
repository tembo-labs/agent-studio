---
title: Introduction
description: What Tembo Agent Studio is and the principles behind it.
---

Tembo Agent Studio (TAS) is a **control plane for AI agents**. Agent definitions
live as files in a Git repository you own. Every change — whether an engineer
typed it, a PM described it in chat, or an end user clicked "this is wrong" —
flows through the same pull-request review your team already uses for code. Runs
and audit logs stay tied to your workspace.

Agents are software. Most teams treat them as something else: prompts edited in
vendor consoles, with no diff, no review, and no rewind. TAS lets agents inherit
the discipline you already use for production code — version control, code
review, audit logs, identity, and RBAC.

## Principles

- **Git is the system of record.** Agent definitions live in your repo.
- **Every change is a PR.** Human or AI author — the artifact is always a
  reviewable diff.
- **Adaptation is allowed; drift is governed.** Agents may evolve; they may not
  evolve in ways you can't explain.

## Who builds and maintains your agents

You don't have to be an engineer to create or evolve an agent. Authoring and
changes are handled by **Tembo**, an AI software engineering platform: describe
what you want in plain language — a new agent, a tweak, or "this run was wrong" —
and Tembo turns it into a reviewable pull request against your repo. It serves
everyone on the team, from operators to PMs to the people who use the agents, not
just developers — and it's backed by real human engineers at Tembo who step in
when a change needs them.

## What's in this manual

- **[Getting started](/agent-studio/getting-started/)** — sign in, pick a
  workspace, run your first agent.
- **[Core concepts](/agent-studio/core-concepts/)** — agents-as-code, the PR
  loop, frameworks, and versioning.
- **Building agents** — [authoring](/agent-studio/authoring-agents/),
  [agent lifecycle](/agent-studio/agent-lifecycle/), and
  [sidecar Python tools](/agent-studio/sidecar-python-tools/).
- **Running & automating** — [runs](/agent-studio/running-agents/) and
  [automations & triggers](/agent-studio/automations-triggers/).
- **Integrations** — [Connections](/agent-studio/connections/) and
  [Tools & Tool uses](/agent-studio/tools-and-tool-uses/).
- **Observability** — [Dashboard & Runs](/agent-studio/dashboard-and-runs/) and
  [Improvements](/agent-studio/improvements/).

Setting up or operating the instance? See the
[admin introduction](/agent-studio/admin-introduction/).

See the [Changelog](/agent-studio/changelog/) for what's shipped, by release,
and the [Roadmap](/agent-studio/roadmap/) for where it's headed.
