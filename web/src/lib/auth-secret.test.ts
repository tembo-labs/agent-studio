import { describe, expect, it } from "vitest";

import { INSECURE_PLACEHOLDER_SECRET, resolveAuthSecret } from "./auth-secret";

// Security exit-bar: a real deployment must never sign sessions with the
// public in-repo placeholder. We model the two phases via DATABASE_URL —
// absent during `next build`, always present when serving requests.

describe("resolveAuthSecret", () => {
  it("returns the configured secret when set to a real value", () => {
    expect(
      resolveAuthSecret({
        BETTER_AUTH_SECRET: "a-real-strong-secret",
        DATABASE_URL: "postgres://db",
      }),
    ).toBe("a-real-strong-secret");
  });

  it("throws at runtime when the secret is missing", () => {
    expect(() =>
      resolveAuthSecret({ DATABASE_URL: "postgres://db" }),
    ).toThrow(/BETTER_AUTH_SECRET/);
  });

  it("throws at runtime when the secret is the in-repo placeholder", () => {
    expect(() =>
      resolveAuthSecret({
        BETTER_AUTH_SECRET: INSECURE_PLACEHOLDER_SECRET,
        DATABASE_URL: "postgres://db",
      }),
    ).toThrow(/placeholder/);
  });

  it("tolerates a missing secret at build time (no DATABASE_URL)", () => {
    expect(resolveAuthSecret({})).toBe(INSECURE_PLACEHOLDER_SECRET);
  });
});
