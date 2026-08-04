import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
vi.mock("@/lib/db", () => ({ db: { query: (...args: unknown[]) => queryMock(...args) } }));

import {
  createPasswordResetToken,
  resetPasswordPath,
  RESET_TOKEN_TTL_MS,
} from "./password-reset";

beforeEach(() => {
  queryMock.mockReset();
  queryMock.mockResolvedValue({ rowCount: 1 });
});

describe("createPasswordResetToken", () => {
  it("writes a verification row in better-auth's reset-password shape", async () => {
    const before = Date.now();
    const { token, expiresAt } = await createPasswordResetToken("user-123");

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO verification");
    const [id, identifier, value, expires] = params;
    // The identifier is what the stock POST /api/auth/reset-password
    // endpoint looks up — the prefix must match better-auth exactly.
    expect(identifier).toBe(`reset-password:${token}`);
    expect(value).toBe("user-123");
    expect(expires).toBe(expiresAt);
    expect(id).toBeTruthy();
    expect(id).not.toBe(token);

    // URL-safe token with enough entropy to be unguessable.
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + RESET_TOKEN_TTL_MS - 1000,
    );
    expect(expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + RESET_TOKEN_TTL_MS + 1000,
    );
  });

  it("mints a distinct token per call", async () => {
    const a = await createPasswordResetToken("u");
    const b = await createPasswordResetToken("u");
    expect(a.token).not.toBe(b.token);
  });
});

describe("resetPasswordPath", () => {
  it("routes to the public reset page with the token query-encoded", () => {
    expect(resetPasswordPath("abc")).toBe("/reset-password?token=abc");
    expect(resetPasswordPath("a+b/c")).toBe(
      `/reset-password?token=${encodeURIComponent("a+b/c")}`,
    );
  });
});
