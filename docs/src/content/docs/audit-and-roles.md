---
title: Audit & roles
description: The append-only audit timeline and the workspace role model.
---

## Audit

The **Audit** timeline is an append-only record of every change in the
workspace — who did what, from which source, against which agent, and when. It's
filterable by source, actor, agent, and time, and exportable as JSON. Because
agent changes are pull requests and runs are recorded, the audit trail answers
"what changed and who changed it" without reconstructing it after the fact.

## Roles

Workspace membership has three roles, enforced at the API layer:

| Role          | Can do                                                           |
| ------------- | --------------------------------------------------------------- |
| **Admin**     | Manage members, settings, and connections; everything operators can do. |
| **Operator**  | Author, run, and improve agents; authorize their own connections. |
| **Viewer**    | Read agents, runs, and dashboards.                              |

Manage members and their roles under **Settings**. Instance admins can also
create workspaces.
