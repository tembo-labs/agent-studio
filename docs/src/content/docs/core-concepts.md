---
title: Core concepts
description: Agents-as-code, the chat-to-PR loop, Pydantic AgentSpec, and draft → stable versioning.
---

A few ideas explain how everything in TAS fits together.

## Agents are code

An agent is a file in your repo under `agents/`, not a record in a vendor
console. Its model, instructions, connections, and tools are all declared in
that file. Because it's a file, it has a history, a diff, an owner, and a review
trail — the same as any other code.

## Every change is a pull request

You never edit a live agent in place. Changes — new agents, edits, and "improve
the agent" feedback — are turned into a **pull request** against your repo. The
authoring work (chat → diff) is performed by the
[Tembo Coding Agent Platform](https://tembo.io) using the API key you set in
workspace settings. You review and merge the PR like any other; the merged file
is what runs.

## Workspaces

A **workspace** maps to one GitHub repository and owns its members, connections,
agents, automations, and runs. Switching workspaces switches all of that. Access
is governed by [roles](/agent-studio/audit-and-roles/).

## Agent format (Pydantic AgentSpec)

Agents are **Pydantic AgentSpec** files — YAML (or JSON) with `model`,
`instructions`, optional `connections:`, and TAS extensions like `labels:` and
[`tools_module:`](/agent-studio/sidecar-python-tools/). They live under
`agents/pydantic-agentspec/` and run through a bundled `pydantic-ai` wrapper so
you get the upstream tool's full power.

## Draft → stable versioning

An agent has a **draft** (the live file on your default branch) and, once you
promote it, a **stable** snapshot frozen in the database. Automated runs default
to stable for predictability; the chat/iterate surface always runs the draft.
Promotion records who promoted what and when, and you can compare versions — so
"what changed and when did behavior shift?" is always answerable. See
[Agent lifecycle](/agent-studio/agent-lifecycle/) for promotion, ownership, and
pending agents.

## Connections and tools

Agents reach the outside world through **Connections** (authorized per user) and
the **tools** those connections expose. TAS has two connection substrates —
Composio and Native MCP — plus the option of
[sidecar Python tools](/agent-studio/sidecar-python-tools/) for deterministic
work. See [Connections](/agent-studio/connections/) and
[Tools & Tool uses](/agent-studio/tools-and-tool-uses/).

## Acting user

Every run executes **as a user**, and that identity decides which connection
credentials it uses. A manual run acts as you; a scheduled run acts as the
automation's owner; an event-triggered run acts as the trigger's owner. This is
why connections are authorized per person.
