import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Slack request-signature verification.
// https://api.slack.com/authentication/verifying-requests-from-slack
// Slack sends X-Slack-Signature ("v0=<hex>") and X-Slack-Request-Timestamp.
// The signature is HMAC-SHA256 over "v0:{timestamp}:{rawBody}" keyed by the
// app's signing secret. We also reject timestamps older than 5 minutes to
// blunt replay. The raw body must be the exact bytes Slack sent — read
// request.text() before any parsing.

const MAX_AGE_SECONDS = 60 * 5;

export type SlackVerifyResult =
  | { ok: true }
  | { ok: false; reason: "missing-headers" | "stale" | "bad-signature" };

export function verifySlackRequest(args: {
  signingSecret: string;
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  /** Current unix seconds; injectable for tests. */
  now?: number;
}): SlackVerifyResult {
  const { signingSecret, rawBody, signature, timestamp } = args;
  if (!signature || !timestamp) return { ok: false, reason: "missing-headers" };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "missing-headers" };
  const now = args.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > MAX_AGE_SECONDS) return { ok: false, reason: "stale" };

  const base = `v0:${timestamp}:${rawBody}`;
  const expected =
    "v0=" + createHmac("sha256", signingSecret).update(base).digest("hex");
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return { ok: false, reason: "bad-signature" };
  if (!timingSafeEqual(a, b)) return { ok: false, reason: "bad-signature" };
  return { ok: true };
}
