---
title: Getting started
description: Sign in, create or join a workspace, connect a GitHub repo, and add an LLM provider key so agents can run.
---

This page gets you from a freshly deployed (or shared) TAS instance to running
your first agent. If you're standing up the instance itself, see
[Deploying & operating](/agent-studio/deploying-and-operating/) first.

## 1. Sign in

Open the instance URL and sign in with Google. The first time you sign in, an
instance admin may need to add you to a workspace (see
[Audit & roles](/agent-studio/audit-and-roles/) for the role model).

## 2. Pick a workspace

A **workspace** is the unit of isolation in TAS: it pins to exactly one GitHub
repository and has its own members, connections, agents, and runs. Use the
workspace switcher at the top of the left sidebar to move between workspaces you
belong to. Instance admins can create new workspaces.

## 3. Connect a GitHub repository

Each workspace's source of truth is a Git repo. On first use you're guided to
connect one — TAS stores agent definitions under `agents/` in that repo and
reads/writes them through the GitHub API. Once connected, the **Agents** list
reflects what's in the repo's default branch.

## 4. Add an LLM provider key

Agents call a model, so the workspace needs at least one provider key. Go to
**Settings → API keys** and add an **Anthropic** or **OpenAI** key. Until one is
set, the sidebar shows an **"LLM provider needed"** prompt and runs can't
execute.

:::tip[Which model?]
For an agent that calls tools, start on a top-tier model (e.g.
`anthropic:claude-opus-4-8`) to prove it works, then try downgrading to a
cheaper one like `anthropic:claude-sonnet-4-6` and compare cost on the
[Runs](/agent-studio/dashboard-and-runs/) page. See
[Authoring agents](/agent-studio/authoring-agents/) for the full playbook.
:::

## 5. (Optional) Authorize connections

If your agents talk to outside services (Slack, Gmail, Sheets, Attio, …),
authorize them under **Connections**. Connections are per-user: each operator
authorizes the accounts their runs act as. See
[Connections](/agent-studio/connections/).

## 6. Create and run your first agent

- **From chat:** describe the agent you want; TAS opens a pull request via Tembo.
  Merge it and the agent appears in the **Agents** list.
- **Run it:** open the agent and use **Run** to execute it once. The
  [run detail page](/agent-studio/running-agents/) shows the output, token usage,
  cost, and every tool the agent called.

From here, automate it on a schedule or an event
([Automations & triggers](/agent-studio/automations-triggers/)), or refine it
with [Improvements](/agent-studio/improvements/).
