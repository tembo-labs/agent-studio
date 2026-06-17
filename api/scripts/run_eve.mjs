// TAS runner for Eve agents. Mirrors run_pydantic.py's contract: read the
// agent's files + a user message, run ONE turn, and print the assistant reply
// plus the `__TAS_USAGE__:` / `__TAS_STEPS__:` sentinels the Rust runner
// (api/src/runs/eve.rs) parses into the run/run_step rows.
//
// The hard part — proven in the spike (see api/scripts/EVE_SPIKE_NOTES.md) —
// is running an Eve agent ONE-SHOT, fully in-process, with NO listening HTTP
// server. Eve's turn executes as a Vercel Workflow that drives itself via a
// queue making HTTP callbacks to the app's own origin. We:
//   1. `eve build` the materialized project (Nitro `node-server` output),
//   2. patch out the `serve(...)` call so importing the build exposes the
//      Nitro fetch handler WITHOUT binding a socket,
//   3. point the workflow's LOCAL backend at a sentinel host
//      (WORKFLOW_LOCAL_BASE_URL) and intercept globalThis.fetch so the session
//      POST and the workflow callbacks loop back through that in-process handler,
//   4. open the channel auth (none()) since TAS owns the dir and nothing is
//      network-exposed,
//   5. drive the turn with eve/client and aggregate the streamed events.
//
// Inputs (env, set by eve.rs):
//   TAS_EVE_FILES   JSON { "<project-relative path>": "<content>" } of the agent dir
//   TAS_MESSAGE     the user message for this turn (may be empty)
//   ANTHROPIC_API_KEY / OPENAI_API_KEY   provider keys (direct AI-SDK providers read these)
//   TAS_EVE_PNPM_STORE  optional persistent pnpm store dir (fast installs)
//
// Requires Node >= 24 and pnpm@10 on PATH (provided by api/Dockerfile).

import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, isAbsolute, normalize } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SENTINEL_HOST = "http://eve.local";

function die(msg) {
  process.stderr.write(`[run_eve] ${msg}\n`);
  process.exit(1);
}

function readFilesEnv() {
  const raw = process.env.TAS_EVE_FILES;
  if (!raw) die("TAS_EVE_FILES is required");
  let files;
  try {
    files = JSON.parse(raw);
  } catch (e) {
    die(`TAS_EVE_FILES is not valid JSON: ${e}`);
  }
  if (!files || typeof files !== "object" || Array.isArray(files)) {
    die("TAS_EVE_FILES must be a JSON object of {path: content}");
  }
  return files;
}

// Materialize the agent project into a fresh temp dir. Paths are project-relative
// (eve.rs strips the `agents/eve/<name>/` prefix before sending), so a path like
// `agent/agent.ts` lands at <root>/agent/agent.ts. Reject path traversal.
function materialize(files) {
  const root = mkdtempSync(join(tmpdir(), "tas-eve-"));
  for (const [rel, content] of Object.entries(files)) {
    const safe = normalize(rel).replace(/^(\.\.(\/|\\|$))+/, "");
    if (isAbsolute(safe) || safe.startsWith("..")) continue;
    const dest = join(root, safe);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, typeof content === "string" ? content : String(content));
  }
  return root;
}

// Force the eve HTTP channel auth open for this trusted, non-network-exposed run.
// localDev() is disabled in a production `eve build`, so without this the session
// route 401s. TAS owns the dir, so overriding the eve channel's auth is safe.
function forcePublicAuth(root) {
  const dir = join(root, "agent", "channels");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "eve.ts"),
    'import { eveChannel } from "eve/channels/eve";\n' +
      'import { none } from "eve/channels/auth";\n' +
      "export default eveChannel({ auth: [none()] });\n",
  );
}

