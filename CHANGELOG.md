# Changelog

All notable changes to Tembo Agent Studio. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions
match the phase numbers in [`ROADMAP.md`](./ROADMAP.md).

## [v0.3] — Operational surface — in progress

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
- **HITL pause/resume + rich forms → v0.3+.** Originally a v0.3
  anchor; the Connections substrate ate the phase honestly.
  Once Connections settles, rich HITL is the natural next bite.
- **Workspace-wide triage surfaces (agent inventory, topology map,
  tasks inbox, log explorer) → v0.3+.** Per-agent dashboard
  ships in v0.3; the workspace-wide cousins follow.
- **Event triggers (US-0.2-08, moved into v0.3) → v0.3+.** The
  Connections substrate they depended on is now in place;
  webhook receiver + event filtering land next.

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
