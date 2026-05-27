# Changelog

All notable changes to Tembo Agent Studio. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions
match the phase numbers in [`ROADMAP.md`](./ROADMAP.md).

## [v0.4] — Governance depth — in progress

### Added
- **Immutable audit changelog (US-0.4-01).** Append-only
  `audit_event` table records actor / when / source / target /
  payload for the event types that don't already live in another
  table (secret rotations, connection authorize/disconnect/rename,
  automation lifecycle, trigger lifecycle, agent delete/restore,
  repo disconnect). The unified timeline reads explicit writes
  UNION'd with derived projections of `run` + `improvement` (both
  already event-shaped), so v0.3 emitters needed zero
  re-instrumentation. Workspace-wide `/<workspace>/audit` page
  with source / actor / agent / time-window filters (URL-driven,
  deep-linkable). Per-agent Timeline section on the agent detail
  page with click-through to the full history. New `Audit`
  sidenav item.
- **Audit JSON export (US-0.4-04).** "Export JSON →" affordance
  on the audit page (honors current filter set) and the per-agent
  Timeline (scoped to that agent). Envelope carries the filter
  snapshot + truncated flag alongside the rows. Export is itself
  audited (`kind=audit.exported`). Capped at 10,000 rows per
  download — streaming to a SIEM is the v0.5 open question per
  the story carve-out.
- **RBAC (US-0.4-02).** Three workspace-scoped roles —
  workspace_admin, operator, viewer — with a strict hierarchy.
  `lib/rbac.ts` + `lib/auth-server.ts` centralize the policy
  layer; every mutating server action and OAuth route now
  funnels through `authorizeWorkspace(slug, minRole)` and
  returns DENIED_MESSAGE on insufficient role. Role assignments
  are themselves audited (`source=policy_change`,
  `kind=member.added | member.role_changed | member.removed`).
  New Settings → Members section with role picker, add-by-email,
  and remove affordances (workspace_admin only); last-admin
  demotion is blocked in the DB helper. UI affordance hiding
  (New agent, Run now, Delete agent, Chat-to-edit) keys off the
  current user's role; server enforcement remains the contract.
  Org-admin tier deferred until there are concrete cross-workspace
  endpoints to gate on it.
