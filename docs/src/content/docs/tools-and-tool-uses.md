---
title: Tools & Tool uses
description: Browse the tools available to agents and observe which tools they actually call.
---

## Tools

The **Tools** page is the catalog of what agents can call in this workspace —
the tools exposed by your authorized [connections](/agent-studio/connections/)
(Composio and Native MCP). Use it to see what's available before referencing a
tool in an agent's `tools:` list.

## Tool uses

The **Tool uses** view is workspace-wide observability: every tool call every
agent has made, filterable by outcome (ok / failed / no result), agent, and
tool, and searchable by tool name or error text. It's the fastest way to answer
"is this agent actually calling the tool I expect?" and to spot a failing
integration across all agents at once.

Tool calls are captured for Pydantic agents — including
[sidecar Python tools](/agent-studio/sidecar-python-tools/), which appear by
function name — on both successful and failed runs. Each row links back to the
run that produced it.
