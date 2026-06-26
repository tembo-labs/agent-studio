import { createHmac, randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { verifySvixRequest } from "./svix-verify";

// A `whsec_`-prefixed secret + a helper that signs exactly like Svix/Clerk.
const keyBytes = randomBytes(24);
const secret = "whsec_" + keyBytes.toString("base64");

function sign(id: string, ts: string, body: string): string {
  const sig = createHmac("sha256", keyBytes)
    .update(`${id}.${ts}.${body}`)
    .digest("base64");
  return `v1,${sig}`;
}

describe("verifySvixRequest", () => {
  const id = "msg_2abcDEF";
  const ts = "1700000000";
  const body = JSON.stringify({ type: "user.created", data: { id: "u_1" } });

  it("accepts a valid signature within the window", () => {
    expect(
      verifySvixRequest({
        signingSecret: secret,
        rawBody: body,
        svixId: id,
        svixTimestamp: ts,
        svixSignature: sign(id, ts, body),
        now: 1700000005,
      }),
    ).toEqual({ ok: true });
  });

  it("accepts when one of several space-separated signatures matches", () => {
    const sig = `v1,deadbeef ${sign(id, ts, body)} v0,ignored`;
    expect(
      verifySvixRequest({
        signingSecret: secret,
        rawBody: body,
        svixId: id,
        svixTimestamp: ts,
        svixSignature: sig,
        now: 1700000005,
      }),
    ).toEqual({ ok: true });
  });

  it("works with a bare (no whsec_ prefix) base64 secret", () => {
    expect(
      verifySvixRequest({
        signingSecret: keyBytes.toString("base64"),
        rawBody: body,
        svixId: id,
        svixTimestamp: ts,
        svixSignature: sign(id, ts, body),
        now: 1700000005,
      }).ok,
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(
      verifySvixRequest({
        signingSecret: secret,
        rawBody: body + "tamper",
        svixId: id,
        svixTimestamp: ts,
        svixSignature: sign(id, ts, body),
        now: 1700000005,
      }),
    ).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("rejects a signature bound to a different svix-id", () => {
    expect(
      verifySvixRequest({
        signingSecret: secret,
        rawBody: body,
        svixId: "msg_other",
        svixTimestamp: ts,
        svixSignature: sign(id, ts, body),
        now: 1700000005,
      }).ok,
    ).toBe(false);
  });

  it("rejects the wrong signing secret", () => {
    expect(
      verifySvixRequest({
        signingSecret: "whsec_" + randomBytes(24).toString("base64"),
        rawBody: body,
        svixId: id,
        svixTimestamp: ts,
        svixSignature: sign(id, ts, body),
        now: 1700000005,
      }).ok,
    ).toBe(false);
  });

  it("rejects a stale timestamp", () => {
    expect(
      verifySvixRequest({
        signingSecret: secret,
        rawBody: body,
        svixId: id,
        svixTimestamp: ts,
        svixSignature: sign(id, ts, body),
        now: 1700000000 + 600,
      }),
    ).toEqual({ ok: false, reason: "stale" });
  });

  it("rejects missing headers", () => {
    expect(
      verifySvixRequest({
        signingSecret: secret,
        rawBody: body,
        svixId: null,
        svixTimestamp: ts,
        svixSignature: sign(id, ts, body),
      }),
    ).toEqual({ ok: false, reason: "missing-headers" });
  });
});
