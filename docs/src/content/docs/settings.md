---
title: Settings
description: Provider keys, Composio keys, the Tembo API key, members, and instance configuration.
---

**Settings** is where you wire up the keys and people a workspace needs.

## API keys

- **LLM provider keys** — an **Anthropic** and/or **OpenAI** key. At least one is
  required for agents to run; until one is set, the sidebar shows an "LLM
  provider needed" prompt.
- **Composio key** (and webhook secret) — enables the Composio
  [connection](/agent-studio/connections/) substrate and event triggers.
- **Tembo API key** — lets TAS open pull requests via the
  [Tembo Coding Agent Platform](https://tembo.io) for authoring and
  [improvements](/agent-studio/improvements/).

All secrets are encrypted at rest and shown only as masked previews — they're
never returned to the browser in full.

## Members

Add and remove workspace members and set their [roles](/agent-studio/audit-and-roles/)
(admin / operator / viewer).

## Instance settings

Instance-level configuration (such as the instance name and admin) lives in the
top-level settings, available to instance admins. For standing up and operating
the instance itself, see
[Deploying & operating](/agent-studio/deploying-and-operating/).
