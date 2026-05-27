"use server";

import { notFound } from "next/navigation";

import {
  ALL_AUDIT_SOURCES,
  type AuditSource,
  listAuditTimeline,
} from "@/lib/audit-db";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug, userIsMember } from "@/lib/workspace";

import { toLoadedAudit, type LoadedAuditEntry } from "./shape";

// "Load more" handler for the audit timeline. The client component
// passes the last seen `at` so we cursor down through history without
// reissuing rows we already rendered.

export async function loadAuditAction(input: {
  workspaceSlug: string;
  filters: {
    sources?: AuditSource[];
    actor?: string;
    agent?: string;
    since?: string; // ISO
  };
  beforeIso?: string;
}): Promise<LoadedAuditEntry[]> {
  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(input.workspaceSlug);
  if (!workspace) notFound();
  const ok = await userIsMember(workspace.id, session.user.id);
  if (!ok) notFound();

  const sources = (input.filters.sources ?? []).filter((s): s is AuditSource =>
    ALL_AUDIT_SOURCES.includes(s),
  );
  const rows = await listAuditTimeline(
    workspace.id,
    {
      sources: sources.length ? sources : undefined,
      actorUserId: input.filters.actor || undefined,
      agentName: input.filters.agent || undefined,
      since: input.filters.since ? new Date(input.filters.since) : undefined,
      before: input.beforeIso ? new Date(input.beforeIso) : undefined,
    },
    100,
  );
  return rows.map(toLoadedAudit);
}
