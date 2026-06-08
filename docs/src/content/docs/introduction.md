---
title: Introduction
description: What Tembo Agent Studio is, the principles behind it, and how it fits with the Tembo Coding Agent Platform.
---

Tembo Agent Studio (TAS) is a **self-hosted control plane for AI agents**. Agent
definitions live as files in a Git repository you own. Every change — whether an
engineer typed it, a PM described it in chat, or an end user clicked "this is
wrong" — flows through the same pull-request review your team already uses for
code. Runs, audit logs, and identity stay inside your environment.

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
- **Self-hostable first.** Identity, data, and runtime stay inside your
  environment.

## How it fits with Tembo

TAS is the **control plane**. The authoring step — turning a chat message into a
diff — is delegated to the [Tembo Coding Agent Platform](https://tembo.io). You
plug a Tembo API key into workspace settings, and TAS uses it to open pull
requests against your repo: new agents from chat, and "improve the agent"
submissions from any run. TAS calls out to Tembo coding agents the way a CI
system calls out to compilers.

## What's in this manual

This manual covers using a deployed TAS instance:

- **[Getting started](/agent-studio/getting-started/)** — sign in, set up a
  workspace, connect a repo, add an LLM key.
- **[Core concepts](/agent-studio/core-concepts/)** — agents-as-code, the PR
  loop, frameworks, and versioning.
- **Building agents** — [authoring](/agent-studio/authoring-agents/),
  [agent lifecycle](/agent-studio/agent-lifecycle/), and
  [sidecar Python tools](/agent-studio/sidecar-python-tools/).
- **Running & automating** — [runs](/agent-studio/running-agents/) and
  [automations & triggers](/agent-studio/automations-triggers/).
- **Integrations** — [Connections](/agent-studio/connections/),
  [Tools & Tool uses](/agent-studio/tools-and-tool-uses/), and
  [Slack apps](/agent-studio/slack-apps/).
- **Observability & governance** —
  [Dashboard & Runs](/agent-studio/dashboard-and-runs/),
  [Improvements](/agent-studio/improvements/), and
  [Audit & roles](/agent-studio/audit-and-roles/).
- **Administration** — [Settings](/agent-studio/settings/),
  [deploying & operating](/agent-studio/deploying-and-operating/), and
  [troubleshooting](/agent-studio/troubleshooting/).

For the engineering record, the repository's `CHANGELOG.md` lists what's landed
and `ROADMAP.md` shows where it's headed.
