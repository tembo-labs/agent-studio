---
title: Connections
description: Authorize external services so agents can act on them — Composio and Native MCP, authorized per user.
---

**Connections** are how agents reach outside services — Slack, Gmail, Google
Sheets, Notion, Attio, GitHub, and ~1,000 more. An agent declares what it needs
in its `connections:` field; each operator authorizes the accounts their runs
act as.

## Per-user authorization

Connections are authorized **per user, per workspace**. Because a run executes as
a specific [acting user](/agent-studio/core-concepts/), it uses that user's
authorized accounts. A manual run uses yours; a scheduled run uses the
automation owner's; an event run uses the trigger owner's. If an agent needs a
service nobody has connected, the sidebar surfaces an **"Action needed"** prompt
with a **Connect** button.

## Two substrates

| Substrate      | When to pick it                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| **Composio**   | The default. ~1,000 services wrapped as REST tools. Lowercase slugs (`slack`, `googlesheets`).                  |
| **Native MCP** | The provider has an official MCP server — richer, schema-aware tools, fewer round trips, and TAS-managed OAuth. |

Prefer **Native MCP** when the provider is in TAS's native catalog: it uses the
provider's official server and TAS-managed OAuth (just click **Connect** — no
bring-your-own OAuth app). Use **Composio** for providers not in that catalog.

:::caution[Slugs differ between substrates]
The tool slugs for the same provider differ between Composio and Native MCP. If
you switch a connection's `source:`, update the agent's `tools:` list to match.
:::

## Declaring connections on an agent

```yaml
connections:
  - { type: slack, tools: [SLACK_SEND_MESSAGE] }
  - { type: attio, source: native-mcp, name: default, tools: [run-basic-report] }
```

- `type:` is the provider slug.
- `source:` defaults to `composio`; set `native-mcp` for native providers.
- `name:` is the connection slot ("default" unless you keep multiple accounts of
  the same provider, e.g. `work` vs `personal`).
- `tools:` narrows what the agent can call (works on both substrates).

## Authorizing and reconnecting

Authorize and manage connections under **Connections**. If a credential expires
or is revoked, the connection is marked stale and runs that need it fail with a
clear message — reconnect from the same page. See
[Troubleshooting](/agent-studio/troubleshooting/).

For doing deterministic I/O over a connection from Python, see
[Sidecar Python tools](/agent-studio/sidecar-python-tools/).
