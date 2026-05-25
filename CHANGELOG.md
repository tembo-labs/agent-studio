# Changelog

All notable changes to Tembo Agent Studio. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions
match the phase numbers in [`ROADMAP.md`](./ROADMAP.md).

## [Unreleased] — v0.2 (Authoring velocity)

Work-in-progress slice of v0.2. Ships when the [exit bar](./context/0.2/README.md#exit-bar-definition-of-done-for-v02)
is met.

### Added
- **Chat-to-edit.** Each agent has a chat thread. "Send to agent" runs the
  agent with your message; "Submit change request" packages the message and
  hands it to Tembo, which opens a PR. Both intents share one composer.
- **Improvement loop.** Run-detail "Improve the Agent" form ships free-text
  feedback to Tembo as a coding task. The opened PR carries a marker that
  lets TAS correlate merged PRs back to the improvement row. New
  `/improvements` page lists every submission with status (submitted /
  PR opened / merged / closed).
- **Automations.** Scheduled runs. New `/automations` route with a list,
  create/edit form (live cron preview + next-fire in local time), and an
  enable/disable toggle. Agent detail page surfaces an agent's automations.
  Run rows show a "Scheduled" badge and link back to the automation.
- **Dashboard.** Per-workspace landing page: active vs. all-time agent and
  run counts, weekly improvement breakdown, recent improvements feed.
- **OpenAI provider.** Agents can declare `openai:gpt-...` models alongside
  Anthropic.

### Changed
- **Passthrough runner.** Both supported frameworks now shell out to the
  upstream tool — Cargo AI via the bundled `cargo-ai` CLI; Pydantic AgentSpec
  via the real `pydantic-ai` library in a bundled Python venv. The Rust API
  no longer hand-rolls provider calls.
- **Markdown output.** Agent output renders as markdown by default.
- **Feedback → Improvement rename** everywhere (DB table, routes, UI copy).
  The PR-correlation marker `TAS-Feedback-ID:` is kept as a wire-format
  constant for back-compat with in-flight PRs.

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
