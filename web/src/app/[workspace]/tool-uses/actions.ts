"use server";

import { notFound } from "next/navigation";

import {
  listToolCallsForWorkspace,
  type ToolCallListFilters,
} from "@/lib/runs-db";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug, userIsMember } from "@/lib/workspace";

import { toLoaded, type LoadedToolCall } from "./shape";

// Fetch a page of tool calls for the workspace given filters + a keyset
// cursor (the last row's createdAt + id). Mirrors runs/actions.ts.

export type LoadToolUsesArgs = {
  workspaceSlug: string;
  filters: ToolCallListFilters;
  before?: { createdAtIso: string; id: string };
};

export async function loadToolUsesAction(
  args: LoadToolUsesArgs,
): Promise<LoadedToolCall[]> {
  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(args.workspaceSlug);
  if (!workspace) notFound();

  const isMember = await userIsMember(workspace.id, session.user.id);
  if (!isMember) notFound();

  const rows = await listToolCallsForWorkspace(workspace.id, args.filters, {
    before: args.before
      ? { createdAt: new Date(args.before.createdAtIso), id: args.before.id }
      : undefined,
  });

  return rows.map(toLoaded);
}
