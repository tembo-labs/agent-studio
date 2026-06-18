"use server";

import { notFound } from "next/navigation";

import { writeAuditEvent } from "@/lib/audit-db";
import { authorizeWorkspace, DENIED_MESSAGE } from "@/lib/auth-server";
import {
  completeInboxItem,
  dismissInboxItem,
  getInboxItem,
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
    await executeInboxOption(workspace.id, option, args.text);
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

  return { ok: true };
}
