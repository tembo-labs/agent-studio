import "server-only";

// Minimal Slack Web API client — just the calls the dispatcher needs.
// All take the app's bot token (xoxb-…). Errors are returned, not thrown,
// so an inbound handler can degrade gracefully (Slack expects a fast 200).

type SlackApiResult<T = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

async function call<T = Record<string, unknown>>(
  method: string,
  token: string,
  body: Record<string, unknown>,
): Promise<SlackApiResult<T>> {
  try {
    // Form-encode, not JSON: every Slack Web API method accepts
    // application/x-www-form-urlencoded, but several read methods
    // (users.info, chat.getPermalink, …) silently ignore a JSON body, so
    // JSON-only would break them. Nested values (e.g. a `view` object for
    // views.open/publish) go in as JSON strings, which Slack expects.
    const form = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      if (value === undefined || value === null) continue;
      form.set(key, typeof value === "string" ? value : JSON.stringify(value));
    }
    const res = await fetch(`https://slack.com/api/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      body: form,
    });
    return (await res.json()) as SlackApiResult<T>;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network" };
  }
}

/** Post a message, optionally threaded under `thread_ts`. */
export function postMessage(
  token: string,
  args: { channel: string; text: string; thread_ts?: string },
): Promise<SlackApiResult<{ ts?: string }>> {
  return call("chat.postMessage", token, {
    channel: args.channel,
    text: args.text,
    ...(args.thread_ts ? { thread_ts: args.thread_ts } : {}),
  });
}

/** Open a modal (the agent picker) for a slash command's trigger_id. */
export function openView(
  token: string,
  triggerId: string,
  view: Record<string, unknown>,
): Promise<SlackApiResult> {
  return call("views.open", token, { trigger_id: triggerId, view });
}

/**
 * Post a delayed reply to a slash command's response_url (valid ~30 min,
 * up to 5 uses). Used to deliver the dispatch ack after the immediate 200.
 */
export async function postResponseUrl(
  responseUrl: string,
  body: { text: string; response_type?: "ephemeral" | "in_channel" },
): Promise<void> {
  try {
    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ response_type: "ephemeral", ...body }),
    });
  } catch {
    // best-effort; the run was already enqueued
  }
}

/** A web permalink to a specific message, for deep-linking from the UI. */
export async function getPermalink(
  token: string,
  channel: string,
  messageTs: string,
): Promise<string | null> {
  const res = await call<{ permalink?: string }>("chat.getPermalink", token, {
    channel,
    message_ts: messageTs,
  });
  return res.ok ? (res.permalink ?? null) : null;
}

/** Publish the bot's App Home (the "Home" tab) for a given user. */
export function publishHomeView(
  token: string,
  userId: string,
  view: Record<string, unknown>,
): Promise<SlackApiResult> {
  return call("views.publish", token, { user_id: userId, view });
}

/** The Slack user's verified email — used to map them to a TAS member. */
export async function getUserEmail(
  token: string,
  slackUserId: string,
): Promise<string | null> {
  const res = await call<{ user?: { profile?: { email?: string } } }>(
    "users.info",
    token,
    { user: slackUserId },
  );
  if (!res.ok) return null;
  return res.user?.profile?.email ?? null;
}

/** Resolve an email to its Slack user id (so we can DM them). Returns null
 *  when no workspace member has that email. Needs the `users:read.email`
 *  scope — same one getUserEmail relies on. */
export async function lookupUserByEmail(
  token: string,
  email: string,
): Promise<string | null> {
  const res = await call<{ user?: { id?: string } }>(
    "users.lookupByEmail",
    token,
    { email },
  );
  return res.ok ? (res.user?.id ?? null) : null;
}
