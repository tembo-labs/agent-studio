# Eve framework integration — spike findings (PROVEN)

Spike goal: run an Eve agent **one-shot, in-process, with no Eve HTTP server**
(no listening socket), capturing the assistant reply + token usage. **Result: it
works.** A turn completed in-process and returned `"hello world"` with
`usage.inputTokens: 5017` and an output-token count, driving the durable workflow
entirely through an in-process fetch handler.

## Environment facts
- **Eve requires Node ≥ 24** (CLI refuses on 22). The API image must ship Node 24.
- Eve is a pnpm project; scaffolded deps use the `link:` protocol, so **npm cannot
  install into it — use pnpm@10**. (`--ignore-workspace` needed because the
  scaffolded `pnpm-workspace.yaml` has no `packages:` field.)
- `eve init <dir>` is non-interactive when stdin is not a TTY — it scaffolds and
  prints next steps instead of launching the TUI. Good for CAP scaffolding.
- `eve build` always emits Nitro **`node-server`** preset (ignores `NITRO_PRESET`).

## The recipe (what the production harness must do)
1. **Materialize** the agent dir (from the `{repoPath: content}` map) into a temp
   project root.
2. **Model = direct provider.** Eve's default `model: "anthropic/…"` string routes
   through Vercel AI Gateway (needs `AI_GATEWAY_API_KEY`/OIDC). Use a direct
   `LanguageModel` instead: `agent.ts` → `import { anthropic } from "@ai-sdk/anthropic"; model: anthropic("claude-…")`.
   The direct provider reads `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` from env (which
   TAS already has). `@ai-sdk/anthropic@4.0.0-beta.67` matches `ai@7.0.0-beta.178`.
3. **Channel auth = `none()`** (TAS controls the dir; the handler has no network
   exposure). Write `agent/channels/eve.ts` → `eveChannel({ auth: [none()] })`.
   Otherwise the session route 401s (`localDev()` is disabled in a prod build).
4. `pnpm install` (cache by lockfile hash) then `eve build`.
5. **Patch the build to not listen.** `.output/server/index.mjs` calls
   `serve({...})` at import (binds a port). Replace `serve({` with
   `globalThis.__EVE_FETCH__ = nitroApp.fetch; ((_)=>_)({` so importing the file
   captures the Nitro fetch handler and binds **no socket**.
6. **Durable workflow runs locally, in-process.** Set
   `WORKFLOW_LOCAL_BASE_URL=http://eve.local` and `WORKFLOW_LOCAL_DATA_DIR=<tmp>`.
   Intercept `globalThis.fetch`: any URL containing the sentinel host is served by
   `globalThis.__EVE_FETCH__(new Request(...))`. This routes both the session POST
   and the workflow callbacks (`POST /.well-known/workflow/v1/flow`) back through
   the in-process handler — no socket.
7. **Drive** with `eve/client`: `new Client({ host: "http://eve.local" })` →
   `session.send(message)` → `await res.result()` for the aggregated
   `MessageResult` (assistant text), and iterate the stream for per-step
   `usage`/tool events → emit `__TAS_USAGE__` / `__TAS_STEPS__`.

## Open items for full integration
- **Sandbox**: the spike agent had no tools. Tool-using agents need an Eve sandbox
  (`eve/sandbox/just-bash` runs locally with no Docker; `docker`/`microsandbox`/
  `vercel` are the others). v1 can scope to `just-bash`.
- **Dep install cost**: first run per lockfile pays `pnpm install`; cache it.
- **Pinned versions**: validated on `eve@0.11.4`, Node 24.16, pnpm@10,
  `@ai-sdk/anthropic@4.0.0-beta.67`. Re-validate on upgrades (internal/build-shape
  dependence: the `serve(` patch + `WORKFLOW_LOCAL_*` envs).

See `eve-spike-driver.mjs` for the exact working driver used to prove this.
