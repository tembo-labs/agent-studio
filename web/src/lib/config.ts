export const DEFAULT_INSTANCE_NAME = "Tembo Agent Studio";

// Env-only instance name. The DB-backed value (set via instance
// settings) takes precedence — see `getInstanceName` in
// `@/lib/instance-settings`, which falls back to this. Kept sync so it
// can be used where a DB read isn't available (build env, fallbacks).
export function getInstanceNameFromEnv(): string {
  return process.env.TAS_INSTANCE_NAME?.trim() || DEFAULT_INSTANCE_NAME;
}

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// When set, the /for-agents tool reference is served WITHOUT a token for every
// provider (not just TAS's own self-key MCP), rendering the instance's
// workspace-agnostic tool catalog. Off by default so customer instances keep
// the reference token-gated (it reveals which integrations are connected); we
// enable it on the internal dogfood instance for easy inspection.
export function isForAgentsPublic(): boolean {
  const v = process.env.TAS_FOR_AGENTS_PUBLIC?.trim().toLowerCase();
  return v === "1" || v === "true";
}

// Instance admins, by env allowlist. Pure (no DB/session) so the auth
// account-creation gate can import it without a cycle through
// lib/session → lib/auth. lib/instance re-exports these alongside the
// session-aware authorizeInstance().
export function getInstanceAdminEmails(): string[] {
  return (process.env.INSTANCE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isInstanceAdminEmail(
  email: string | null | undefined,
): boolean {
  if (!email) return false;
  return getInstanceAdminEmails().includes(email.trim().toLowerCase());
}

// Connection-level OAuth apps are separate from the sign-in Google
// app (different scope, different consent screen). Returning the
// configured ones lets the Settings → Connections section surface
// a "Set X env vars" banner instead of a 500 from the /authorize
// route when env wiring is incomplete.
export function isSlackConnectionConfigured(): boolean {
  return Boolean(
    process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET,
  );
}

export function isGoogleConnectionConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CONNECTIONS_CLIENT_ID &&
      process.env.GOOGLE_CONNECTIONS_CLIENT_SECRET,
  );
}

/**
 * Public origin of the web app — used as the OAuth `redirect_uri` base
 * when we hand the user off to Slack / Google. Reuses the same env var
 * better-auth already requires.
 */
export function getPublicOrigin(): string {
  return process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export const POWERED_BY_HREF = "https://github.com/tembo/agent-studio";

// Running release version, surfaced in the login footer ("powered by
// Tembo Agent Studio <version>"). Set from the deployed image tag via
// the TAS_VERSION env (compose passes it through). Null when unset
// (e.g. a from-source dev build) so the footer just omits it.
export function getAppVersion(): string | null {
  return process.env.TAS_VERSION?.trim() || null;
}
