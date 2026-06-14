import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MCP_PROVIDERS } from "./mcp-providers";

// Drift guard. The Rust token-refresh path keeps its OWN origin allowlist
// (api/src/native_oauth.rs, NATIVE_MCP_OAUTH_ALLOWLIST) because the api crate
// can't import this TS catalog. If a new native-MCP provider is added here but
// not there, refreshes for it abort with "origin is not in the allowlist" and
// its short-lived tokens 401 mid-run — exactly the Dialed regression. This test
// fails CI when the two drift, so the Rust side can't be forgotten.
//
// CI checks out the whole repo, so api/ is reachable from the web package.
describe("native-MCP OAuth origin allowlist stays in sync with the Rust refresher", () => {
  const rs = readFileSync(
    join(process.cwd(), "..", "api", "src", "native_oauth.rs"),
    "utf8",
  );

  for (const provider of Object.values(MCP_PROVIDERS)) {
    // Only OAuth providers are refreshed (self-key / PAT providers like
    // tembo-agent-studio have no auth-server origins and aren't in the sweep).
    if (provider.oauthAuthorizationServerOrigins.length === 0) continue;

    it(`${provider.slug}'s MCP origin is in native_oauth.rs`, () => {
      const mcpOrigin = new URL(provider.mcpServerUrl).origin;
      expect(
        rs.includes(`"${mcpOrigin}"`),
        `${provider.slug} (${mcpOrigin}) is in the web catalog but missing from ` +
          `NATIVE_MCP_OAUTH_ALLOWLIST in api/src/native_oauth.rs — add it there or ` +
          `token refresh for ${provider.slug} will abort and its tokens will 401 mid-run.`,
      ).toBe(true);

      // And each advertised OAuth authorization-server origin must be allowed too.
      for (const oauthOrigin of provider.oauthAuthorizationServerOrigins) {
        expect(
          rs.includes(`"${oauthOrigin}"`),
          `${provider.slug}'s OAuth origin ${oauthOrigin} is missing from native_oauth.rs.`,
        ).toBe(true);
      }
    });
  }
});
