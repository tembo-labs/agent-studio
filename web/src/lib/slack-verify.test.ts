import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { verifySlackRequest } from "./slack-verify";

function sign(secret: string, ts: string, body: string): string {
  return (
    "v0=" + createHmac("sha256", secret).update(`v0:${ts}:${body}`).digest("hex")
  );
}

describe("verifySlackRequest", () => {
  const secret = "8f742231b10e8888abcd99yyyzzz85a5";
  const body = "token=x&command=%2Ftas&text=report+hello";
  const ts = "1700000000";

  it("accepts a valid signature within the window", () => {
    const signature = sign(secret, ts, body);
    expect(
      verifySlackRequest({
        signingSecret: secret,
        rawBody: body,
        signature,
        timestamp: ts,
        now: 1700000005,
      }),
    ).toEqual({ ok: true });
  });

  it("rejects a tampered body", () => {
    const signature = sign(secret, ts, body);
    const r = verifySlackRequest({
      signingSecret: secret,
      rawBody: body + "&injected=1",
      signature,
      timestamp: ts,
      now: 1700000005,
    });
    expect(r).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("rejects the wrong signing secret", () => {
    const signature = sign("other-secret", ts, body);
    const r = verifySlackRequest({
      signingSecret: secret,
      rawBody: body,
      signature,
      timestamp: ts,
      now: 1700000005,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects a stale timestamp", () => {
    const signature = sign(secret, ts, body);
    const r = verifySlackRequest({
      signingSecret: secret,
      rawBody: body,
      signature,
      timestamp: ts,
      now: 1700000000 + 600,
    });
    expect(r).toEqual({ ok: false, reason: "stale" });
  });

  it("rejects missing headers", () => {
    expect(
      verifySlackRequest({
        signingSecret: secret,
        rawBody: body,
        signature: null,
        timestamp: ts,
      }).ok,
    ).toBe(false);
  });
});
