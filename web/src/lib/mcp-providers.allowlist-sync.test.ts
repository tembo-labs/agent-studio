import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  GENERATED_FILE_REPO_PATH,
  renderNativeOauthAllowlistRs,
} from "../../scripts/gen-native-oauth-allowlist";

// Staleness guard. The Rust token-refresh path's origin allowlist
// (api/src/native_oauth_allowlist.rs) is GENERATED from the MCP_PROVIDERS
// catalog by web/scripts/gen-native-oauth-allowlist.ts, because the api crate
// can't import this TS catalog. If the catalog changes but the generated file
// isn't regenerated, refreshes for the new/changed provider abort with
// "origin is not in the allowlist" and its short-lived tokens 401 mid-run —
// exactly the Dialed regression.
//
// Unlike the old hand-synced drift test, the fix here is never "go edit the
// Rust file": it's always one command. CI checks out the whole repo, so api/
// is reachable from the web package.
describe("generated native-MCP OAuth allowlist (api/src/native_oauth_allowlist.rs)", () => {
  it("is up to date with the MCP_PROVIDERS catalog — if this fails, run `npm run gen:allowlist` in web/ and commit the result", () => {
    const onDisk = readFileSync(
      join(process.cwd(), "..", GENERATED_FILE_REPO_PATH),
      "utf8",
    );
    expect(onDisk).toBe(renderNativeOauthAllowlistRs());
  });
});