- **RBAC-half of US-0.4-05 closed.** Role-assignment audit events
  (`member.added` / `member.role_changed` / `member.removed`) now
  carry the target user's name + email in the payload, and the
  audit UI renders them as readable rows ("Alice · viewer →
  operator" rather than the raw uuid). The audit-export event
  (`audit.exported`) renders the filter snapshot + row count.
  The policy-half of the AC (template version diffs, override
  events with justification) stays open until the policy
  substrate ships, since those event types don't exist yet.

### Scope moves
- **API-level deny test in CI → v0.4+.** The v0.4-02 AC asks for
  CI-verified API enforcement. The policy unit
  (`web/scripts/rbac-policy.test.mjs`) covers the role-ordering
  invariant; an HTTP-level integration deny test is deferred
  until we set up a session-aware test harness.
- **US-0.4-03 (org-level policy templates) → Backlog.** Needs an
  org concept (a scope above workspace) plus a generic policy
  resolver substrate; the rest of v0.4 ships cleanly without it.
  Pulls forward when a concrete customer use case lands or when
  v0.5 prep needs the substrate.
- **New `context/backlog/` folder.** Sibling to the numbered
  phase folders; holds designed-but-unscheduled stories with
  `Moved from: vX.Y` provenance lines. Replaces the per-phase
  `Stretch (Considered, Deferred)` pattern as the home for
  stories that *don't* have a phase yet.

## [v0.3] — Operational surface — shipped May 2026

The day-two surface. Agents reach external services through a real
substrate (no more "the model knows how to write Slack messages but
the runtime can't actually call Slack"). Operators get one screen
per agent that answers "how's it going?" and "if it's not, what's
broken?" — the v0.3 phase's "one screen, not four hours of log
spelunking" goal. The originally-planned rich-HITL pieces moved
out to make room for Connections, which ate the phase honestly.

### Added
- **Composio-backed Connections substrate.** External services
  (Slack, Gmail, Google Sheets, Notion, GitHub, Linear, HubSpot,
  Salesforce, … ~1,043 in Composio's catalog) for agents to call
  at run time. Authorized once per user per workspace via
  Composio's hosted OAuth, cached as a `workspace_composio_connection`
  row keyed by `(workspace_id, user_id, toolkit_slug, name)`.
  Per-user model: each member authorizes their own toolkits;
  scheduled runs use the automation's "Run as" owner. The
  workspace Composio API key is itself a workspace secret
  alongside Tembo / Anthropic / OpenAI keys.
- **Connections page (new top-level sidenav item).** Lists each
  `(toolkit, name)` slot declared by agents in the connected
  repo plus anything pre-authorized. Inline Disconnect /
  Reconnect / Rename actions per row, with toolkit logos pulled
  from Composio's catalog. "Add another connection" form sits at
  the bottom for pre-authorizing a slot before an agent declares
  it.
- **Toolkit picker.** Combobox over Composio's full catalog,
  alphabetized, filter-as-you-type, name + slug side-by-side
  per row with the toolkit's logo. Catalog cached in-process for
  1 hour.
- **Named connection slots.** Agent spec's `connections:` accepts
  `{ name, tools }` per toolkit so the same user can hold
  multiple Gmails / Slacks / GitHubs and an agent can target a
  specific one. Canonical form is named slot + narrow tools list
  (turns on Composio's DIRECT_TOOLS preset, ~10× cheaper input
  tokens than the loose search-and-execute path).
- **Pydantic-AI runtime pipe for Composio tools.** Python wrapper
  (`api/scripts/run_pydantic.py`) materializes a Composio session
  from the spec's `connections:` field, attaches it as an MCP
  toolset, and resolves each `(toolkit, name)` slot to the acting
  user's authorized connection. Imperative preamble prepended to
  the agent's instructions so tool-using models execute instead
  of hedging.
- **Per-agent operational dashboard.** Health header (colored by
  30-day failure-rate band), four stat tiles (Runs / Success rate
  / Spend / Avg duration), daily-trend bar (30-day strip with
  success / failure overlay), recent-failures grouping (top-5
  error prefixes by count, with a link to one example run each).
  Empty-history agents skip the dashboard so "0" tiles don't
  read as broken.
- **Persisted run cost.** New `run.cost_usd` column populated at
  `mark_succeeded` time using a model-pricing table mirrored
  in Rust (`api/src/pricing.rs`). Cost column on the workspace
  Runs page renders with the same bar-chart background as
  Duration, scaled to the highest cost in view.
- **Sidebar action-needed alerts.** When a repo agent declares a
  `connections:` slot the current user hasn't authorized, the
  sidebar shows "Connect {toolkit} for {agent}" with a direct
  authorize link. Per-user so each member sees their own gaps.
- **Multi-workspace support.** Sidebar workspace switcher,
  multi-workspace onboarding, `/` redirect lands on the
  last-visited workspace (via `workspace_member.last_visited_at`).
- **Automation "Run as" owner.** Scheduled runs use the
  automation's `owner_user_id` (defaults to creator). Owner
  picker in the automation form lists workspace members so the
  per-user connections model has a sensible answer for
  scheduled credentials.
- **GitHub fetch cache.** `listDirectory` + `readFile` cached
  for 60s tagged per repo via Next.js fetch tags. Writes
  (`createFile` / `updateFile` / `deleteFile`) bust the tag via
  `updateTag`. Cuts the sidebar-driven scan cost.
- **Event triggers (Composio-backed).** New `workspace_trigger`
  table binds a Composio trigger instance to an agent + owning
  user + connection slot. Per-workspace webhook endpoint at
  `/api/hooks/composio/{slug}` HMAC-verifies the inbound payload
  (`composio_webhook_secret` stored alongside the API key),
  resolves the trigger row, and enqueues a run with
  `trigger='event'`. Per-agent Triggers section on the detail
  page renders the list + a create form that takes a Composio
  trigger slug, a connection, and a JSON config. Event-driven
  runs show a purple **Event** badge on the workspace Runs page
  and the run-detail header.
- **Agent inventory.** Workspace landing page is now a sortable
  table (Status / Name / Framework / Model / Runs 30d / Success
  / Last run) instead of a card grid. Facet pills filter by
  Active / Idle / Error / Pending / Invalid with live counts;
  free-text search across name. Pending creates + invalid agent
  files render inline as their own rows.
- **Workspace dashboard.** `/<workspace>/dashboard` now mirrors
  the per-agent dashboard shape: health header banded by 30d
  failure rate, four stat tiles (Runs / Success rate / Spend /
  Avg duration), 30-day daily-trend bar, and a "Top failing
  agents (30d)" rollup with click-through to the latest failing
  run. Improvements counts + recent list stay below as
  secondary context.
- **Log explorer (on `/runs`).** Search predicate extended to
  ILIKE across `error_message` in addition to user_message +
  output. Failed rows surface a two-line error excerpt inline
  so triage scans don't require a click. `/runs` now reads
  `status` / `trigger` / `agent` / `q` from URL search params
  so deep links land prefiltered.
- **Failure-aware sidebar alerts.** "Action needed" rail now
  surfaces agents with at least one failure in the last 24h
  ("Agent X failed N× in 24h → Open") above the missing-
  connection alerts. Capped at five so a broken workspace
  can't shove the rail off-screen.
- **Failure investigation links on run detail.** Failed-run
  detail page now offers two jumps: "Find similar runs →"
  (deep-links into `/runs` filtered to the agent + status=failed
  + error-prefix search) and "View {agent} failure groups →"
  (anchored deep link into the per-agent dashboard's grouped
  failures section).

### Changed
- **Create-agent prompt slimmed and rebuilt around Connections.**
  `buildCreateAgentPrompt` drops the verbose guidance-refresh
  block, points Tembo at the in-repo `AGENT_GUIDE.md`, tells it
  the canonical `connections:` form is named slot + narrow tools,
  and recommends defaulting to `anthropic:claude-opus-4-7` for
  tool-using agents (Opus executes; lower-tier models hedge on
  multi-step tool dances), with downgrade-to-Sonnet documented
  as the cost-optimization step once an agent is reliable.
- **All `useActionState` forms switched to controlled inputs.**
  React 19's useActionState resets uncontrolled fields after
  each submission, including the returned-error path. Onboarding /
  repo-connect / secret-key / new-agent / run-now / automation /
  rename-connection forms all updated so a validation bounce
  doesn't wipe the user's typed input.
- **Empty-input run default.** The Python wrapper used to
  substitute `"Hello."` when a run had no user message — models
  greeted back instead of executing. New default is a directive
  (`"Execute the job described in your instructions."`).
- **Sticky sidebar.** Workspace nav stays put while the main
  column scrolls.
- **Toolkit allowlist removed.** Earlier in the phase, TAS
  hardcoded the set of Composio toolkits it recognized. That was
  actively blocking Tembo from declaring legitimate connections
  (e.g. an email-reading agent that wanted `gmail`). Connections
  are now declared by agents, and any Composio slug is accepted.

### Fixed
- **Delete-agent UI lag.** Action redirects with `?deleted={name}`;
  the agents grid defensively filters that name from the
  rendered list AND shows a confirmation banner. Instant
  feedback even when the GitHub fetch cache hasn't propagated.
- **Workspace secret validation accepted junk.** A literal HTML
  404 page text once landed in a workspace's Composio API key
  field. Per-kind prefix sniff at save now catches this (`ak_`
  for Composio, `sk-` for OpenAI, `sk-ant-` for Anthropic);
  the runtime no longer 401s silently when a non-key string
  was pasted.

### Scope moves
- **HITL pause/resume + rich forms → v0.4.** Originally a v0.3
  anchor; the Connections substrate ate the phase, and the
  remaining v0.3 work (workspace-wide triage surfaces + failure
  investigation) landed in its place. HITL is the next major
  substrate piece and anchors v0.4.
- **Workspace-wide triage surfaces → mostly shipped, residuals
  to v0.4.** Agent inventory ✓, workspace dashboard ✓, log
  explorer (extended `/runs`) ✓, failure-aware sidebar ✓.
  Topology map + tasks inbox land in v0.4 (tasks inbox depends
  on HITL anyway).
- **Event-trigger form polish → v0.3+.** Trigger slugs are
  currently entered as free text (linked to Composio's catalog).
  Schema-driven per-trigger config forms (pulled from
  `getTriggerType`'s `config` schema) land in a later iteration.

## [v0.2] — Authoring velocity — shipped May 2026

The chat-to-PR loop. A non-engineer describes an agent (or a change to one)
in plain English; Tembo opens a pull request; the team reviews a diff.

### Added
- **Chat-to-create.** New agents start from a chat description on the
  `/agents/new` page. Tembo writes a valid agent file in the chosen
  framework's canonical shape and opens a PR. Pending creates appear as
  dashed-border cards on the agents grid until the PR merges.
- **Chat-to-edit.** Each agent has a chat thread. "Send to agent" runs the
  agent with your message; "Submit change request" packages the message and
  hands it to Tembo, which opens a PR. Both intents share one composer.
- **Improvement loop.** Run-detail "Improve the Agent" form ships free-text
  feedback to Tembo as a coding task. The opened PR carries a marker that
  lets TAS correlate merged PRs back to the improvement row. New
  `/improvements` page lists every submission with status (submitted /
  PR opened / merged / closed).
- **Automations.** Scheduled runs via cron expressions. New `/automations`
  route with a list, create/edit form (live cron preview + next-fire in
  local time), and an enable/disable toggle. Agent detail page surfaces an
  agent's automations. Run rows show a "Scheduled" badge and link back to
  the automation. Single-process Node.js scheduler tick at 30s resolution,
  fires through the same `/internal/runs` path as manual runs.
- **Runs page.** Workspace-wide run list with status / trigger / agent
  filters, ILIKE search across input + output, cursor-paginated "Load
  more". Whole-row click navigates to the run detail. Relative-time
  "5m ago" inside 24h, absolute `LocalTime` beyond. Subtle bar-chart
  background on the Duration cell scaled to the longest run in view.
- **Dashboard.** Per-workspace landing page: active vs. all-time agent and
  run counts, weekly improvement breakdown, recent improvements feed.
- **Run-now with input.** Clicking Run now on the agent detail page opens
  a dialog with an autofocused textarea for the user message. Empty
  submission preserves the prior "no input" behavior.
- **Floating copy button** on the run-detail output card. Hover-only,
  cross-fades in over 150ms, strips the `[stop_reason]` suffix before
  copying.
- **OpenAI provider.** Agents can declare `openai:gpt-...` models alongside
  Anthropic.
- **AGENTS.md hierarchy.** A root `AGENTS.md` and `api/AGENTS.md` join the
  existing `web/AGENTS.md`. Each coding-request prompt to Tembo also pushes
  current TAS-managed guidance files into the customer's workspace repo:
  root `AGENTS.md`, `agents/AGENTS.md`, and per-framework `AGENT_GUIDE.md`
  files are refreshed on drift; customer-managed
  `ADDITIONAL_AGENT_INSTRUCTIONS.md` is created once, never overwritten.
- **Settings → Sync agent guidance.** One-click bootstrap or refresh of
  the guidance files into the connected workspace repo, for repos whose
  agents predate the auto-bootstrap.
- **LocalTime hover-to-UTC.** Datetime renders local with the local-tz
  abbreviation by default; hover/focus cross-fades to the same instant
  in UTC over 500ms. Uses inline-grid so the container sizes to the
  wider string and surrounding text doesn't jump.

### Changed
- **Passthrough runner.** Both supported frameworks now shell out to the
  upstream tool — Cargo AI via the bundled `cargo-ai` CLI; Pydantic AgentSpec
  via the real `pydantic-ai` library in a bundled Python venv. The Rust API
  no longer hand-rolls provider calls.
- **Markdown output.** Agent output renders as markdown by default.
- **Feedback → Improvement rename** everywhere (DB table, routes, UI copy).
  The PR-correlation marker `TAS-Feedback-ID:` is kept as a wire-format
  constant for back-compat with in-flight PRs.
- **`/agents/new` simplified.** Removed "From template" and "Paste
  definition" tabs; chat is the only path now. Lib code for the removed
  paths (`createAgentFromTemplate`, `createAgentFromContent`,
  `commitAgentFile`, starter renderers) dropped.
- **Base UI primitives.** New `Select` component built on `@base-ui/react`.
  `Badge` padding bumped, `Input` height bumped, framework label shortened
  to "Pydantic" / "Cargo AI".

### Scope moves
- **US-0.2-08 (event-driven triggers) → v0.3 US-15.** Depends on the
  Connections substrate v0.3 owns; building a one-off github-only
  webhook receiver in v0.2 would have been a snowflake.
- **US-0.2-06 (HITL pause/resume) → v0.3 US-13b.** Merges cleanly with
  v0.3's rich-HITL-forms work; splitting it across phases meant v0.3
  would have to immediately rewrite the v0.2 surface.
- **US-0.2-03/04 (PR policy) → backlog.** Blocked on the Tembo Coding
  Agent Platform shipping a direct-commit mode; today CAP always opens
  a PR, so there's no auto-merge surface to wire.

## [v0.1] — Foundation — shipped May 2026

The trustworthy floor: self-hosted deploy, identity, repo connection, runs.

### Added
- Docker-compose deploy: Next.js 16 web + Rust axum API + Postgres.
- Auth via better-auth + Google OAuth (email/password disabled, in-app
  instructions for swapping providers).
- GitHub OAuth repo connection — token stored AES-256-GCM-encrypted on the
  workspace row.
- Agents listed from the connected repo as a 3-column card grid (last run
  status, framework + model badges, search). Two framework families
  supported: **Pydantic AgentSpec** and **Cargo AI**, each under their own
  `agents/<framework>/` subfolder.
- Create-agent flow (from template or paste, with framework picker).
- Manual runs against Anthropic Claude (Opus / Sonnet / Haiku). Output
  streams to a run detail page with status, model, queued/started/duration,
  and token consumption + approximate cost.
- Soft-delete + restore for agents (commits to the repo on both ends;
  deletion record retained for audit).
- Per-workspace favicon picker (default set + custom upload).
- Theme picker in settings: System / Light / Dark mode toggle, eight
  built-in presets (Light, Paper, Pure Light, Dark, Midnight, Forest,
  Ember, Blackout), local-only persistence.
