import { NextResponse, type NextRequest } from "next/server";

import { openView, postMessage, postResponseUrl } from "@/lib/slack-api";
import {
  buildPickerView,
  dispatchToAgent,
  MESSAGE_SHORTCUT_CALLBACK_ID,
  PICKER_CALLBACK_ID,
} from "@/lib/slack-dispatch";
import { authenticateSlackRequest } from "@/lib/slack-inbound";
import { listAgentsForSlackApp, type SlackApp } from "@/lib/slack-apps";

// Interactivity endpoint. Two payloads land here:
//   - message_action ("Run agent on this message" shortcut) → open the
//     agent picker prefilled with the message text.
//   - view_submission (the picker's "Run") → dispatch the chosen agent and
//     post the confirmation into the originating channel/thread (modals
//     have no response_url, so we use the private_metadata we stashed).

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ appId: string }>;

type ViewState = {
  values?: Record<string, Record<string, { value?: string; selected_option?: { value?: string } }>>;
};

type InteractivityPayload = {
  type?: string;
  callback_id?: string;
  trigger_id?: string;
  response_url?: string;
  user?: { id?: string };
  channel?: { id?: string };
  message?: { text?: string; ts?: string };
  view?: {
    callback_id?: string;
    private_metadata?: string;
    state?: ViewState;
  };
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

  const payloadRaw = new URLSearchParams(rawBody).get("payload");
  if (!payloadRaw) return new NextResponse(null, { status: 200 });

  let payload: InteractivityPayload;
  try {
    payload = JSON.parse(payloadRaw) as InteractivityPayload;
  } catch {
    return new NextResponse(null, { status: 200 });
  }

  if (
    payload.type === "message_action" &&
    payload.callback_id === MESSAGE_SHORTCUT_CALLBACK_ID
  ) {
    await handleMessageShortcut(app, botToken, payload);
    return new NextResponse(null, { status: 200 });
  }

  if (
    payload.type === "view_submission" &&
    payload.view?.callback_id === PICKER_CALLBACK_ID
  ) {
    handlePickerSubmission(app, botToken, payload);
    // Empty 200 closes the modal.
    return new NextResponse(null, { status: 200 });
  }

  // Not ours — ack and ignore.
  return new NextResponse(null, { status: 200 });
}

// "Run agent on this message" → open the picker, prefilled with the message
// text and targeted at the message's thread so the result lands under it.
async function handleMessageShortcut(
  app: SlackApp,
  botToken: string | null,
  payload: InteractivityPayload,
): Promise<void> {
  if (!botToken || !payload.trigger_id) return;
  const channel = payload.channel?.id ?? "";
  const messageTs = payload.message?.ts ?? null;
  const messageText = payload.message?.text ?? "";

  const scoped = await listAgentsForSlackApp(app);
  if (scoped.length === 0) {
    if (payload.response_url) {
      await postResponseUrl(payload.response_url, {
        text: "This bot has no agents assigned yet. An admin can scope agents to it in TAS → Settings → Slack apps.",
      });
    }
    return;
  }

  await openView(
    botToken,
    payload.trigger_id,
    buildPickerView(scoped, { channel, threadTs: messageTs }, messageText),
  );
}

// Picker "Run" → dispatch the chosen agent out of band and post the
// confirmation into the channel/thread the picker was opened from.
function handlePickerSubmission(
  app: SlackApp,
  botToken: string | null,
  payload: InteractivityPayload,
): void {
  const slackUserId = payload.user?.id ?? "";
  const values = payload.view?.state?.values ?? {};
  const agentName = values.agent?.agent?.selected_option?.value ?? "";
  const input = values.input?.input?.value ?? "";

  let channel = "";
  let threadTs: string | null = null;
  try {
    const meta = JSON.parse(payload.view?.private_metadata ?? "{}") as {
      channel?: string;
      threadTs?: string | null;
    };
    channel = meta.channel ?? "";
    threadTs = meta.threadTs ?? null;
  } catch {
    // no usable target
  }

  if (!botToken || !channel || !agentName || !slackUserId) return;

  void (async () => {
    const result = await dispatchToAgent({
      app,
      botToken,
      slackUserId,
      text: `${agentName} ${input}`.trim(),
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
  })();
}
