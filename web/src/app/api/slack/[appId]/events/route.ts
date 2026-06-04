import { NextResponse, type NextRequest } from "next/server";

import { postMessage, publishHomeView } from "@/lib/slack-api";
import {
  buildHomeView,
  dispatchToAgent,
  parseCommand,
} from "@/lib/slack-dispatch";
import { authenticateSlackRequest } from "@/lib/slack-inbound";
import {
  claimSlackEvent,
  listAgentsForSlackApp,
  type SlackApp,
} from "@/lib/slack-apps";

// Events API endpoint. Handles the one-time url_verification handshake
// (pre-install, no bot token), then app_mention + message.im events.
// We ack 200 immediately and dispatch out of band — Slack retries any
// response slower than 3s, and a fast ack avoids duplicate fires.

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ appId: string }>;

type SlackEvent = {
  type?: string;
  subtype?: string;
  user?: string;
  bot_id?: string;
  text?: string;
  channel?: string;
  channel_type?: string;
  ts?: string;
  thread_ts?: string;
  /** app_home_opened: which tab the user opened ("home" | "messages"). */
  tab?: string;
};

type EventEnvelope = {
  type?: string;
  challenge?: string;
  /** Stable id for the delivery; identical across Slack's retries. */
  event_id?: string;
  event?: SlackEvent;
};

export async function POST(
  request: NextRequest,
  { params }: { params: RouteParams },
): Promise<NextResponse> {
  const { appId } = await params;
  const auth = await authenticateSlackRequest(request, appId);
  if (!auth.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: auth.status });
  }
  const { app, botToken, rawBody } = auth;

  let body: EventEnvelope;
  try {
    body = JSON.parse(rawBody) as EventEnvelope;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  // Slack's URL-ownership handshake — happens during setup, before install.
  if (body.type === "url_verification" && body.challenge) {
    return NextResponse.json({ challenge: body.challenge });
  }

  // Everything past here needs the bot token (to reply). Ack regardless so
  // Slack stops retrying.
  if (!botToken) return new NextResponse(null, { status: 200 });

  const event = body.event;
  if (event) {
    const eventId = body.event_id;
    void (async () => {
      // Replay guard: a Slack retry carries the same event_id. Claim it
      // first; if it's already been handled, skip to avoid a double run.
      if (eventId && !(await claimSlackEvent(app.id, eventId))) return;
      await handleEvent(app, botToken, event);
    })();
  }

  return new NextResponse(null, { status: 200 });
}

// Strip leading "<@U123>" mention tokens an app_mention carries before the
// actual "<agent> <input>".
function stripMentions(text: string): string {
  return text.replace(/^(?:\s*<@[^>]+>)+/, "").trim();
}

async function handleEvent(
  app: SlackApp,
  botToken: string,
  event: SlackEvent,
): Promise<void> {
  // App Home tab opened → publish the agent directory for this user.
  if (event.type === "app_home_opened") {
    if (event.tab && event.tab !== "home") return;
    if (!event.user) return;
    const scoped = await listAgentsForSlackApp(app);
    await publishHomeView(botToken, event.user, buildHomeView(app.name, scoped));
    return;
  }

  // Ignore anything we sent, and message edits/joins/etc. (subtypes).
  if (event.bot_id) return;
  const isMention = event.type === "app_mention";
  const isDirectMessage =
    event.type === "message" &&
    event.channel_type === "im" &&
    !event.subtype;
  if (!isMention && !isDirectMessage) return;

  const channel = event.channel;
  if (!channel || !event.user) return;
  // Reply in-thread: under the mention, or under the DM message.
  const threadTs = event.thread_ts ?? event.ts ?? null;

  const text = stripMentions(event.text ?? "");
  const { agentName } = parseCommand(text);

  // Conversational opener ("Hi"), a bare mention, or a typo'd agent — none
  // of these are an agent this bot can launch, and events carry no
  // trigger_id so we can't open the picker modal. Reply with the menu
  // instead of treating the first word as an agent and erroring.
  const scoped = await listAgentsForSlackApp(app);
  const matched = agentName
    ? scoped.find((a) => a.name === agentName)
    : undefined;
  if (!matched) {
    const text =
      scoped.length === 0
        ? "No agents are assigned to this bot yet. An admin can scope it in TAS → Settings → Slack apps: give the bot one or more labels, then add a matching `labels:` line to an agent."
        : `Tell me which agent to run, e.g. \`${scoped[0].name} do the thing\`. I can launch:\n${scoped
            .map((a) => `• \`${a.name}\``)
            .join("\n")}`;
    await postMessage(botToken, {
      channel,
      thread_ts: threadTs ?? undefined,
      text,
    });
    return;
  }

  const result = await dispatchToAgent({
    app,
    botToken,
    slackUserId: event.user,
    text,
    channel,
    threadTs,
  });
  const message = result.ok
    ? `:rocket: Launched *${result.agentName}* as ${result.actingAs}. I'll post the result here when it's done.`
    : `:warning: ${result.message}`;
  await postMessage(botToken, {
    channel,
    thread_ts: threadTs ?? undefined,
    text: message,
  });
}
