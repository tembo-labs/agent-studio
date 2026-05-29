import path from "node:path";

import FetchAdapter from "@pollyjs/adapter-fetch";
import { Polly } from "@pollyjs/core";
import FSPersister from "@pollyjs/persister-fs";

// HTTP recording/replay glue for unit + integration tests. Modeled
// after Ruby's VCR — first run with `POLLY_RECORD=1` hits the real
// service and writes a cassette under `src/test/cassettes/`; every
// subsequent run replays from disk. Cassettes are committed to git
// so CI and other developers get the same fixtures.
//
// Adapter scope: @pollyjs/adapter-fetch intercepts the global
// `fetch` Node provides (undici under the hood). Anything still
// using the legacy `http.request` API (pg client, better-auth's
// node-cookie dance) won't be intercepted — those should be mocked
// directly via vi.mock instead.

Polly.register(FetchAdapter);
Polly.register(FSPersister);

const CASSETTES_DIR = path.resolve(__dirname, "cassettes");

export type PollyMode = "replay" | "record" | "passthrough";

function resolveMode(override?: PollyMode): PollyMode {
  if (override) return override;
  // POLLY_RECORD=1 (or =record) flips a developer iteration loop
  // into record mode without touching the test files. Anything
  // else stays on replay so CI never accidentally hits live APIs.
  const env = process.env.POLLY_RECORD;
  if (env && env !== "" && env !== "0" && env !== "false") return "record";
  return "replay";
}

/**
 * Spin up a Polly instance scoped to one test. Returns the instance
 * so the test can tweak it (e.g., add per-cassette config) — the
 * caller must `await polly.stop()` in the test's teardown so the
 * cassette flushes to disk in record mode.
 *
 * The cassette name doubles as the on-disk filename, so keep it
 * short and unique within the file. Mirror the test's `describe`
 * name when in doubt.
 */
export function usePolly(
  cassetteName: string,
  options?: { mode?: PollyMode },
): Polly {
  return new Polly(cassetteName, {
    adapters: ["fetch"],
    persister: "fs",
    persisterOptions: {
      fs: { recordingsDir: CASSETTES_DIR },
    },
    mode: resolveMode(options?.mode),
    // In replay mode, fail loud if a request has no recording.
    // Otherwise a missing cassette silently makes a real network
    // call during CI, which is the entire failure mode VCR is
    // supposed to prevent.
    recordIfMissing: false,
    recordFailedRequests: true,
    matchRequestsBy: {
      // Most provider URLs we care about don't vary by headers, so
      // matching on method + URL + body is enough and survives
      // header noise (User-Agent drift, etc.) better than the
      // default.
      method: true,
      headers: false,
      body: true,
      url: { protocol: true, hostname: true, pathname: true, query: true },
    },
  });
}