function run(cmd, cmdArgs, opts = {}) {
  return execFileSync(cmd, cmdArgs, {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function installDeps(root) {
  const env = { ...process.env };
  if (process.env.TAS_EVE_PNPM_STORE) env.PNPM_HOME = process.env.TAS_EVE_PNPM_STORE;
  const args = ["install", "--ignore-workspace", "--prod=false"];
  if (process.env.TAS_EVE_PNPM_STORE) {
    args.push("--store-dir", join(process.env.TAS_EVE_PNPM_STORE, "store"));
  }
  try {
    run("pnpm", args, { cwd: root, env });
  } catch (e) {
    die(`pnpm install failed: ${e.stderr || e.message}`);
  }
}

function buildProject(root) {
  const eveBin = join(root, "node_modules", "eve", "bin", "eve.js");
  if (!existsSync(eveBin)) die("eve is not a dependency of this agent project");
  try {
    run(process.execPath, [eveBin, "build"], { cwd: root });
  } catch (e) {
    die(`eve build failed: ${(e.stdout || "") + (e.stderr || e.message)}`);
  }
}

// Patch the Nitro node-server entry so importing it captures the fetch handler
// on globalThis.__EVE_FETCH__ instead of calling serve() (which would bind a
// port). Idempotent.
function patchNoListen(root) {
  const entry = join(root, ".output", "server", "index.mjs");
  if (!existsSync(entry)) die("build did not produce .output/server/index.mjs");
  let src = readFileSync(entry, "utf8");
  if (!src.includes("__EVE_FETCH__")) {
    if (!src.includes("serve({")) die("could not find serve({...}) to patch in build output");
    src = src.replace("serve({", "globalThis.__EVE_FETCH__ = nitroApp.fetch; ((_)=>_)({");
    writeFileSync(entry, src);
  }
  return entry;
}

// Aggregate the streamed turn events into final text + per-step usage.
function aggregate(events) {
  let text = "";
  const steps = new Map(); // stepIndex -> {input_tokens, output_tokens, summary}
  for (const ev of events) {
    const t = ev?.type;
    const d = ev?.data ?? {};
    if (t === "message.completed" && typeof d.message === "string") {
      text = d.message;
    } else if (t === "message.appended" && typeof d.messageSoFar === "string" && !text) {
      // fall-back accumulation if no completed event arrives
      text = d.messageSoFar;
    }
    if (d.usage && (d.usage.inputTokens != null || d.usage.outputTokens != null)) {
      const idx = Number.isInteger(d.stepIndex) ? d.stepIndex : steps.size;
      const prev = steps.get(idx) ?? {};
      steps.set(idx, {
        input_tokens: d.usage.inputTokens ?? prev.input_tokens ?? 0,
        output_tokens: d.usage.outputTokens ?? prev.output_tokens ?? 0,
      });
    }
  }
  const stepArr = [...steps.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([step, u]) => ({ step, input_tokens: u.input_tokens, output_tokens: u.output_tokens }));
  const total = stepArr.reduce(
    (acc, s) => ({
      input_tokens: acc.input_tokens + (s.input_tokens || 0),
      output_tokens: acc.output_tokens + (s.output_tokens || 0),
    }),
    { input_tokens: 0, output_tokens: 0 },
  );
  return { text, steps: stepArr, usage: total };
}

async function main() {
  const files = readFilesEnv();
  const message = process.env.TAS_MESSAGE && process.env.TAS_MESSAGE.length ? process.env.TAS_MESSAGE : "Hello.";

  const root = materialize(files);
  forcePublicAuth(root);
  installDeps(root);
  buildProject(root);
  const entry = patchNoListen(root);

  // Local durable-workflow backend, looped back in-process via the fetch
  // intercept below. The data dir is per-run (ephemeral).
  process.env.WORKFLOW_LOCAL_BASE_URL = SENTINEL_HOST;
  process.env.WORKFLOW_LOCAL_DATA_DIR = mkdtempSync(join(tmpdir(), "tas-eve-wf-"));

  // Importing the patched entry sets globalThis.__EVE_FETCH__ and binds no socket.
  await import(pathToFileURL(entry).href);
  const handler = globalThis.__EVE_FETCH__;
  if (typeof handler !== "function") die("in-process fetch handler not available after build patch");

  const realFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : (input?.url ?? "");
    if (url.includes("eve.local")) {
      return handler(input instanceof Request ? input : new Request(url, init));
    }
    return realFetch(input, init);
  };

  // eve/client resolves from the materialized project's node_modules.
  const { Client } = await import(
    pathToFileURL(join(root, "node_modules", "eve", "dist", "src", "client", "index.js")).href
  );
  const client = new Client({ host: SENTINEL_HOST });
  const session = client.session();

  const response = await session.send(message);
  const events = [];
  for await (const ev of response) events.push(ev);
  const { text, steps, usage } = aggregate(events);

  // Emit in the exact shape eve.rs (reusing the pydantic sentinel parsers) reads.
  process.stdout.write(`${text}\n`);
  process.stdout.write(`__TAS_STEPS__:${JSON.stringify(steps)}\n`);
  process.stdout.write(
    `__TAS_USAGE__:${JSON.stringify({ input_tokens: usage.input_tokens, output_tokens: usage.output_tokens })}\n`,
  );
}

main().catch((e) => die(e?.stack || String(e)));
