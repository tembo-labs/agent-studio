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

export type OAuthStatePayload = {
  workspaceId: string;
  workspaceSlug: string;
  connectionType: "slack" | "google-sheets";
  /** Workspace-scoped name for the new connection. */
  connectionName: string;
  /** Short random nonce — defends against state replay across users. */
  nonce: string;
};

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

/**
 * Pack and sign an OAuth state token. The returned string is URL-safe
 * base64 of `payload-json || hmac-sha256`. Pass it as the `state`
 * query param when redirecting the user to the OAuth provider.
 */
export function signOAuthState(
  payload: Omit<OAuthStatePayload, "nonce">,
): string {
  const full: OAuthStatePayload = {
    ...payload,
    nonce: randomBytes(8).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(full), "utf8");
  const sig = createHmac("sha256", getSecret()).update(body).digest();
  return Buffer.concat([body, sig]).toString("base64url");
}

/**
 * Verify and unpack an OAuth state token returned by the provider on
 * callback. Returns null if the signature doesn't verify, the payload
 * is malformed, or the embedded shape doesn't match. Callers should
 * still cross-check `connectionType` matches the route they were
 * invoked on.
 */
export function verifyOAuthState(state: string): OAuthStatePayload | null {
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
  if (!isStatePayload(parsed)) return null;
  return parsed;
}

function isStatePayload(value: unknown): value is OAuthStatePayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.workspaceId === "string" &&
    typeof v.workspaceSlug === "string" &&
    (v.connectionType === "slack" || v.connectionType === "google-sheets") &&
    typeof v.connectionName === "string" &&
    typeof v.nonce === "string"
  );
}

// Composio-flavored state. Separate from OAuthStatePayload because
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
