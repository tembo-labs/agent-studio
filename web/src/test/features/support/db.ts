import { createHmac, randomUUID } from "node:crypto";
import path from "node:path";

import { config as loadEnv } from "dotenv";
import { Pool } from "pg";

// BDD runs from the host, not the docker container — pick up the
// dev DB URL + better-auth secret from the repo's .env so the
// signed-cookie HMAC matches what the running web container would
// produce. We resolve the .env relative to this file rather than
// the cwd so `pnpm test:bdd` works from any directory.
loadEnv({ path: path.resolve(__dirname, "../../../../../.env") });

// Direct-Postgres helpers for BDD scenarios. We bypass better-auth's
// public APIs because the only sign-in surface this app exposes is
// Google OAuth — and we don't want a BDD test driving a real
// Google login flow. Instead we plant a `user` + `session` row, set
// the session-token cookie on the browser context, and let
// `getServerSession` resolve it the same way it would for a real
// signed-in user.
//
// The same pool is shared across all scenarios in a process. Test
// fixtures live alongside production data in the dev DB; we tag
// every test row with a `bdd-` prefix on the email so the After
// hook can clean up without touching real users.

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgres://tas:tas@localhost:5433/tas",
  max: 5,
});

export type SeededSession = {
  userId: string;
  email: string;
  /** Raw session.token stored in Postgres. */
  sessionToken: string;
  /** URL-encoded `<token>.<base64-hmac-sha256-sig>` value the
   *  browser presents in the `better-auth.session_token` cookie.
   *  Match what better-call's `signCookieValue` produces — see
   *  node_modules/better-call/dist/crypto.mjs. */
  signedCookieValue: string;
};

/**
 * HMAC-sign + URL-encode a raw session token so the result drops
 * straight into a browser cookie that better-auth will accept. The
 * implementation mirrors `signCookieValue` in better-call —
 * HMAC-SHA256 with standard (NOT base64url) base64 + the literal
 * `<value>.<sig>` join + a final encodeURIComponent.
 */
function signCookieValue(value: string, secret: string): string {
  const sig = createHmac("sha256", secret).update(value).digest("base64");
  return encodeURIComponent(`${value}.${sig}`);
}

/**
 * Plant a user + workspace_member + session row directly in
 * Postgres, returning the session token the BDD step needs to set
 * as a cookie. Idempotent within a single scenario (the userId is
 * randomly generated, so there's no collision risk).
 *
 * Throws if the workspace slug doesn't exist — fail-loud is better
 * than silently creating a session for a non-existent workspace.
 */
export async function seedSignedInUser(args: {
  workspaceSlug: string;
  role: "workspace_admin" | "operator" | "viewer";
}): Promise<SeededSession> {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "BDD seed: BETTER_AUTH_SECRET not set — dotenv didn't find a .env, " +
        "or the secret isn't defined there. Cookies can't be signed without it.",
    );
  }

  const userId = randomUUID();
  const email = `bdd-${userId.slice(0, 8)}@test.tas.local`;
  const sessionToken = randomUUID().replace(/-/g, "");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const wsRow = await client.query<{ id: string }>(
      `SELECT id FROM workspace WHERE slug = $1`,
      [args.workspaceSlug],
    );
    if (wsRow.rowCount === 0) {
      throw new Error(
        `BDD seed: workspace "${args.workspaceSlug}" not found. ` +
          `Create it via the UI before running this scenario.`,
      );
    }
    const workspaceId = wsRow.rows[0].id;

    await client.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, NOW(), NOW())`,
      [userId, `BDD ${email}`, email],
    );
    await client.query(
      `INSERT INTO workspace_member (workspace_id, user_id, role)
         VALUES ($1, $2, $3)`,
      [workspaceId, userId, args.role],
    );

    // Set expiry decades into the future. Short expiries (e.g. 1h)
    // round-trip through `timestamp without time zone` in a way
    // that the better-auth session validator sometimes treats as
    // already-expired — the cookie is recognized but the row is
    // wiped before findSession can return it. A far-future date
    // sidesteps the question entirely, and the row gets cleaned up
    // in the After hook regardless.
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 100 * 365 * 24 * 3600 * 1000);
    await client.query(
      `INSERT INTO session (id, token, "userId", "expiresAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [sessionId, sessionToken, userId, expiresAt],
    );

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  return {
    userId,
    email,
    sessionToken,
    signedCookieValue: signCookieValue(sessionToken, secret),
  };
}

/**
 * Drop the seeded user (cascades to workspace_member + session).
 * Best-effort — a failure here pollutes the dev DB but doesn't
 * break the run. Always call from an After hook so failed
 * scenarios still clean up.
 */
export async function destroySeededUser(userId: string): Promise<void> {
  await pool
    .query(`DELETE FROM "user" WHERE id = $1`, [userId])
    .catch((e) => {
      // Surface the error in stderr but don't reraise — the test
      // result already captured the scenario outcome.
      console.error(`[bdd] failed to clean up test user ${userId}:`, e);
    });
}

/** Tear down the pool at end-of-run so the process exits cleanly. */
export async function closeBddPool(): Promise<void> {
  await pool.end();
}
