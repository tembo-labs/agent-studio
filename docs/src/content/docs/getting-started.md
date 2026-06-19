---
title: Getting started
description: Sign in, find your workspace, and run or automate an agent — including ones your teammates built.
---

This page gets you from signing in to running an agent. Setting up the instance
itself — connecting a repo, adding provider keys — is an admin task (see the
[admin introduction](/agent-studio/admin-introduction/)); once that's done,
everyone in the workspace can use the agents.

## 1. Sign in

Open the instance URL and sign in through your organization's identity provider
— **Google**, **Microsoft Entra ID**, or a generic **OIDC** provider (Okta,
Auth0, Keycloak, …), whichever buttons appear on the login screen. A quickstart
instance with no OAuth configured shows an **email + password** form instead. If
it's your first time, an admin may need to add you to a workspace.

## 2. Find your workspace

A **workspace** holds your team's agents, runs, and connections. Use the
workspace switcher at the top of the left sidebar to move between workspaces you
belong to. The **Agents** list shows every agent in the workspace — the ones you
built and the ones your teammates did.

## 3. Run an agent

Open any agent and click **Run** to execute it once. The
[run detail page](/agent-studio/running-agents/) shows a live, step-by-step
timeline: the agent's narration, the tools it called and how each turned out,
plus token usage and cost. You can run agents other people on your team made —
you don't have to have built them.

## 4. Authorize your connections

If an agent talks to outside services (Slack, Gmail, Sheets, Attio, …), it acts
as **you** when you run it — so authorize those accounts under **Connections**.
Connections are per-user; each person authorizes their own. The sidebar prompts
you to connect anything an agent needs that you haven't yet. See
[Connections](/agent-studio/connections/).

## 5. Automate and share it

You don't have to run agents by hand:

- **Schedule** an agent or fire it from an event —
  [Automations & triggers](/agent-studio/automations-triggers/).
- **Launch from Slack** — [Slack apps](/agent-studio/slack-apps/).
- **Improve it** from any run when the output isn't right —
  [Improvements](/agent-studio/improvements/).

These work on any agent in the workspace, including ones your teammates built.

## Want to build your own?

Describe the agent you want in plain language and TAS opens a pull request via
Tembo — see [Authoring agents](/agent-studio/authoring-agents/) and
[Agent lifecycle](/agent-studio/agent-lifecycle/). You can also commit a spec
file by hand under `agents/pydantic-agentspec/` in the connected repo.
