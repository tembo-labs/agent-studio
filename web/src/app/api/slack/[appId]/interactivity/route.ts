import { NextResponse, type NextRequest } from "next/server";

import { postMessage } from "@/lib/slack-api";
import { dispatchToAgent, PICKER_CALLBACK_ID } from "@/lib/slack-dispatch";
import { authenticateSlackRequest } from "@/lib/slack-inbound";

// Interactivity endpoint: receives the agent-picker modal submission. Slack
// sends a urlencoded body with a single `payload` field (JSON). We close
// the modal with an immediate 200, then dispatch out of band and post the
// confirmation into the channel the picker was opened from (modals have no
// response_url, so we use the private_metadata we stashed when opening it).

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ appId: string }>;

type ViewState = {
  values?: Record<string, Record<string, { value?: string; selected_option?: { value?: string } }>>;
};

type InteractivityPayload = {
  type?: string;
  user?: { id?: string };
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
    payload.type !== "view_submission" ||
    payload.view?.callback_id !== PICKER_CALLBACK_ID
  ) {
    // Not ours (or a non-submission interaction) — ack and ignore.
    return new NextResponse(null, { status: 200 });
  }

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

  if (botToken && channel && agentName && slackUserId) {
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

  // Empty 200 closes the modal.
  return new NextResponse(null, { status: 200 });
}
