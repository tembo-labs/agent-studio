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
    const res = await fetch(`https://slack.com/api/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      body: JSON.stringify(body),
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
