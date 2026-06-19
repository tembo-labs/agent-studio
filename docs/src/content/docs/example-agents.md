---
title: Example Agents
description: Copy-paste, connection-agnostic prompts that generate inbox-producing agents for whatever email, ticketing, CRM, or task service you've connected.
---

A library of ready-to-use prompts for creating agents. Each one describes an
agent's behavior in plain language — paste it into the agent-creation chat and
the [Tembo Coding Agent Platform writes the spec and opens a PR](/agent-studio/authoring-agents/)
you review and merge.

## How to use these

- **Connection-agnostic.** The prompts say "your email connection", "your
  ticketing connections" rather than naming a vendor. Tembo reads what you've
  [connected](/agent-studio/connections/) and adapts — so the same prompt works
  whether your email is Gmail or your tracker is Linear or Pylon.
- **One agent per matching connection.** Where you have several connections of a
  kind (say Pylon **and** Linear), a prompt can generate one agent per service.
- **They build on the Tasks Inbox.** These agents surface work into the
  [Tasks Inbox](/agent-studio/tasks-inbox/) with deep links and action buttons
  (Complete, Send, Archive…). That needs the built-in **Tembo Agent Studio** MCP
  connection (for `produce_inbox_item`) plus the service connection itself.
- **Requirements.** A Tembo API key in **Settings** (for chat-to-PR authoring),
  the relevant service connection, and the Tembo Agent Studio MCP connection.
  Pair each agent with an [automation](/agent-studio/automations-triggers/) to
  run it on a schedule.

Edit the prompts freely — change the caps, the priority order, or the wording to
fit how you work.

## Email triage → Tasks Inbox

**Generates:** one agent that surfaces your most important emails for review.
**Needs:** an email connection (Gmail, or a Composio email toolkit) + Tembo Agent
Studio MCP.

```text
Using my connected email service, create an agent that surfaces my highest-
priority emails into the Tasks Inbox, keeping at most 5 unhandled at a time.

- Look at roughly my 10 most recent inbox messages and pick the most important.
  Prioritize starred/flagged messages first, then by apparent importance — a
  direct ask, a reply I owe, an approaching deadline, or a known/important
  sender — newest first as a tiebreak.
- For each chosen message, produce an inbox item with: a deep link that opens
  the message in my email client, a title (subject + who it's from), and context
  (sender, date, a short snippet).
- If the email warrants a reply, draft a concise suggested reply I can edit, and
  offer two buttons: "Send" (sends the reply and leaves the thread in my inbox)
  and "Send and Archive" (sends, then archives it). Always also offer an
  "Archive" button. If it just needs filing, offer only Archive.
- Dedup by message id so the same email isn't surfaced twice, and don't exceed
  the cap of 5 unhandled items. Only read mail — sending/archiving happens when I
  click a button.
```

**Notes:** mirrors the Send / Send-and-Archive / Archive flow; the inbox always
adds Snooze. Sending and archiving require your email connection to have the
matching scopes.

## Ticket / issue roundup → Tasks Inbox

**Generates:** one agent **per** connected ticketing/issue tracker.
**Needs:** one or more ticketing connections (Linear, Pylon, …) + Tembo Agent
Studio MCP.

```text
For each ticketing / issue-tracking service I have connected (e.g. Linear,
Pylon), create a separate agent that surfaces my open items into the Tasks
Inbox, keeping at most 3 unhandled items per service.

- Pull my open/active items and prioritize them by status — most actionable
  first (for example: triage, then in-review, then in-progress, then todo, then
  backlog). Exclude items that are done, closed, archived, or canceled.
- For each item, produce an inbox item with: a deep link to open it in the
  source, a title, and context (identifier, status, a short description).
- Offer a "Complete" button that closes/resolves the item in the source system,
  plus a "Dismiss" button that just clears it from my inbox without changing it
  there.
- Dedup by item id, skip items already in my inbox, and treat snoozed items as
  out of the way so newer items can take their place.
```

**Notes:** one prompt → multiple agents when you have multiple trackers. Complete
acts via the connection, so it can only do what that connection's scopes allow.

## CRM task roundup → Tasks Inbox

**Generates:** one agent per connected CRM.
**Needs:** a CRM connection (Attio, HubSpot, …) + Tembo Agent Studio MCP.

```text
Using my connected CRM, create an agent that surfaces my open CRM tasks into the
Tasks Inbox, keeping at most 3 unhandled at a time.

- For each open task, resolve what it's about — the related person, company, or
  deal — and include that (name + type) so the item is self-explanatory.
- Produce an inbox item with: a deep link that opens the task/record in the CRM,
  a descriptive title (the task plus who/what it's about), and context (the task
  text, due date, and the related record(s)).
- Offer a "Complete" button that marks the task done in the CRM, plus a
  "Dismiss" button. Dedup by task id; don't exceed the cap.
```

**Notes:** the related-record enrichment makes each item readable at a glance,
exactly like the built-in CRM task agent.

## Daily task-list roundup → Tasks Inbox

**Generates:** one agent per connected task manager.
**Needs:** a task-manager connection (Dialed, Todoist, …) + Tembo Agent Studio
MCP.

```text
Using my connected task manager, create an agent that surfaces my top open tasks
into the Tasks Inbox, keeping at most 3 unhandled at a time.

- Get my top open tasks and produce an inbox item for each with a deep link (if
  the task has one), a title, and its status.
- Offer a one-click "Complete" button that marks the task done in the source,
  plus a "Dismiss" button. Dedup by task id; respect the cap and snoozed items.
```

**Notes:** great as a morning round-up — schedule it with an
[automation](/agent-studio/automations-triggers/).

## Make them better over time

These agents are read-mostly: Complete, Send, and Archive all run through your
connection's own permissions, so an action only does what that connection
allows. Turn on
[Learning mode](/agent-studio/tasks-inbox/#learning-from-your-edits) for an agent
and the edits you make — to a suggested reply, or which action you pick versus
what it proposed — batch into improvement PRs, so it gets sharper at picking and
drafting the right thing.
