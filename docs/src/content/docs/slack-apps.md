---
title: Slack apps
description: Install a TAS-managed Slack app and let your team launch agents from Slack.
---

TAS can host **per-team Slack bots** that launch a label-scoped subset of your
agents — so dozens of agents are reachable from Slack without dozens of channels
or one expensive mega-agent.

## Who can set this up

Slack apps are **workspace-admin only**. Go to **Settings → Slack apps** to
create, configure, and install bots. Credentials (signing secret, client secret,
bot token) are AES-256-GCM encrypted at rest.

## Installing a Slack app

Each Slack app is its own bot with its own identity, OAuth install, and agent
scope. The setup is coached from the settings page:

1. **Create the app in TAS** — give it a name (e.g. "Sales bot"), pick a
   **default owner** (the member whose connections a run falls back to when
   Slack can't match the invoking user by email), and list the **agent labels**
   it may launch.
2. **Create the Slack app from manifest** — TAS shows a prefilled Slack manifest
   JSON. In the [Slack API dashboard](https://api.slack.com/apps), choose
   **Create new app → From a manifest**, paste it, and create the app.
3. **Copy credentials into TAS** — paste the Slack app's **signing secret**,
   **client ID**, and **client secret** back into the TAS app card.
4. **Add to Slack** — click **Add to Slack** on the TAS card to complete the
   OAuth install. Re-install if you re-sync the manifest so new scopes take
   effect.

TAS registers `/tas` as the slash command and wires request URLs for events,
interactivity, and OAuth automatically.

## Scoping which agents a Slack app can launch

Agents are scoped to a Slack app by **`labels:`**. An agent with a matching
label can be launched from that app; others can't — so a customer-support Slack
app only exposes support agents.

```yaml
name: refund-handler
labels: [support]
# ...
```

See [Authoring agents](/agent-studio/authoring-agents/) for the full field
reference. Run one bot per team (e.g. a sales bot and a support bot) rather
than one bot for the whole workspace.

## Ways to launch an agent

| Method | What happens |
| ------ | ------------ |
| **`/tas <agent> <input>`** | Runs the named agent with the rest of the line as input. |
| **`/tas` with no agent** | Opens an **agent picker** modal listing every agent this bot can launch. |
| **`@mention` the bot** | Same as a DM — see natural-language routing below. |
| **DM the bot** | Same routing as a mention. |
| **"Run agent on this message" shortcut** | Right-click (or ⋮ on) any Slack message → shortcut → prefills that message as the agent's input in the picker. |
| **App Home** | The bot's Home tab lists every agent it can launch. |

### Natural-language routing

When a message doesn't name an agent explicitly (a mention, DM, or free-text
`/tas` input), TAS routes it with a lightweight classifier to the best-fit
agent among those scoped to the bot. If nothing clearly fits, the bot replies
with the agent menu instead of guessing.

To make routing reliable, give each scoped agent a clear **`description:`** in
its spec.

## Acting user and connections

A Slack-launched run acts as the **Slack user** when TAS can match them to a
workspace member by email. If there's no match, the run falls back to the
app's **default owner** and uses that member's
[connections](/agent-studio/connections/).

Make sure operators have authorized the services your agents need — otherwise
runs fail with a "no active connection" error.

## Replies and observability

- The agent's Markdown output is rendered as Slack **mrkdwn** (bold, headings,
  links, bullets, tables).
- Slack-launched runs appear in [Runs](/agent-studio/dashboard-and-runs/) with
  **Source = Slack**, who the run acted as, and a **View in Slack** deep link
  back to the originating conversation.
- The workspace [Dashboard](/agent-studio/dashboard-and-runs/) **Team** table
  includes a **Slack (30d)** column per member, with a per-bot breakdown on
  hover.
- Each dispatch records an audit event (`slack.dispatch`).

## Rate limits

Per-Slack-user rate limiting and replay deduplication protect against Slack
retries and runaway loops. If a user hits the limit, the bot replies in-thread
with a short message rather than queueing another run.