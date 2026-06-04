"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { writeAuditEvent } from "@/lib/audit-db";
import { authorizeWorkspace, DENIED_MESSAGE } from "@/lib/auth-server";
import { dismissPendingCreate } from "@/lib/improvements-api";

export type DismissPendingState = { error?: string };

/**
 * Dismiss a pending agent-create from the workspace inventory. Operator+
 * only. Marks the create improvement `closed` so it drops off the home
 * page; the GitHub PR (if any) is left for the user to merge/close on
 * GitHub. revalidatePath refreshes the inventory.
 */
export async function dismissPendingCreateAction(
  _prev: DismissPendingState,
  formData: FormData,
): Promise<DismissPendingState> {
  const slug = String(formData.get("workspace") ?? "");
  const improvementId = String(formData.get("improvementId") ?? "");
  if (!improvementId) return { error: "Missing pending item." };

  const auth = await authorizeWorkspace(slug, "operator");
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId } = auth;

  const ok = await dismissPendingCreate(workspace.id, improvementId);
  if (!ok) return { error: "That item is no longer pending." };

  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "human_action",
    kind: "improvement.dismissed",
    targetType: "improvement",
    targetId: improvementId,
    agentName: null,
    payload: {},
  });

  revalidatePath(`/${slug}`);
  return {};
}
