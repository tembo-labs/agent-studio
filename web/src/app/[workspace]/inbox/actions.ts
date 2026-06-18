"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { writeAuditEvent } from "@/lib/audit-db";
import { authorizeWorkspace, DENIED_MESSAGE } from "@/lib/auth-server";
import {
  completeInboxItem,
  countActiveInboxItems,
  dismissInboxItem,
  getInboxItem,
  snoozeInboxItem,
} from "@/lib/inbox-api";
import { executeInboxOption } from "@/lib/inbox-executors";

// In-app (session-auth) server actions for the Tasks Inbox triage screen. The
// human reviews the agent's proposed action, edits it, and submits — we record
// the final action and write a hitl_response audit event. We do NOT open a PR
// here: the (proposed, final) pair is just a signal; the scheduler's batched
// learning pass later turns accumulated signals into one improvement.
//
// (Distinct from the agent-facing completeInboxItemFor in @/lib/api-v1/actions,
// which serves MCP/REST under API-key auth — same DB layer, different doorway.)

export type InboxActionResult = { ok: true } | { ok: false; error: string };

export async function submitInboxItemAction(args: {
  workspaceSlug: string;
  itemId: string;
  text: string;
  fields?: Record<string, unknown>;
}): Promise<InboxActionResult> {
  const text = args.text.trim();
  if (!text && !args.fields) {
    return { ok: false, error: "Write a final action before submitting." };
  }

  const auth = await authorizeWorkspace(args.workspaceSlug, "operator");
  if (!auth.ok) {
    if (auth.reason === "denied") return { ok: false, error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId } = auth;

  const item = await getInboxItem(args.itemId, workspace.id);
  if (!item) notFound();

  const finalAction = {
    ...(text ? { text } : {}),
    ...(args.fields ? { fields: args.fields } : {}),
  };
  const ok = await completeInboxItem(args.itemId, workspace.id, finalAction);
  if (!ok) {
    return { ok: false, error: "This item was already resolved. Refresh the page." };
  }

  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "hitl_response",
    kind: "inbox.completed",
    targetType: "inbox_item",
    targetId: args.itemId,
    agentName: null,
    payload: { source: item.source, itemType: item.itemType },
  });

  revalidateInbox(args.workspaceSlug);
  return { ok: true };
}

export async function dismissInboxItemAction(args: {
  workspaceSlug: string;
  itemId: string;
}): Promise<InboxActionResult> {
  const auth = await authorizeWorkspace(args.workspaceSlug, "operator");
  if (!auth.ok) {
    if (auth.reason === "denied") return { ok: false, error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId } = auth;

  const ok = await dismissInboxItem(args.itemId, workspace.id);
  if (!ok) {
    return { ok: false, error: "This item was already resolved. Refresh the page." };
  }

  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "hitl_response",
    kind: "inbox.dismissed",
    targetType: "inbox_item",
    targetId: args.itemId,
    agentName: null,
  });

  revalidateInbox(args.workspaceSlug);
  return { ok: true };
}

// The human picked an action-menu button. Look up the chosen option ON THE
// STORED ITEM (never trust client params), run its executor synchronously
// (e.g. archive/send on LinkedIn), and only on success resolve the item with
// final_action = { fields: { optionId }, text? } — which feeds the learning
// loop (which option + wording I chose vs. the agent's recommendation). On
// executor failure we surface the error and leave the item unresolved.
export async function executeInboxOptionAction(args: {
  workspaceSlug: string;
  itemId: string;
  optionId: string;
  text?: string;
}): Promise<InboxActionResult> {
  const auth = await authorizeWorkspace(args.workspaceSlug, "operator");
  if (!auth.ok) {
    if (auth.reason === "denied") return { ok: false, error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId } = auth;

  const item = await getInboxItem(args.itemId, workspace.id);
  if (!item) notFound();

  const option = item.options?.find((o) => o.id === args.optionId);
  if (!option) {
    return { ok: false, error: "That action is no longer available. Refresh the page." };
  }

  try {
    await executeInboxOption(workspace.id, userId, option, args.text);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't perform that action.",
    };
  }

  const finalAction = {
    fields: { optionId: option.id },
    ...(option.kind === "reply" && args.text?.trim() ? { text: args.text.trim() } : {}),
  };
  const ok = await completeInboxItem(args.itemId, workspace.id, finalAction);
  if (!ok) {
    return { ok: false, error: "This item was already resolved. Refresh the page." };
  }

  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "hitl_response",
    kind: "inbox.option_executed",
    targetType: "inbox_item",
    targetId: args.itemId,
    agentName: null,
    payload: { optionId: option.id, provider: option.execute?.provider ?? null, op: option.execute?.op ?? null },
  });

  revalidateInbox(args.workspaceSlug);
  return { ok: true };
}

// Snooze the item out of the inbox for `hours`, after which it reappears
// automatically. No external action — just hides it until then.
export async function snoozeInboxItemAction(args: {
  workspaceSlug: string;
  itemId: string;
  hours: number;
}): Promise<InboxActionResult> {
  const auth = await authorizeWorkspace(args.workspaceSlug, "operator");
  if (!auth.ok) {
    if (auth.reason === "denied") return { ok: false, error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId } = auth;

  const hours = Math.max(1, Math.min(Math.round(args.hours), 24 * 90)); // 1h … 90d
  const until = new Date(Date.now() + hours * 3_600_000);

  const ok = await snoozeInboxItem(args.itemId, workspace.id, until);
  if (!ok) {
    return { ok: false, error: "This item was already resolved. Refresh the page." };
  }

  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "hitl_response",
    kind: "inbox.snoozed",
    targetType: "inbox_item",
    targetId: args.itemId,
    agentName: null,
    payload: { untilIso: until.toISOString() },
  });

  revalidateInbox(args.workspaceSlug);
  return { ok: true };
}

// Every in-app inbox action changes the active count, which the sidebar badge
// renders from the workspace layout. Revalidate that layout (+ the inbox list)
// so the badge + list refresh when the action's router.push lands — the layout
// is otherwise cached across client navigations and shows a stale count.
function revalidateInbox(workspaceSlug: string): void {
  revalidatePath(`/${workspaceSlug}`, "layout");
}

// Live active-inbox count for the sidebar badge. Items produced by AGENTS land
// out-of-band (a background run, not a user action), so the layout-rendered
// badge would otherwise stay stale until the next navigation/refresh. The
// sidebar polls this. Returns 0 on any auth failure rather than throwing — a
// badge poll should never surface an error to the user.
export async function getActiveInboxCountAction(
  workspaceSlug: string,
): Promise<number> {
  const auth = await authorizeWorkspace(workspaceSlug, "viewer");
  if (!auth.ok) return 0;
  return countActiveInboxItems(auth.workspace.id);
}
