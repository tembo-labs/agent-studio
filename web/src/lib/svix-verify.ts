import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Svix webhook signature verification — used by Clerk and any other Svix-powered
// sender. https://docs.svix.com/receiving/verifying-payloads/how-manual
//
// The sender includes svix-id, svix-timestamp, and svix-signature headers. The
// signature is HMAC-SHA256 over "{id}.{timestamp}.{rawBody}", keyed by the
// endpoint signing secret — the base64 part after the `whsec_` prefix — and
// itself base64-encoded. svix-signature is a SPACE-separated list of
// "v1,<sig>" tokens (a secret may be rotated, so several can be present); we
// accept if any v1 signature matches. We also reject timestamps more than 5
// minutes off to blunt replay. The raw body must be the exact bytes the sender
// signed — read request.text() before any parsing.

const MAX_AGE_SECONDS = 60 * 5;

export type SvixVerifyResult =
  | { ok: true }
  | {
      ok: false;
      reason: "missing-headers" | "stale" | "bad-secret" | "bad-signature";
    };

export function verifySvixRequest(args: {
  /** The endpoint signing secret — `whsec_...` or the bare base64 key. */
  signingSecret: string;
  rawBody: string;
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
  /** Current unix seconds; injectable for tests. */
  now?: number;
}): SvixVerifyResult {
  const { signingSecret, rawBody, svixId, svixTimestamp, svixSignature } = args;
  if (!svixId || !svixTimestamp || !svixSignature) {
    return { ok: false, reason: "missing-headers" };
  }
  const ts = Number(svixTimestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "missing-headers" };
  const now = args.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > MAX_AGE_SECONDS) return { ok: false, reason: "stale" };

  // The signing secret is the base64 key after the `whsec_` prefix.
  const rawKey = signingSecret.startsWith("whsec_")
    ? signingSecret.slice("whsec_".length)
    : signingSecret;
  const key = Buffer.from(rawKey, "base64");
  if (key.length === 0) return { ok: false, reason: "bad-secret" };

  const expected = createHmac("sha256", key)
    .update(`${svixId}.${svixTimestamp}.${rawBody}`)
    .digest("base64");
  const expectedBuf = Buffer.from(expected, "utf8");

  // svix-signature: space-separated "v1,<base64sig>" tokens — accept any match.
  for (const part of svixSignature.split(" ")) {
    const comma = part.indexOf(",");
    if (comma === -1 || part.slice(0, comma) !== "v1") continue;
    const sigBuf = Buffer.from(part.slice(comma + 1), "utf8");
    if (
      sigBuf.length === expectedBuf.length &&
      timingSafeEqual(sigBuf, expectedBuf)
    ) {
      return { ok: true };
    }
  }
  return { ok: false, reason: "bad-signature" };
}
