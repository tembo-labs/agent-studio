import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Signed, expiring token for the agent-facing /for-agents tool reference.
//
// The create-agent prompt sent to the Tembo Coding Agent (CAP) tells it to
// fetch `${origin}/for-agents/<provider>.md` with an `Authorization: Bearer
// <token>` header to learn a native MCP's exact tool slugs (it can't introspect
// the provider's server and there's no central catalog). This token authorizes that read,
// scoped to one (workspace, user) and short-lived — it grants nothing but the
// cached tool catalog (tool names + descriptions), so it's deliberately
// low-privilege. Signed with BETTER_AUTH_SECRET (same key the OAuth state
// tokens use), stateless so no DB round-trip on each fetch.

const TTL_SECONDS = 14 * 24 * 60 * 60; // 14 days — covers a slow CAP task.

export type ForAgentsTokenPayload = {
  /** Workspace whose cached tool catalog the token unlocks. */
  w: string;
  /** Acting user — whose per-user native connections (and thus cached
   *  tools) the reference reflects. */
  u: string;
  /** Expiry, epoch seconds. */
  exp: number;
};

function secret(): Buffer {
  const raw = process.env.BETTER_AUTH_SECRET;
  if (!raw) {
    throw new Error(
      "BETTER_AUTH_SECRET is required to sign /for-agents tokens.",
    );
  }
  return Buffer.from(raw, "utf8");
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

/** Mint a token for (workspaceId, userId), valid for TTL_SECONDS. */
export function signForAgentsToken(
  workspaceId: string,
  userId: string,
  nowSeconds: number,
): string {
  const payload: ForAgentsTokenPayload = {
    w: workspaceId,
    u: userId,
    exp: nowSeconds + TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return `${body}.${sign(body)}`;
}

/** Verify a token; returns its payload or null (bad shape / signature /
 *  expired). `nowSeconds` is passed in so callers stay testable. */
export function verifyForAgentsToken(
  token: string,
  nowSeconds: number,
): ForAgentsTokenPayload | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const presented = token.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let payload: ForAgentsTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (
    typeof payload?.w !== "string" ||
    typeof payload?.u !== "string" ||
    typeof payload?.exp !== "number"
  ) {
    return null;
  }
  if (payload.exp < nowSeconds) return null;
  return payload;
}

/** Pull the token out of an `Authorization: Bearer <token>` header value
 *  (case-insensitive scheme). Returns null when absent or malformed. */
export function bearerFromHeader(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer[ ]+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : null;
}
