# v0.3 User Stories

Format: Connextra (**As a** *role*, **I want** *capability*, **so that** *benefit*) with explicit **Acceptance Criteria**.

## Personas Referenced

- **Reviewer** — completes HITL approvals; often a domain expert (legal, finance).
- **Workspace Admin** — runs one team's TAS workspace.
- **Support Engineer** — first-line incident response.

Governance personas (Compliance Stakeholder, Org Admin) live in [v0.4 (Governance depth)](../0.4/).

---

## US-0.3-01 — Rich HITL forms

**As a** Reviewer, **I want** HITL forms with multi-field structure, conditional visibility, file upload with preview, and field-level validation, **so that** approvals and structured data entry are accurate and efficient.

**Acceptance Criteria**
- Supported field types: text, number, enum/dropdown, date, file (with MIME and size limits), structured-confirmation.
- Conditional visibility expressible without writing code (small DSL in the form schema).
- Image and PDF uploads render an in-form preview.
- Validation errors block submit and are surfaced inline.
- Submitted responses are persisted with the run as structured events (the substrate v0.4's changelog will render).

---

## US-0.3-02 — Per-agent operational dashboard

**As a** Workspace Admin, **I want** a per-agent dashboard showing run health, active human tasks, recent changes, and top failure reasons, **so that** I can monitor reliability and operator workload without piecing it together from logs.

**Acceptance Criteria**
- Dashboard updates within one minute for active runs and human tasks.
- Run pass/fail rate is shown over 24h / 7d / 30d windows.
- Top failure reasons (clustered by error signature) are listed for the selected window.
- A link from the dashboard to the relevant run history exists for any time window.

---

## US-0.3-03 — Failure investigation

**As a** Support Engineer, **I want** to open a failed run and immediately see the associated human actions, recent agent changes, and similar past failures, **so that** I can diagnose issues without escalating to engineering by default.

**Acceptance Criteria**
- A failed run page shows: the failure reason, the last human action on this agent, the last agent change (with link to PR), and a "similar failures" link.
- A one-click action exists to file a runbook update suggestion (creates a draft note, not a PR).
- Common failure clusters (e.g., bad API key, rate-limited model) have explanatory text linked from the failure reason.

---

## US-0.3-04 — Workspace agent inventory view

**As a** Workspace Admin, **I want** a workspace-wide agent inventory I can search, sort, and filter by status, **so that** I can find the agent I need to triage or configure without clicking through unrelated screens.

**Acceptance Criteria**
- The inventory lists every agent in the workspace with name, status, run frequency, success rate, and last-run timestamp at a glance.
- A free-text search filters by agent name.
- A status filter exposes counts for each status (`all`, `active`, `idle`, `error`) so the admin sees the size of the problem before clicking in.
- Sort is configurable by name, success rate, or last-updated time, with an ascending/descending toggle.
- Each row exposes which harness and which model the agent is currently running on (see [US-0.1-07](../0.1/USER_STORIES.md#us-01-07--harness-and-model-as-first-class-agent-fields)).
- An empty result set produces a "no agents match these filters" message, not a blank screen.

---

## US-0.3-05 — Per-agent detail page

**As an** Operator, **I want** a per-agent detail page that shows current health, recent runs, and recent revisions on one screen, **so that** I can triage a misbehaving agent without bouncing between logs, repo, and dashboards.

**Acceptance Criteria**
- The page header shows the agent name, status, run frequency, harness, and model.
- Three KPI tiles are visible without scrolling: success rate (over the dashboard window), total runs, and failure count.
- A "Recent Runs" list shows the most recent runs with timestamp, duration, status badge, and a short detail line. Each row links to that run's detail page ([US-0.3-06](#us-03-06--run-detail-with-execution-log)).
- A "Revision History" timeline shows each version of the agent definition with version identifier, timestamp, author, and a short change description. The latest entry is at the top.
- The page exposes two action entry points: **Chat with Agent** (opens the per-agent configuration chat — see [US-0.3-09](#us-03-09--per-agent-chat-configuration-modal)) and either **Edit** (for lightweight agents) or **View Source** (for agents whose definition is a repo file).
- The per-agent operational dashboard requirements from [US-0.3-02](#us-03-02--per-agent-operational-dashboard) are surfaced on this page, not in a separate dashboard URL.

---

## US-0.3-06 — Run detail with execution log

**As a** Support Engineer, **I want** a run detail page with status, duration, and the full execution log, **so that** I can read a complete trace of what happened without exporting logs to a separate tool.

**Acceptance Criteria**
- The page shows the run timestamp, a prominent status badge (`success`, `failure`, `running`), duration, and log entry count.
- The execution log is rendered as a terminal-style panel: monospace, dark background, each line carrying timestamp, level (`info`, `warning`, `error`, `debug`), and message.
- Log levels are visually distinguishable (color-coded) and the page handles long lines (wrap or horizontal scroll) without truncating silently.
- A back action returns the user to the originating agent's detail page (state-preserving).
- A failure run's page links to the artefacts described in [US-0.3-03](#us-03-03--failure-investigation): last human action, most recent agent change, similar past failures.

---

## US-0.3-07 — Human tasks inbox

**As a** Reviewer, **I want** a workspace-wide inbox of tasks emitted by agents, with **Mine** and **All** tabs, priority, due date, and assignment, **so that** I can work my own queue without losing visibility into what the team is on the hook for.

**Acceptance Criteria**
- The inbox lists tasks across every agent in the workspace; switching to **Mine** shows only tasks assigned to the current user.
- Each task row shows: title, originating agent (linked), description summary, status (`pending`, `in_progress`, `completed`), priority badge (`high`, `medium`, `low`), created timestamp, and due timestamp (when set).
- A task assigned to the current user is visually distinguished (e.g., "Assigned to me" badge) regardless of which tab they are on.
- The list count and per-status breakdown are visible.
- Clicking a task routes to the task-type-specific form view ([US-0.3-08](#us-03-08--rich-hitl-task-archetypes)).
- An empty inbox shows an explicit "no tasks to show" state, not a blank screen.
- The inbox is the surface where the [US-0.2-06](../0.2/USER_STORIES.md#us-02-06--basic-hitl-pauseresume) paused runs and the [US-0.3-01](#us-03-01--rich-hitl-forms) form submissions converge — the same task object drives both.

---

## US-0.3-08 — Rich HITL task archetypes

**As a** Reviewer, **I want** the v0.3 form schema renderer to ship with a small set of pre-built task archetypes that match the workflows we actually run, **so that** common reviewer interactions don't require building a custom form schema from scratch.

**Acceptance Criteria**
- v0.3 ships at least the following archetypes, each renderable directly from a task object:
  - **Email send/approve** — recipient (read-only), editable subject and body, attachment list with file previews, send / save-draft / skip actions.
  - **Proposal or deal review** — structured deal metadata (company / contact / budget / size), requirement checklist, agent's analysis callout, free-text reviewer notes, approve / request-info / decline actions.
  - **Outbound social outreach** — target profile card (name, title, company, external profile link), bounded free-text connection note with a character counter and limit, send / save-for-later / skip actions.
  - **Meeting scheduling** — attendee list, agenda summary, structured time-slot selection (radio list), optional custom message, send-invite / propose-different-times actions. Send is disabled until a slot is picked.
  - **Content approval** — content metadata (title, author, word count, publish date, excerpt, categories), external preview link, feedback textarea, approve-and-publish / request-revisions / reject actions.
- Each archetype's form schema is expressible in the v0.3 schema DSL ([US-0.3-01](#us-03-01--rich-hitl-forms)) — archetypes are not hardcoded paths, they are templates.
- A reviewer-facing field validation rule that blocks submission (e.g., character-limit overflow, missing required field) surfaces inline at the field, not as a toast.
- The action buttons available on a task are determined by the form schema, not by the agent's identity — two agents emitting the same archetype expose the same actions.

---

## US-0.3-09 — Per-agent chat configuration modal

**As an** Ops Lead, **I want** a "Chat with Agent" modal on the agent detail page, **so that** I can initiate a configuration change for *this* agent without first navigating to a global chat surface and re-establishing context.

**Acceptance Criteria**
- The modal is launched from the agent detail page; the agent's identity is the starting context — the user does not have to re-specify which agent they are modifying.
- The chat thread persists across sessions and is reachable from the agent's detail page (see also [US-0.2-02](../0.2/USER_STORIES.md#us-02-02--chat-to-edit-an-existing-agent) and [US-0.2-07](../0.2/USER_STORIES.md#us-02-07--visibility-into-chat-driven-changes) for the PR-side requirements).
- The modal makes its "this will open a PR" intent clear at the moment of submission — consistent with [US-0.2-01](../0.2/USER_STORIES.md#us-02-01--chat-to-create-an-agent).
- The modal supports submit-on-Enter and newline-on-Shift+Enter; assistive technology can navigate it.
- Closing the modal does not lose unsent draft text within the session.

---

## US-0.3-10 — Workspace growth dashboard

**As a** Workspace Admin, **I want** a workspace-level dashboard that tracks agent onboarding and run volume over time with a few headline KPIs, **so that** I can answer "is this platform getting traction here?" without writing a query.

**Acceptance Criteria**
- The dashboard shows four headline KPIs above the fold: total agents (with delta over the selected window), total runs in the window (with growth %), adoption rate (agents added per week, averaged over the window), and active agents (with % of total).
- A **time-span selector** offers at least: last 24 hours, last 7 days, last 30 days, last 13 weeks.
- A **granularity selector** is bound to the chosen span (e.g., 24h → hourly or every 2 hours; 7d → every 12 hours or daily; 30d → daily or weekly; 13w → weekly).
- A "Agents Onboarded Over Time" chart shows cumulative agent count across the chosen window with hover-to-reveal counts.
- A "Agent Runs Over Time" stacked bar chart shows runs per bucket, color-segmented per agent, with a legend and per-segment hover detail.
- A "Top Performing Agents" panel ranks the top five agents by success rate over the window, each with a status indicator.
- A "Recent Activity" panel shows the most recent N successful/failed run events with relative timestamps.
- The dashboard is read-only — it does not let an admin trigger runs or change policy.

---

## US-0.3-11 — Agent topology map

**As a** Workspace Admin, **I want** a visual topology map of sources, agents, and destinations with directed, labeled edges, **so that** I can understand at a glance how data flows through this workspace's agents and which integrations a misbehaving agent depends on.

**Acceptance Criteria**
- The map renders three node kinds: **source** (e.g., REST API, GitHub Events), **agent**, and **destination** (e.g., Slack, Database, GitHub PR), visually distinguishable by shape and color.
- Agent nodes carry their current status (`active` / `idle` / `error`) as a colored indicator and their run frequency as a label, consistent with the agent-list cards.
- Edges are directed, support an optional label describing the relationship (e.g., `poll`, `PR opened`, `sentiment`, `alerts`), and visually indicate active data flow on agents that are running.
- The map provides standard interactions: pan, zoom, fit-to-screen, and a minimap that color-codes node kinds and agent status.
- A **focus mode** lets the user select a node and view only that node plus its direct upstream and downstream neighbors, laid out in three columns; a **full-mesh** toggle restores the complete graph.
- Clicking a "view details" affordance on an agent node routes to the agent detail page from [US-0.3-05](#us-03-05--per-agent-detail-page).
- The topology is read from the same source of truth as the agent definitions — there is no separate "map config" to drift from the agent state.

---

## US-0.3-12 — Workspace-wide log explorer

**As a** Support Engineer, **I want** a workspace-wide log explorer with full-text search, agent filter, and level filter, **so that** I can find an entry across all agents during incident response without first guessing which agent emitted it.

**Acceptance Criteria**
- The explorer streams entries from every agent in the workspace; each entry shows timestamp (with millisecond precision), level (`info`, `warning`, `error`, `debug`), originating agent name (linked), and the message.
- A free-text search filters by message content and agent name.
- A per-agent filter (single-select, with an "All Agents" option) narrows the stream to one agent.
- Per-level filter pills show live counts (`all`, `info`, `warning`, `error`, `debug`); selecting a pill scopes the result list.
- Result count is visible as "showing N of M entries" so the user knows when their filter has hidden data.
- The explorer never silently drops entries on filter — emptied result sets show an explicit "no matching entries" state.
- The explorer is read-only at v0.3; saved queries and log export are open questions for v0.4.

---

## Stretch (Considered, Deferred)

- AV scanning on file uploads — pilot-feedback bucket.
- Workspace-scoped data residency controls — out of scope until enterprise demand validates priority.
- Custom dashboard widgets per workspace — promising; gather pilot signal before promoting.
- Structured-event-level audit and access control — explicitly moved to [v0.4 (Governance depth)](../0.4/).
- Saved log queries and log export from the v0.3 log explorer — defer to v0.4 governance alongside audit export.
- Topology-map editing (drag-to-connect, in-map node creation) — out of scope; v0.2's chat-to-PR remains the authoring path.
- Per-user notification preferences for tasks inbox — v0.4 once RBAC lands.
