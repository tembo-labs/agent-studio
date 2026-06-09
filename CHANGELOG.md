# Changelog

All notable changes to Tembo Agent Studio. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

**Versioning:** releases use a year.month [CalVer](https://calver.org/) tag plus
a release counter — `vYYYY.M.N`. `YYYY.M` is the year and month; `N` increments
once per release within that month and is **not** the day of the month (the
earliest 2026 tags happened to line up with the date, but it's just a counter).
The `0.1`–`0.4` entries below are phase numbers from
[`ROADMAP.md`](./ROADMAP.md), which remain the *construction* milestones;
they are no longer release versions. Phase scope now lives in
[GitHub Issues](https://github.com/tembo/agent-studio/issues?q=is%3Aissue+label%3Aenhancement).

## [Unreleased]

### Added
- **Free-text agent names.** Name an agent in normal text (e.g. "Inbox Triage")
  — the create form slugifies it for the filename and saves the text as a new
  optional `title:` field on the spec. The agents list, agent page, and chat
  header show the `title` (falling back to the slug); the slug `name` stays the
  stable identifier for URLs, runs, and automations, so nothing else changes.

### Fixed
- **Historical run-cost backfill.** Recomputed the stored `cost_usd` on existing
  runs against the corrected model rates (Opus $5/$25; gpt-5.x priced per
  variant), so the Runs list and dashboard totals match the run-detail estimates
  for pre-fix runs. Only rows with token counts + a known model family are
  touched; unknown models and already-correct families are left as-is.
  *(migration 0048)*

## [v2026.6.14] — Agent Skills, YOLO mode, Claude Fable 5 — shipped 2026-06-09

### Added
- **Agent Skills.** A workspace **Skills** area to install reusable Agent Skills
  (Anthropic's `SKILL.md` folders) into your repo under `skills/`, from three
  sources: the [skills.sh](https://www.skills.sh/) directory (by slug / GitHub
  URL), a custom `.zip` upload, or **imported from the Claude Skills API** (the
  org's custom skills + Anthropic's pre-built ones, via the version-content
  export). An agent opts in with a `skills:` field; at run time the named skill
  folders are mounted via pydantic-ai-skills so the model can load their
  instructions and run their scripts — **locally, with any model** (no Anthropic
  code-execution sandbox). Install/remove is workspace-admin and audited.
- **YOLO (direct-commit) delivery mode.** A per-workspace setting
  (**Settings → Tembo Coding Agent → Improvements delivery**) chooses how the
  coding agent's changes land: **Always PR** (default — a reviewable pull
  request) or **YOLO**, which commits straight to the default branch with no PR.
  The mode is read per request to shape the Tembo prompt, so toggling takes
  effect on the next submission with no repo re-sync. YOLO improvements show a
  terminal **Committed** status and link the landed commit; a best-effort scan
  finds the marker commit on the default branch to attach it. Switching mode is
  workspace-admin-only and audited. *(migration 0047 — `workspace.commit_mode`
  + `improvement.delivery` / `commit_sha` / `commit_url`)*
  - YOLO requires the default branch to accept direct pushes from the coding
    agent; if it's protected behind required pull requests, keep Always PR.
- **Claude Fable 5 support.** Agents can use `anthropic:claude-fable-5` —
  Anthropic's most capable widely-released model (Mythos-class, 1M context),
  GA on the Claude API as of 2026-06-09. Priced in the run-cost estimates at
  $10/$50 per MTok (web + API tables), and added to the authoring guidance as
  the top-capability step-up above Opus 4.8.

### Fixed
- **Opus run-cost estimates.** Corrected the `claude-opus` rate from the stale
  $15/$75 to the current $5/$25 per MTok (current Opus 4.5–4.8), so cost
  estimates and the stored `cost_usd` are accurate. (The $15/$75 rate only ever
  applied to the deprecated Opus 4.1/4.0.)
- **OpenAI gpt-5.x run-cost estimates.** The single `gpt-5` rate ($1.25/$10) was
  mis-pricing the whole gpt-5.x family. Added per-model rates for the current
  flagships and intermediate releases — gpt-5.5 ($5/$30), gpt-5.4 ($2.50/$15,
  + mini/nano), gpt-5.2 ($0.875/$7), gpt-5.1 ($0.625/$5) — ahead of the bare
  `gpt-5` catch-all. gpt-4o / gpt-4.1 / o3 were already correct. Authoring
  guidance now references `openai:gpt-5.5` instead of the older gpt-5.2.

## [v2026.6.13] — In-app docs, workspace rename, Automations area — shipped 2026-06-09

### Added
- **In-app documentation.** The product manual now ships inside the app, pinned
  to the exact version you're running — a **Docs** link in the sidebar opens a
  full viewer with search, a sticky collapsible nav whose open/closed state
  persists across sessions, and a GitHub-stars link in the footer. Content is
  organized by audience — **For Operators** (The Basics / Advanced), **For
  Admins** (workspace admin + self-hosting), and **For Instance Admins** — and
  every page, including the live **Changelog** and **Roadmap**, is bundled at
  build time so it always matches the deployed release.
- **Rename a workspace.** A new **Settings → General** section (workspace-admin
  only, now the default Settings tab) renames a workspace. GitHub-org style: the
  URL slug follows the name, and the previous slug is kept alive as a redirect —
  preserving deep links (`/old/agents/x` → `/new/agents/x`) — so existing links
  and bookmarks never break. Renames are recorded in the audit log. *(migration
  0046 `workspace_slug_alias`)*
- **Workspace-level Automations area.** A dedicated **Automations** section in the
  sidebar with its own nav — **Schedules**, **Triggers**, and **Webhooks** — so
  recurring runs and event wiring have a home across the whole workspace, not
  just per-agent. On the agent page, Schedules moved to the top of the renamed
  **Automation** tab.
- **Role badge in the shell.** Your workspace role (Workspace Admin / Operator /
  Viewer) now shows under your name in the bottom-left user menu.
- **Agents table filters.** Filter the agents inventory by label and by model.

### Changed
- **Roadmap rewritten** as a simple, unphased list of ideas — each described in a
  couple of sentences and linked to a GitHub Discussion holding a draft **TASIP**
  (Tembo Agent Studio Improvement Proposal) where you can weigh in.
- **Docs stay in sync by policy.** `AGENTS.md` now instructs coding agents to
  update the docs alongside feature changes, backed by a non-blocking CI reminder
  when app code changes without a matching docs change.

### Fixed
- **Reliable merged-PR detection for improvements.** Improvements with a known PR
  number are now confirmed via a direct PR fetch instead of the search API, so a
  merged improvement no longer lingers as "open".

## [v2026.6.12] — Live run timeline, output discipline, Native MCP admin — shipped 2026-06-08

### Added
- **Run view rebuilt as a live step timeline.** The run-detail page now shows
  one view — built live and identical when finished — of what the agent did,
  step by step: the model's narration (revealed word-by-word while running), the
  tools it called (provider logo + ok/failed/running badge inline), and a
  per-step **In / Out token + cost** readout, with a totals footer (In, Out, and
  combined total). A "Copy" button lifts the whole transcript (narration +
  answer + tool calls) as plain text. The final answer is the last step — no
  separate Output box.
  - The wrapper streams text deltas + tool-call/result events as they happen; the
    runner persists `run_step` / `run_tool_call` rows live so the table builds in
    place, reconciled authoritatively at run end.
  - Per-step token usage + per-tool-call attribution. *(migrations 0043
    `run_step`, 0044 `run.streamed_output`, 0045 `run_step.summary`)*
- **Output discipline for every agent.** A global instruction makes agents work
  silently — no step-narrating or raw tool-output dumps in the reply — while
  allowing one short "what I'm doing" line per tool step (which feeds the
  timeline narration). Stops agents from burning the output-token budget.
- **Real parallel-tool-call limiter.** Agents now default to
  `model_settings.parallel_tool_calls = False` — an API-level cap so the model
  issues one tool call at a time instead of fanning out parallel bursts that get
  providers (e.g. Attio) rate-limited. Opt back in per-agent via the spec. Paired
  with tool-use guidance to back off on `retry after` errors.
- **Native MCP admin screen.** A workspace-admin "Manage providers" screen
  (Connections → Native MCP) to enable/disable which providers members see and
  register **multiple named OAuth-app instances** per confidential provider, so a
  second connection can use a second app. *(migration 0042
  `workspace_native_mcp_provider` + instance columns on
  `workspace_native_oauth_client`)*

### Changed
- **Agents table:** Name is the first column with alphabetical default sort;
  Labels get their own column; the Framework column is gone; the Model column
  strips the provider prefix (`anthropic:claude-sonnet-4-6` → `sonnet-4-6`).
- **Per-agent Runs tab** reuses the workspace Runs table (same columns minus
  Agent + Input), keeping status/trigger/search filters.
- **Sidebar "Action needed"** collapses duplicate missing-connection alerts into
  one card ("HubSpot for 3 agents") instead of one per agent.
- **Dashboard:** dropped the "Workspace-wide activity" subhead; Recent runs now
  show who triggered each run.

### Migrations
- `0042_native_mcp_admin` — provider enable flags + OAuth-app instances.
- `0043_run_step` — per model-step token usage + `run_tool_call.step_ordinal`.
- `0044_run_streamed_output` — live partial output column.
- `0045_run_step_summary` — per-step narration text.

## [v2026.6.11] — HubSpot via Native MCP (bring-your-own OAuth app) — shipped 2026-06-08

### Added
- **HubSpot as a Native MCP provider** (`https://mcp.hubspot.com`). HubSpot
  doesn't support auto-registration (DCR) and uses a confidential OAuth client,
  so this adds a **"bring-your-own OAuth app"** mode to Native MCP — generic for
  any future non-DCR provider:
  - `McpProvider.authMode` (`dcr` | `manual`); manual providers run a
    confidential PKCE flow with an admin-stored client_id/secret instead of
    self-registering a public client.
  - An admin **Configure OAuth app** card on **Connections → Native MCP** shows
    the redirect URI to register and stores the client_id/secret (encrypted);
    the per-user **Connect** button is gated until it's configured.
  - Token refresh presents the confidential client_secret for these
    connections. *(migration 0041 `workspace_native_oauth_client`)*

  To use it: create a HubSpot MCP auth app with redirect URI
  `<origin>/api/connections/native/hubspot/callback`, paste its client_id/secret
  under Connections → Native MCP, then Connect and reference
  `{ type: hubspot, source: native-mcp }` in an agent.

### Changed
- **Automations** collapses by default on the agent Automation tab (matching
  Triggers + External webhooks), with a count in the title.

### Migrations
- `0041_workspace_native_oauth_client` (per-workspace BYO OAuth client for manual
  Native MCP providers). Applied on api boot.

## [v2026.6.10] — Agent view redesign + run-time connection guard — shipped 2026-06-08

The agent page was a long vertical stack; it's now a focused, Settings-style
view with a left side-nav. Plus a guard that stops a run before it starts when
the connections aren't set up. Web-only — no new migrations.

### Added
- **Agent view side-nav** — the agent page is reorganized into a shared header
  (name, version, owner, connections, primary actions) + a left tab rail, with
  one real route per tab: **Overview** (30-day dashboard + recent runs),
  **Runs**, **Automation** (triggers + webhooks + schedules), **Versions**,
  **Definition** (spec + tools module), **Activity** (audit timeline), and
  **Settings**. Each tab fetches only its own data.
- **Connection icons on the agent view** — a row of the external services the
  agent uses, each with its **provider name + logo** (logos borrowed from
  Composio's library; a generic icon when a slug has none).

### Changed
- **Decluttered the agent header** — Delete moved to **Settings → Danger**;
  **Promote to Stable** moved to the **Versions** tab (the header keeps the
  read-only "Stable vN" badge); the ownership picker moved to **Settings** (the
  header shows a read-only owner). The header's action row is just
  **View source · Chat to edit · Run now**.
- **Triggers + External webhooks collapse by default** on the agent view, with a
  count in the title so configured items stay visible.

### Fixed
- **Block a run when the acting user's connections aren't set up** — a clear
  pre-flight message ("You haven't connected: HubSpot. Authorize under
  Connections, then run again.") instead of a pydantic-ai traceback mid-run.
  Applies to Run-now and Chat-to-edit.
- **Lint/CI** — pin `eslint` to 9 (eslint 10 removed an API `eslint-plugin-react`
  still uses, crashing the lint step), and fix the placeholder Dependabot config
  (real per-ecosystem groups; Astro + Starlight always bump together).

### Dependencies
- A wave of Dependabot updates: Next 16.2.7, React 19.2.x, Astro 6.4.4,
  TypeScript 6, and many GitHub Actions (`checkout`, `setup-node`, the docker/*
  actions, codeql, pages) — all verified green.

## [v2026.6.9] — Agent lifecycle, tool observability, and the ETL-agent stack — shipped 2026-06-08

A big release. Agents gain a real **version lifecycle** (draft → stable) and
**tool-call observability**, and a new **ETL-agent stack** lands: agents can run
deterministic **Python tools**, authenticate them through a new **Secrets**
substrate, and be **triggered by external webhooks** (Clay first). The full
**user manual** is now published, and the `guides/` directory moved into it.

### Added
- **Agent versioning & lifecycle** — agents now have a **draft** (the live repo
  file) and a promotable **stable** snapshot frozen in Postgres. Promotion
  records owner + version; runs default to **stable** for predictability (chat
  iterates on draft). The agent page shows version history, the draft↔stable
  diff, and a change summary. *(migration 0037)*
- **Sidecar Python tools** — a Pydantic agent can declare `tools_module: foo.py`,
  a sibling file of deterministic functions the model calls as tools (transforms,
  scoring, ETL) at **no token cost**. Schemas derive from each function's
  signature + docstring; calls are captured like MCP tools. Extra deps go in
  `api/scripts/requirements-tools.txt`.
- **Secrets — the 3rd connection substrate** — free-form, per-workspace API keys
  (e.g. Clay) set under **Connections → Secrets** (admin-managed, AES-256-GCM).
  Sidecar tools read a value via `tas_tools.secret("<name>")`; injected only
  into runs that have a tools module. *(migration 0039)*
- **External webhook triggers** — a per-agent inbound endpoint
  (`/api/hooks/webhook/<id>`) fires a run from any outside system. Built for
  Clay's model: `POST` JSON + an `Authorization: Bearer <token>` header
  (constant-time verified, shown once, rotatable); fire-and-forget 202. The
  request body reaches the agent as a `{trigger_type, webhook, payload}`
  envelope. *(migration 0040)*
- **Tool-usage tracking** — every tool an agent calls is captured per run
  (success + failure), rolled up per agent over 30 days, and surfaced in a
  workspace-wide, filterable **Tool uses** view. *(migration 0038)*
- **Pylon** as a Native MCP provider.
- **Two-level collapsible sidebar** navigation (Build / Activity / Integrations /
  Workspace).
- **Published user manual** — an Astro Starlight site at
  <https://tembo.github.io/agent-studio/>, deployed from `docs/` on every change.

### Changed
- **Prefer Native MCP over Composio** in the agent-authoring guidance, with a
  dynamic provider list; default model guidance moved to `claude-opus-4-8`, and
  the `labels:` extension field is documented.
- **`guides/` merged into the docs site** and deleted; the README and deploy
  guides now point at the published manual.

### Fixed
- **Native MCP token refresh** for short-lived tokens (Pylon ~5-min tokens) via a
  per-provider refresh allowlist.
- **Composio**: surface connect errors instead of swallowing them; support
  bring-your-own-auth toolkits; flag unknown toolkit slugs; fix a Pylon→Linear
  OAuth misroute and a "no active connection" false negative.
- **Agent versioning**: fix a promote crash (`FOR UPDATE` with an aggregate) and
  owner-picker name disambiguation.
- **"Improve the Agent"** now surfaces a thrown/stale server action ("refresh —
  a new version shipped") instead of failing silently.
- **Docs build**: upgrade Starlight to 0.39 for Astro 6 compatibility, and
  replace the placeholder Dependabot config with real per-ecosystem groups
  (Astro + Starlight always bump together).

### Migrations
- `0037_agent_version`, `0038_run_tool_call`, `0039_workspace_secret_connection`,
  `0040_workspace_webhook`. The api applies them on boot.

## [v2026.6.8] — Slack apps: launch agents from Slack — shipped 2026-06-04

TAS can now host per-team Slack bots that launch a **label-scoped subset** of
your agents — separating cheap routing from right-sized execution, so dozens of
agents are reachable from Slack without dozens of channels or one expensive
mega-agent.

### Added
- **TAS-managed Slack apps** (Settings → Slack apps, admin-only) — register one
  bot per team (e.g. a sales bot and a support bot), each scoped to a subset of
  agents by label. Coached setup: copy a prefilled Slack manifest, paste
  credentials, then **Add to Slack** (OAuth) to install. Signing secret, client
  secret, and bot token are AES-256-GCM encrypted; multi-app from day one.
- **Launch agents from Slack** — slash command `/tas <agent> <input>`,
  `@mentions`, and DMs. The run acts as the Slack user (matched by email),
  falling back to the app's default owner, and the result posts back in-thread.
- **Agent labels** — add `labels: [sales]` to an agent spec to group it in the
  inventory and scope which Slack app may launch it. Documented as a TAS
  extension field in [`AGENT_FORMAT.md`](./context/shipped/0.1/AGENT_FORMAT.md).
- **Natural-language routing** — a Slack message that doesn't name an agent is
  routed by a cheap Haiku 4.5 classifier to the best-fit scoped agent (or replies
  with the menu when nothing fits).
- **Agent picker modal + App Home directory** — `/tas` with no agent opens a
  picker; the bot's Home tab lists every agent it can launch.
- **"Run agent on this message" shortcut** — launch an agent with any Slack
  message as its input, prefilled into the picker.
- **Runs "Source" column** — the runs list now shows how each run was instigated
  (Manual / Scheduled / Event / Slack), who it acted as, and — for Slack — a deep
  link back to the originating conversation.
- **Dashboard "Slack (30d)" column** — per-member count of Slack-launched runs,
  with a per-bot breakdown on hover.

### Changed
- Slack replies render the agent's Markdown as Slack **mrkdwn** (bold, headings,
  links, bullets, tables) and drop the leading `user>` transcript echo.
- Dashboard **Team** rows append the email when two members share a first name.

### Hardening
- Per-Slack-user rate limit, replay dedupe on Slack retries, and an audit event
  (`slack.dispatch`) per Slack-launched run.

### Fixed
- Slack Web API calls are now form-encoded — fixing the read methods that
  silently ignore a JSON body, so the acting-user email→member mapping and the
  message permalinks (the "View in Slack" links) work.

## [v2026.6.7] — Team visibility + admin management — shipped 2026-06-04

A batch focused on workspace admins seeing and managing what members own.

### Added
- **Team section on the dashboard** — a per-member table (Connections /
  Automations / 30-day runs), sorted by run activity. Hover a count for the
  underlying list (which toolkits are connected, which agents have
  automations) via a styled, fast tooltip.
- **Member detail view** — admins click a member (from Settings → Members or
  the Team table) to see their tool connections, the automations that "Run as"
  them, and their recent runs. Useful before offboarding (see #64).
- **Admins can view + rename any member's connections** — a "Viewing" dropdown
  on the Connections page (defaults to self). When viewing another member you
  can Rename and Refresh; Connect/Reconnect/Disconnect are hidden since OAuth
  must be performed by that member.
- **Admin "Run as" in the manual Run-now dialog** — pick which member to run as;
  the run uses that member's connections (same model as an automation owner).
- **"Run as" owner column** on the automations list.

### Changed
- Member rows: **Remove** is red with a confirm step, and the whole row links to
  the member detail view.
- The Composio connection-rename action is now gated to owner-or-admin (parity
  with the native-MCP rename).

## [v2026.6.6] — Dismiss pending agents + settings polish — shipped 2026-06-04

### Added
- **Dismiss pending agents** from the workspace home. In-flight chat-to-PR
  creates can now be removed from the inventory via an inline confirm
  (operator+); it stops tracking the create here and leaves the GitHub PR
  alone (the PR / Tembo-session links still reach it).

### Fixed
- **Composio webhook secret field** no longer implies a `whsec_` prefix — those
  secrets are prefix-less hex, so the masked preview/placeholder were
  misleading (same class of fix as the Tembo API key field in v2026.6.5).
- **Sidebar "Action needed" CTA** (the "add an LLM key" prompt) now updates
  without a manual browser refresh when a provider key is added or removed — it
  lives in the workspace layout, which now revalidates at layout level.

## [v2026.6.5] — Tembo authoring fix + favicon fixes — shipped 2026-06-03

### Fixed
- **Tembo Coding Agent authoring (the "Invalid token" 401).** Requests now hit
  `POST /public-api/task/create`, where the workspace's Tembo API key
  authenticates as `Authorization: Bearer`. We were calling the bare
  `/task/create` path, which a different internal auth gate rejected with
  "Unauthorized - Invalid token" — so new-agent / chat-to-edit / Improve failed
  even with a valid key. **This is the fix that unblocks authoring.**
- **Workspace favicon blank in production.** The favicon route's redirect used
  the container's internal address (`https://0.0.0.0:8080/…`) behind the proxy,
  which the browser can't reach; it now emits a relative `Location`. Also
  cache-busts the default and per-workspace favicon URLs so a stale per-origin
  favicon entry clears (and switching a workspace's favicon actually updates).
- **Tembo API key field** no longer shows a misleading `tembo_` prefix in the
  masked preview/placeholder — keys are prefix-less.

### Added
- **Actionable Tembo auth errors.** A rejected/rotated key now surfaces "Tembo
  rejected the API key — update it under Settings → Tembo Coding Agent" instead
  of a raw 401, across the new-agent / chat / Improve flows.
- **Setup guide:** the agents repo must also be authorized in Tembo (Settings →
  Integrations → Source Control) for the coding agent to open PRs.

### Changed
- Sidebar agents icon matched to Tembo's (#61).
- Docs: clarified CalVer is year.month + a per-month release counter (not the
  day of the month).

## [v2026.6.4] — Workspace deletion, invite auto-join, LLM-key CTA — shipped 2026-06-03

### Fixed
- **Invited existing users now join automatically.** Inviting someone who
  already had an account previously left a pending invite with no way to accept
  it — on sign-in they were prompted to create their own workspace instead of
  landing in the one they were invited to. Existing users are now added to the
  workspace at invite time, and any already-pending invite resolves on the
  user's next sign-in. (Recommended upgrade for instances using invitations.)

### Added
- **Delete a workspace** — Settings → **Danger** tab, with a type-to-confirm
  step, gated to workspace admins. Removes all workspace data (members, runs,
  schedules, connections, secrets, settings, audit, invitations); the GitHub
  repository and its agent files are not touched.
- **Sidebar CTA when no LLM provider key is set** — a workspace with neither an
  Anthropic nor OpenAI key now shows an "Action needed" card linking to
  Settings → LLM Providers, since agents can't run without one.

## [v2026.6.3] — Security hardening, dashboard runs, version surfacing — shipped 2026-06-03

A security-focused release (several authorization/tenant-isolation fixes), plus
dashboard and CI improvements. **Recommended upgrade for all instances.**

### Fixed (security)
- **Reject an insecure placeholder `BETTER_AUTH_SECRET` at runtime** — the app
  now refuses to start with the dev placeholder secret, so a misconfigured
  deploy can't run with a guessable session-signing key (#52).
- **Tenant scoping on the run-detail endpoint** — `get_run` now enforces the
  caller's workspace, preventing cross-workspace run reads (#58).
- **Authorization check on repo connect** — `connectRepoAction` was missing a
  role check; added it so only authorized members can connect a repo (#55).
- **Mass-assignment fix** — `owner_user_id` can no longer be set from request
  input (#56).
- **SSRF + token exfiltration fix** — closed a server-side request forgery /
  token-leak path (#57).

### Added
- **Settings → Version tab** — shows the running release (release builds link to
  their GitHub release; edge/CD builds link to the commit).
- **Recent runs on the dashboard** — the latest runs workspace-wide, above
  Improvements, with fully clickable rows linking to the run.

### Changed
- **CI checks gate + tests on PRs.** A `checks` workflow now runs on every PR:
  web typecheck + vitest + eslint (now blocking after the lint cleanup in #54),
  and api `cargo fmt --check` + clippy + `cargo test`. A separate pipeline
  continuously deploys `main` to Tembo's internal instance behind that gate.
- **Docs:** Railway guide documents pinning explicit version tags for
  production vs. `:latest` for throwaway instances.

## [v2026.6.2] — Reproducible runtime, setup guide, Microsoft sign-in fix — shipped 2026-06-02

A small maintenance release: lock the last floating runtime dependency so a
rebuilt image tag is reproducible, ship a start-here setup guide, and fix
Microsoft Entra sign-in for self-hosted instances.

### Fixed
- **Microsoft Entra sign-in.** Entra commonly omits the `email` claim from both
  the id_token and the userinfo endpoint (the address lives in
  `preferred_username`/`upn`), which made better-auth fail sign-in with
  `email_is_missing`. The Microsoft provider now decodes the id_token and
  derives the email from `email ?? preferred_username ?? upn`.
- **Opaque sign-in errors.** Failed OAuth callbacks redirected back with a bare
  `?error=<code>` and no UI feedback; the sign-in page now renders an actionable
  message (invite-only, missing email, token exchange, …) and surfaces the raw
  code for support.

### Changed
- **Pinned `composio==0.13.1`** in the api runtime image. It was the one
  unpinned Python dep (pydantic-ai and pyyaml were already pinned); since
  Composio ships frequently, an unpinned bump could break connection-using
  agents on the next rebuild of a given image tag.

### Added
- **Version on the login screen.** The footer now reads "powered by Tembo Agent
  Studio `<version>`" so operators can see at a glance which release an instance
  is running. The version is **baked into the image at build time** (web
  Dockerfile `TAS_VERSION` build-arg), so it always matches the running image —
  no env var to set or keep in sync per instance.
- **`guides/CUSTOMER_SETUP.md`** — a zero-to-running checklist covering
  everything a new customer must procure and do: infra, auth provider, LLM
  keys, secrets, deploy env, first-run instance-admin bootstrap, per-workspace
  setup, and creating the first agent. Linked from the README as the
  start-here guide.

## [v2026.5.31] — Container image publishing — shipped 2026-05-31

Makes TAS deployable from prebuilt images instead of a source build, and
hardens the supply chain around them.

### Added
- **Container images published to GHCR.** A release workflow
  (`.github/workflows/release.yml`) builds and pushes `tas-api` +
  `tas-web` to `ghcr.io/tembo/` on every `v*` tag, tagged
  `<version>` / `<major>.<minor>` / `latest`. Images are **cosign**
  keyless-signed and carry SBOM + provenance attestations; **Trivy**
  scans each image (report-only). A `compose.release.yaml` runs the
  stack from those images (`docker compose -f compose.release.yaml pull
  && up -d`), pinned by `TAS_VERSION` and kept in lockstep with each
  release via an auto-opened PR. Customers no longer compile Rust/Node
  on their host.
- **Onboarding sign-out link.** A "Signed in as … Not you? Sign out"
  affordance on both onboarding steps (`/onboarding` and
  `/onboarding/repo`) so someone who authenticated with the wrong
  Google account can recover without an app shell to hang a user menu
  off of.
- **Dependabot** enabled for GitHub Actions + npm.
- **Instance-admin role + root `/settings`.** Deployment-level admin via
  the `INSTANCE_ADMIN_EMAILS` allowlist, and a root `/settings` surface
  (instance-admin only) with an editable, DB-backed instance name
  (`instance_settings`, migration 0031; env fallback).
- **Invite-only instance + workspace invitations.** Account creation is
  rejected unless the email is an instance admin or has a pending invite.
  Workspace admins invite by email (migration 0032) and get a copy-paste
  template; invitees auto-join their workspace(s) on first sign-in.
  Workspace creation is instance-admin-only. `INSTANCE_ADMIN_EMAILS` is
  the required bootstrap env (without it nobody can sign in to a fresh
  instance).
- **Build fix:** `api/build.rs` (`rerun-if-changed=migrations`) so new
  migrations actually embed in the image — `sqlx::migrate!` is
  compile-time, and a migration-only change otherwise got cached out.

### Changed
- **api image runs as a non-root user** (uid 1001), matching web. The
  run path writes nothing to disk (spec via stdin, result via stdout),
  so no writable app dir is needed.
- **api defaults to a dual-stack bind** (`API_BIND_ADDR=[::]:8080`).
  Serves IPv4 + IPv6, so Docker Compose is unchanged while IPv6-only
  private networks (e.g. Railway service-to-service) reach the api with
  no configuration.

### Fixed
- **Client auth base URL is resolved at runtime** from the browser
  origin instead of the build-time `NEXT_PUBLIC_BETTER_AUTH_URL` (which
  is inlined when the image is built, so a prebuilt GHCR image baked
  `http://localhost:3000` and sign-in failed on any real domain). Fixes
  sign-in for every image-based deploy.
- **postcss bumped to ≥ 8.5.10** via a pnpm override to clear
  GHSA-qx2v-qp2m-jg93 (a CSS-stringify XSS in the copy Next pins
  transitively). Not reachable in TAS — build-time, dev-authored CSS —
  resolved to clear the alert and de-dupe to one postcss.

## [v2026.5.29] — First CalVer release — shipped 2026-05-29

The cutover to date-based releases. Everything through Phase 0.4
(Governance depth) is captured below; this tag marks the first release
cut from `main` under the new scheme and ships one new capability on top
of v0.4.

### Added
- **Native-MCP OAuth token auto-refresh.** The runner now refreshes
  expiring native-MCP access tokens *before* a run reads them, instead
  of letting an expired token reach the agent and 401 mid-run. For any
  active oauth2 native connection (e.g. Attio) whose `token_expires_at`
  is at/near expiry, it spends the stored `refresh_token` (granted via
  `offline_access`) for a fresh token at the provider's discovered token
  endpoint, re-encrypts the credentials, and bumps `token_expires_at`.
  A rejected refresh (dead refresh token) proactively flips the
  connection to `stale` so the UI prompts Reconnect; transient failures
  are logged and the run proceeds on the existing token. Best-effort and
  per-connection. `crypto.rs` gained an `encrypt()` twin to its existing
  `decrypt()`; refresh lives in the runtime (`native_oauth.rs`) so no
  plaintext round-trips through the web container.

### Changed
- **Roadmap tracking moved to GitHub Issues.** Phase 0.5 / 0.6 user
  stories and the backlog are now issues (label `enhancement`; 0.5 and 0.6
  milestones, backlog = no milestone). The `context/*/USER_STORIES.md`
  docs are redirect pointers to the issues and retain design rationale +
  out-of-scope notes.
- **Version files adopt CalVer.** `api/Cargo.toml` and
  `web/package.json` move from the long-stale `0.1.0` to `2026.5.29`.

## [v0.4] — Governance depth — shipped May 2026

### Added
- **Native MCP connections.** Second connection substrate alongside
  Composio: TAS-managed OAuth straight to the provider's official
  MCP server. The user clicks Connect and TAS performs MCP-spec
  discovery + Dynamic Client Registration (RFC 7591) + PKCE under
  the hood — no per-provider OAuth-app setup, no `build.attio.com`
  side quest. `lib/mcp-providers.ts` is a one-line-per-provider
  catalog (today: Attio); everything else (auth URL, token URL,
  scopes, DCR endpoint) is read from `/.well-known/oauth-protected-
  resource`. Agent spec `connections:` entries dispatch by
  `source:` (`composio` default, `native-mcp` opt-in); the Python
  wrapper builds one `MCPToolset` per declared (provider, name)
  slot with the user's bearer token in `Authorization` headers and
  honors `tools:` narrowing on native entries via
  `FilteredToolset`. Rust runner decrypts the `workspace_connection`
  row per acting user and ships the credentials as
  `TAS_NATIVE_MCP_CONNECTIONS` env.
- **Unified tool catalog + Tools tab.** Normalized
  `workspace_mcp_tool` table (migrations 0029 + 0030) caches every
  tool exposed by any connection, indexed by source + provider +
  connection name. Primed on connect, refreshable from a per-row
  button on the Connections page, cleared on disconnect. New
  workspace-level `/<workspace>/tools` page lists everything in a
  searchable, filterable table with click-to-copy slugs — kills
  the "is it `RUN_BASIC_REPORT` or `run-basic-report`?" guessing
  game that the kebab-case-vs-UPPER_SNAKE_CASE split between
  Attio's MCP and Composio's REST wrappers used to force on you.
- **Lean CAP prompt + canonical agent guidance.** Tembo Coding
  Agent prompts dropped ~16KB by replacing the inline canonical-
  guidance block with a pointer at the on-disk files (Sync agent
  guidance pushes the canonical content to the customer repo on
  demand; a scheduled refresh lives in
  `context/backlog/`). `PYDANTIC_GUIDE` learned both connection
  substrates, the slug-case gotcha, and a Switching-from-Composio-
  to-Native-MCP recipe.
- **Test foundation (Vitest + Polly.js + Playwright/Cucumber).**
  `pnpm test` runs unit + integration in ~300ms covering the RBAC
  policy + the workspace-authorize funnel (the v0.4-02 deny-test
  exit-bar item — operator is denied workspace_admin actions,
  no-session short-circuits before workspace lookup so existence
  isn't leaked). `pnpm test:bdd` drives a real Chromium through
  Gherkin-style feature files via Cucumber.js — pilots: anon
  redirects to sign-in, signed-in workspace_admin lands on the
  dashboard (seeded via direct Postgres write + HMAC-signed
  session cookie). HTTP fixtures recorded as Polly.js cassettes.
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
  CI-verified API enforcement. Vitest deny-tests on the
  `authorizeWorkspace` funnel land in v0.4 itself
  (`web/src/lib/auth-server.test.ts`); the GitHub Actions workflow
  that would run them on every PR is in
  [`context/backlog/`](./context/backlog/USER_STORIES.md) — the
  enforcement is locked in by code + test, CI is the missing
  enforcement of the test.
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
- **`context/shipped/` folder.** Shipped phase folders (0.1, 0.2,
  0.3) moved under `context/shipped/` so active phases stay
  uncluttered at the `context/` root. Docs themselves remain
  load-bearing references; only the directory layer changed.
  All cross-phase relative links updated; v0.4 → shipped uses
  `../shipped/0.X/`, shipped → v0.4+ uses `../../0.X/`, and
  sibling refs within `shipped/` stay as `../0.X/`. Root README +
  ROADMAP + a couple of source-file comments updated to point at
  the new paths.

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
