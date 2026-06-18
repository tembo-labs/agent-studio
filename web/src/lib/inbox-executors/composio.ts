import "server-only";

import { composioUserId } from "@/lib/composio";
import { getWorkspaceSecretPlaintext } from "@/lib/workspace";

import type { InboxExecutor } from "./index";

// Executes inbox options whose `execute.provider === "composio"` by calling a
// Composio tool on the clicking user's connected account — e.g. sending a Gmail
// reply via GMAIL_REPLY_TO_THREAD. The producing agent stores:
//   op:               the Composio tool slug
//   params.toolArgs:  fixed arguments (thread_id, recipient_email, …)
//   params.bodyArg:   which argument receives the human's (edited) reply `text`
//                     (omit for one-click actions that take no free text)
// Composio resolves the connected account from user_id (workspace:user) + the
// tool's toolkit, so the action runs as the same account the agent ran with.
// Mirrors web/scripts/composio-execute.mjs.
const EXECUTE_URL = "https://backend.composio.dev/api/v3.1/tools/execute";

// One Composio tool call. Throws on transport error or a graceful failure
// (successful:false) so the caller surfaces it and leaves the item unresolved.
async function callComposioTool(
  apiKey: string,
  composioUid: string,
  slug: string,
  args: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${EXECUTE_URL}/${encodeURIComponent(slug)}`, {
    method: "POST",
    headers: { "x-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      user_id: composioUid,
      arguments: args,
      // The tool list hides version specifics; skip the check like the script.
      dangerously_skip_version_check: true,
    }),
  });
  const json = (await res.json().catch(() => null)) as
    | { successful?: boolean; error?: unknown }
    | null;
  if (!res.ok) {
    throw new Error(`Composio ${slug} failed (HTTP ${res.status}).`);
  }
  if (json && json.successful === false) {
    const msg =
      typeof json.error === "string" && json.error
        ? json.error
        : "the tool reported a failure";
    throw new Error(`Composio ${slug} failed: ${msg}`);
  }
}

export const composioExecutor: InboxExecutor = async ({
  workspaceId,
  userId,
  op,
  params,
  text,
}) => {
  if (!op) throw new Error("composio action is missing a tool slug (op).");
  if (!userId) throw new Error("composio action requires a signed-in user.");

  const toolArgs =
    params?.toolArgs && typeof params.toolArgs === "object"
      ? (params.toolArgs as Record<string, unknown>)
      : {};
  const bodyArg = typeof params?.bodyArg === "string" ? params.bodyArg : null;
  const body = (text ?? "").trim();
  if (bodyArg && !body) throw new Error("Reply text is empty.");
  const args = bodyArg ? { ...toolArgs, [bodyArg]: body } : toolArgs;

  let apiKey: string;
  try {
    apiKey = await getWorkspaceSecretPlaintext(workspaceId, "composio_api_key");
  } catch {
    apiKey = "";
  }
  if (!apiKey) {
    throw new Error("No Composio API key is configured for this workspace.");
  }

  const composioUid = composioUserId(workspaceId, userId);
  await callComposioTool(apiKey, composioUid, op, args);

  // Optional follow-up calls run in order after the main op — e.g. "Send and
  // Archive" replies, then removes the INBOX label. Each takes its own fixed
  // toolArgs (no body text). A failure here surfaces and leaves the item
  // unresolved, same as the main op.
  const also = Array.isArray(params?.also) ? params.also : [];
  for (const step of also) {
    if (!step || typeof step !== "object") continue;
    const s = step as { op?: unknown; toolArgs?: unknown };
    const sop = typeof s.op === "string" ? s.op : null;
    if (!sop) continue;
    const sargs =
      s.toolArgs && typeof s.toolArgs === "object"
        ? (s.toolArgs as Record<string, unknown>)
        : {};
    await callComposioTool(apiKey, composioUid, sop, sargs);
  }
};
