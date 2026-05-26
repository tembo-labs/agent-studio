export function getInstanceName(): string {
  return process.env.TAS_INSTANCE_NAME?.trim() || "Tembo Agent Studio";
}

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
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
