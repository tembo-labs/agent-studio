---
title: Tasks Inbox
description: The human-in-the-loop queue agents push work into — review, act in the source, snooze, or dismiss.
---

The **Tasks Inbox** is a shared queue that agents push work into for a human to
review. Instead of an agent silently acting (or a result vanishing into a Slack
message), it produces an **inbox item** — a small card with the context you need
and one or more actions you can take. You triage the queue; the actions run in
the real source system.

## How items get there

Agents create items with the `produce_inbox_item` tool (over the
[`tembo-agent-studio` MCP connection](/agent-studio/mcp/)) or via
`POST /api/v1/inbox` ([REST API](/agent-studio/api/)). A typical surfacing agent
lists work in some source (Linear issues, Gmail threads, Dialed tasks…), then
produces an item per thing that needs your attention.

Each item carries:

- a **title** and **context** (the raw details to review),
- a **source** (rendered as the provider's logo in the list),
- an **`externalRef`** — the source object's id, used to **dedupe**: re-producing
  the same `(source, externalRef)` updates the existing item instead of stacking
  duplicates,
- an optional **`url`** — an *Open in &lt;source&gt; ↗* deep link to the
  underlying Linear issue / Gmail thread / Attio record / Dialed task,
- optional **action buttons** (see below).

Well-behaved surfacing agents also **cap** how many items they leave per source
(e.g. "at most 5 unhandled emails") and treat **snoozed** items as out of the
way — so the queue stays a short, focused worklist rather than a firehose.

## Reviewing an item

Open an item to see its context, the *Open in &lt;source&gt;* link, and the
actions. How you resolve it depends on what the producing agent attached:

### Action buttons (act in the source)

When the agent attached options, the item shows a button per action — and
clicking one **runs the real action in the source system**, then clears the item.
Examples from the built-in task agents:

- **Complete** — marks a task done in Dialed / Attio / Linear.
- **Send** — sends a reply (e.g. a Gmail thread) and leaves it in your inbox.
- **Send and Archive** — replies, then archives the thread out of your inbox.
- **Archive** — files the thread without replying.

These run on *your* [connection](/agent-studio/connections/) for that provider,
so an action can only do what your connection's scopes allow.

### Suggested replies

Reply-style options come with an **editable draft** the agent wrote. Edit it to
taste, then choose how to send (e.g. **Send** vs **Send and Archive**). The text
you actually send — and which button you pick — is recorded as feedback.

### Free-text items

If the agent attached no buttons, the item shows the agent's **proposed action**
in an editable box. Correct it and **Submit** to record the final action, or
**Dismiss**.

### Snooze and Dismiss

Every active item can be:

- **Snoozed** — hidden from the active inbox for a chosen duration, after which
  it returns automatically. Snoozing also frees a slot, so a capped agent can
  surface the next item from that source.
- **Dismissed** — cleared without acting (for items that have no built-in
  clear/archive action). **Dismiss is terminal**: a later agent run will *not*
  resurface a dismissed item, even if the source object changes.

## Filtering the queue

The inbox list supports full-text **search**, a **source** filter, a **type**
filter, and status **facets** — *Active*, *Needs review*, *Open*, *Claimed*,
*Snoozed*, *Done*, *Dismissed*. The sidebar shows a live count of active items
(it updates on its own as agents produce work in the background).

## Learning from your edits

When **learning mode** is on for an agent (its **Learning** tab), the gap between
what the agent *proposed* and what you *actually did* becomes a training signal.
TAS batches those corrections on a cadence into a single pull request via the
Tembo Coding Agent Platform, so the agent handles more on its own over time. The
result is tracked like any other change — see
[Improvements](/agent-studio/improvements/).

## For agent authors

To surface work into the inbox, give your agent the `tembo-agent-studio` native
MCP connection with the `produce_inbox_item` and `list_inbox_items` tools, then:

1. List the work in your source.
2. Call `list_inbox_items(source: "…")` and skip items already staged (match on
   `externalRef`); respect a per-source cap, counting only **unsnoozed** active
   items.
3. For each new item, `produce_inbox_item` with `itemType`, `source`,
   `externalRef`, a deep-link `url`, a `title`, the `context`, and `options`.
   To point one item at several things to review (e.g. the top 10 Linear
   tickets behind a single triage task), pass `links: [{ label, url }]` — they
   render as a clickable **Links** list, separate from the single `url` source
   link. Non-`http(s)` urls are dropped.

An option that runs a source action carries an `execute` descriptor, e.g. a
one-click Complete backed by a native-MCP tool:

```yaml
options:
  - id: complete
    label: Complete
    kind: oneclick
    recommended: true
    execute:
      provider: native-mcp        # or "composio"
      op: complete_task           # the tool to call on click
      params:
        connectionType: dialed    # the user's connection
        connectionName: default
        toolArgs: { id: "<task-id>" }
```

A reply option uses `kind: reply` with a `draft`, and `params.bodyArg` names the
tool argument that receives the human's edited text. Composio options can chain a
follow-up with `params.also` (this is how **Send and Archive** replies, then
removes the `INBOX` label). See [Authoring agents](/agent-studio/authoring-agents/)
and the [MCP server](/agent-studio/mcp/) reference for the full field list.

:::note
Buttons run with your connection's permissions. If an action fails with a scope
or permission error, reconnect that provider under
[Connections](/agent-studio/connections/) with the needed access (e.g. Gmail
*send* + *modify* for Send / Archive).
:::
