---
title: Automations & triggers
description: Run agents on a schedule or fire them from external events.
---

Beyond on-demand [runs](/agent-studio/running-agents/), agents can run on their
own — on a clock or in response to something happening.

## Automations (schedules)

An **automation** runs an agent on a cron schedule. You pick the agent, the
schedule, an optional input message, and an **owner** — the automation runs as
that owner, so it uses the owner's [connection](/agent-studio/connections/)
credentials. You can also choose whether a schedule runs the agent's stable
version or its live draft.

## Triggers (events)

A **trigger** fires an agent from an external event — a new Gmail message, a
Slack mention, a GitHub PR event, and so on — via Composio. Like automations, an
event run executes as the trigger's owner.

:::note
The owner/acting-user model is the same across manual runs, automations, and
triggers — it determines which credentials a run uses. See
[Core concepts → acting user](/agent-studio/core-concepts/).
:::

Each fired run shows up in [Runs](/agent-studio/dashboard-and-runs/) attributed
to its trigger (manual / schedule / event) so you can tell automated activity
from hand runs.
