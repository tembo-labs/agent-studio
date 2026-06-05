---
title: Slack apps
description: Install a TAS-managed Slack app and let your team launch agents from Slack.
---

TAS can manage a **Slack app** so your team launches agents directly from Slack.

## Installing

From workspace settings, create and install a TAS-managed Slack app into your
Slack workspace. TAS handles the OAuth install and stores the credentials
encrypted. (If you re-sync the app's manifest, re-install so the new scopes take
effect.)

## Scoping which agents a Slack app can launch

Agents are scoped to a Slack app by **`labels:`**. An agent with a matching
label can be launched from that app; others can't — so a customer-support Slack
app only exposes support agents. See
[Authoring agents](/agent-studio/authoring-agents/) for setting labels.

## Invoking an agent

Trigger an agent from Slack (e.g. a slash command or mention, per the app's
configuration). The run executes as the invoking user where possible, and its
output is rendered back into Slack-formatted text. These runs show up in
[Runs](/agent-studio/dashboard-and-runs/) like any other.
