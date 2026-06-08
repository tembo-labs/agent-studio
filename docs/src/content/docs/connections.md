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

## Three substrates

| Substrate      | When to pick it                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| **Composio**   | The default. ~1,000 services wrapped as REST tools. Lowercase slugs (`slack`, `googlesheets`).                  |
| **Native MCP** | The provider has an official MCP server — richer, schema-aware tools, fewer round trips, and TAS-managed OAuth. |
| **Secrets**    | A plain **API key** for a service with no OAuth (e.g. Clay), read by [sidecar Python tools](/agent-studio/sidecar-python-tools/). |

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

### Viewing another member's connections (admins)

Workspace admins see a **Viewing** dropdown at the top of the Connections page.
Switch it to inspect another member's authorized accounts. When viewing someone
else you can **Rename** and **Refresh** their connections; **Connect**,
**Reconnect**, and **Disconnect** are hidden because OAuth must be performed by
that member themselves.

Use this together with the [member detail view](/agent-studio/dashboard-and-runs/#member-detail-admins)
when troubleshooting "no active connection" failures for automations or triggers
that run as a specific owner.

For doing deterministic I/O over a connection from Python, see
[Sidecar Python tools](/agent-studio/sidecar-python-tools/).

## Secrets (API keys)

Some services — like Clay — authenticate with a plain **API key**, not OAuth.
For these, use a **Secret**: a free-form, **workspace-level** key an admin sets
once under **Connections → Secrets** and the whole workspace shares (unlike the
per-user OAuth connections above). Secrets are read by an agent's
[sidecar Python tools](/agent-studio/sidecar-python-tools/) via
`tas_tools.secret("name")` — they attach no tools and are invisible to the
model.

- **Add one** (admin): Connections → Secrets → name (e.g. `clay`) + value. It's
  encrypted at rest and shown masked.
- **Use it** in a tool: `tas_tools.secret("clay")` returns the value.
- **Optionally declare it** on the agent so the studio prompts an admin to set a
  missing one:

  ```yaml
  connections:
    - { type: clay, source: secret }
  ```
