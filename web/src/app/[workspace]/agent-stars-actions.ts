"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { setAgentStar } from "@/lib/agent-stars";
import { authorizeWorkspace, DENIED_MESSAGE } from "@/lib/auth-server";

export type StarActionResult = { ok: true } | { ok: false; error: string };

// Star / unstar an agent for the current user. Stars are a personal visibility
// preference, so viewer is enough (no repo write). Revalidate the workspace
// layout so the agents list + its default filter reflect the change.
export async function toggleAgentStarAction(args: {
  workspaceSlug: string;
  agentName: string;
  starred: boolean;
}): Promise<StarActionResult> {
  const auth = await authorizeWorkspace(args.workspaceSlug, "viewer");
  if (!auth.ok) {
    if (auth.reason === "denied") return { ok: false, error: DENIED_MESSAGE };
    notFound();
  }
  await setAgentStar(
    auth.workspace.id,
    auth.userId,
    args.agentName,
    args.starred,
  );
  revalidatePath(`/${args.workspaceSlug}`, "layout");
  return { ok: true };
}
