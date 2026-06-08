import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Signed state token for OAuth flows. The OAuth provider echoes the
// `state` value back unchanged on callback; we use it to (a) prove
// the callback request originated from our own /authorize step and
// (b) carry the workspace + connection-name context so the callback
// handler can store the credential against the right row.
//
// We sign with the BETTER_AUTH_SECRET — already present, already
// 32+ bytes of high-entropy randomness shared by the server side.

const SIG_LEN = 32; // sha-256 output

function getSecret(): Buffer {
  const raw = process.env.BETTER_AUTH_SECRET;
  if (!raw) {
    throw new Error(
      "BETTER_AUTH_SECRET is required to sign OAuth state tokens. " +
        "Generate one with: openssl rand -base64 32",
    );
  }
  return Buffer.from(raw, "utf8");
}

// Native-MCP OAuth state — for the v0.4 substrate that bypasses
// Composio and authenticates directly with a provider (Attio etc).
// Shape parallels ComposioStatePayload below; `provider` replaces
// `toolkit` because Composio's catalog and TAS's native-MCP catalog
// don't overlap by definition.

export type NativeMcpStatePayload = {
  workspaceId: string;
  workspaceSlug: string;
  /** Owner of the connection (the user who clicked Connect). */
  userId: string;
  /** Native-MCP provider slug from lib/mcp-providers. */
  provider: string;
  /** Workspace-scoped name slot for the connection. */
  connectionName: string;
  /** PKCE verifier (raw, base64url). The provider receives only the
   *  derived S256 challenge in the /authorize redirect; we present
   *  the verifier on the callback's token exchange to complete the
   *  PKCE proof. Embedded in the state because it never crosses
   *  our trust boundary — state is HMAC-signed and opaque to the
   *  provider. */
  pkceVerifier: string;
  /** OAuth client_id that Dynamic Client Registration just issued
   *  for this flow. New per Connect attempt (MCP DCR is cheap;
   *  caching adds complexity without much payoff at v1). */
  clientId: string;
  /** Authorization server token endpoint, captured during
   *  discovery so the callback doesn't need to re-discover. */
  tokenEndpoint: string;
  /** OAuth client mode. "manual" (confidential, BYO app) tells the
   *  callback to add the stored client_secret at token exchange.
   *  Absent/"dcr" = public client (no secret). */
  authMode?: "dcr" | "manual";
  /** For manual providers: which BYO OAuth-app instance this flow used
   *  (slug in workspace_native_oauth_client). The callback re-reads the
   *  secret by this instance, and it's stored on the connection so refresh
   *  presents the right client_secret. Absent for DCR. */
  instance?: string;
  /** Short random nonce — defends against state replay across users. */
  nonce: string;
};

export function signNativeMcpState(
  payload: Omit<NativeMcpStatePayload, "nonce">,
): string {
  const full: NativeMcpStatePayload = {
    ...payload,
    nonce: randomBytes(8).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(full), "utf8");
  const sig = createHmac("sha256", getSecret()).update(body).digest();
  return Buffer.concat([body, sig]).toString("base64url");
}

export function verifyNativeMcpState(
  state: string,
): NativeMcpStatePayload | null {
  let combined: Buffer;
  try {
    combined = Buffer.from(state, "base64url");
  } catch {
    return null;
  }
  if (combined.length <= SIG_LEN) return null;
  const body = combined.subarray(0, combined.length - SIG_LEN);
  const sig = combined.subarray(combined.length - SIG_LEN);
  const expected = createHmac("sha256", getSecret()).update(body).digest();
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(sig, expected)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString("utf8"));
  } catch {
    return null;
  }
  if (!isNativeMcpStatePayload(parsed)) return null;
  return parsed;
}

function isNativeMcpStatePayload(value: unknown): value is NativeMcpStatePayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.workspaceId === "string" &&
    typeof v.workspaceSlug === "string" &&
    typeof v.userId === "string" &&
    typeof v.provider === "string" &&
    typeof v.connectionName === "string" &&
    typeof v.pkceVerifier === "string" &&
    typeof v.clientId === "string" &&
    typeof v.tokenEndpoint === "string" &&
    typeof v.nonce === "string"
  );
}

// Composio-flavored state. Separate from NativeMcpStatePayload because
// Composio gives us the connected_account_id at /authorize time (in
// the `link()` response), and we want to pass that opaque id through
// to the callback so we can `connectedAccounts.get(id)` it and only
// commit a row when the status reports ACTIVE.

export type ComposioStatePayload = {
  workspaceId: string;
  workspaceSlug: string;
  /** Owner of the connection (the user who clicked Connect). */
  userId: string;
  toolkit: string;
  /** Workspace-scoped name slot for the connection (e.g. "default", "work"). */
  connectionName: string;
  nonce: string;
};

export function signComposioState(
  payload: Omit<ComposioStatePayload, "nonce">,
): string {
  const full: ComposioStatePayload = {
    ...payload,
    nonce: randomBytes(8).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(full), "utf8");
  const sig = createHmac("sha256", getSecret()).update(body).digest();
  return Buffer.concat([body, sig]).toString("base64url");
}

export function verifyComposioState(state: string): ComposioStatePayload | null {
  let combined: Buffer;
  try {
    combined = Buffer.from(state, "base64url");
  } catch {
    return null;
  }
  if (combined.length <= SIG_LEN) return null;
  const body = combined.subarray(0, combined.length - SIG_LEN);
  const sig = combined.subarray(combined.length - SIG_LEN);
  const expected = createHmac("sha256", getSecret()).update(body).digest();
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(sig, expected)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString("utf8"));
  } catch {
    return null;
  }
  if (!isComposioStatePayload(parsed)) return null;
  return parsed;
}

function isComposioStatePayload(value: unknown): value is ComposioStatePayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.workspaceId === "string" &&
    typeof v.workspaceSlug === "string" &&
    typeof v.userId === "string" &&
    typeof v.toolkit === "string" &&
    typeof v.connectionName === "string" &&
    typeof v.nonce === "string"
  );
}

// Slack "Add to Slack" install state — proves the callback came from our
// own /install step and carries which workspace_slack_app row (+ its
// workspace) the resulting bot token should be stored against.

export type SlackInstallStatePayload = {
  /** Our workspace_slack_app row id. */
  slackAppId: string;
  workspaceId: string;
  workspaceSlug: string;
  nonce: string;
};

export function signSlackInstallState(
  payload: Omit<SlackInstallStatePayload, "nonce">,
): string {
  const full: SlackInstallStatePayload = {
    ...payload,
    nonce: randomBytes(8).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(full), "utf8");
  const sig = createHmac("sha256", getSecret()).update(body).digest();
  return Buffer.concat([body, sig]).toString("base64url");
}

export function verifySlackInstallState(
  state: string,
): SlackInstallStatePayload | null {
  let combined: Buffer;
  try {
    combined = Buffer.from(state, "base64url");
  } catch {
    return null;
  }
  if (combined.length <= SIG_LEN) return null;
  const body = combined.subarray(0, combined.length - SIG_LEN);
  const sig = combined.subarray(combined.length - SIG_LEN);
  const expected = createHmac("sha256", getSecret()).update(body).digest();
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(sig, expected)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString("utf8"));
  } catch {
    return null;
  }
  if (!isSlackInstallStatePayload(parsed)) return null;
  return parsed;
}

function isSlackInstallStatePayload(
  value: unknown,
): value is SlackInstallStatePayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.slackAppId === "string" &&
    typeof v.workspaceId === "string" &&
    typeof v.workspaceSlug === "string" &&
    typeof v.nonce === "string"
  );
}
