import { NextResponse, type NextRequest } from "next/server";

import {
  ALL_AUDIT_SOURCES,
  type AuditSource,
} from "@/lib/audit";
import { listAuditTimeline, writeAuditEvent } from "@/lib/audit-db";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug, userIsMember } from "@/lib/workspace";

// US-0.4-04 — audit timeline export. JSON-only at v0.4 (streaming to
// a SIEM is the v0.5 open question per the user story).
//
// Reads the same filter shape as /<workspace>/audit so the UI's
// "Export JSON" button can hand off the current filter set as URL
// params and get back the matching rows. Hard-caps the export at
// EXPORT_LIMIT — anything larger should land in the SIEM-streaming
// story, not a single HTTP download.
//
// The export is itself audited: a row of kind 'audit.exported' lands
// on every successful download with the filter snapshot in payload.
// "Who exported what, when" stays governed even though the rows the
// export contains are the audit data itself.

export const dynamic = "force-dynamic";

const EXPORT_LIMIT = 10_000;

const SINCE_PRESETS: Record<string, number | null> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: null,
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspace: string }> },
): Promise<NextResponse> {
  const { workspace: slug } = await params;

  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: "unknown workspace" }, { status: 404 });
  }
  const ok = await userIsMember(workspace.id, session.user.id);
  if (!ok) {
    return NextResponse.json({ error: "not a member" }, { status: 403 });
    // TODO(US-0.4-02): swap to requireWorkspaceRole(>= viewer) once
    // RBAC lands. The viewer role gets read access (the AC for
    // US-0.4-04 says exports honor RBAC); membership today is the
    // closest stand-in.
  }

  const sp = request.nextUrl.searchParams;
  const sources = parseMulti(sp.getAll("source"), ALL_AUDIT_SOURCES);
  const actor = sp.get("actor")?.trim() || undefined;
  const agent = sp.get("agent")?.trim() || undefined;
  const sinceKey = sp.get("since") ?? "30d";
  const sinceMs = sinceKey in SINCE_PRESETS ? SINCE_PRESETS[sinceKey] : SINCE_PRESETS["30d"];
  const since = sinceMs === null ? undefined : new Date(Date.now() - sinceMs);

  const entries = await listAuditTimeline(
    workspace.id,
    {
      sources: sources.length ? sources : undefined,
      actorUserId: actor,
      agentName: agent,
      since,
    },
    EXPORT_LIMIT,
  );

  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: session.user.id,
    source: "human_action",
    kind: "audit.exported",
    targetType: "workspace",
    targetId: null,
    agentName: null,
    payload: {
      filters: {
        sources: sources.length ? sources : null,
        actor: actor ?? null,
        agent: agent ?? null,
        since: sinceKey,
      },
      rowCount: entries.length,
      truncated: entries.length >= EXPORT_LIMIT,
    },
  });

  // Envelope carries the filter snapshot + truncation flag alongside
  // the rows so the consumer (a SIEM, an auditor script) can reason
  // about the export without re-deriving from the URL.
  const envelope = {
    workspace: { id: workspace.id, slug: workspace.slug, name: workspace.name },
    exportedAt: new Date().toISOString(),
    exportedByUserId: session.user.id,
    filters: {
      sources: sources.length ? sources : null,
      actor: actor ?? null,
      agent: agent ?? null,
      since: sinceKey,
    },
    truncated: entries.length >= EXPORT_LIMIT,
    rowCount: entries.length,
    entries: entries.map((e) => ({
      ...e,
      at: e.at.toISOString(),
    })),
  };

  const filename = buildFilename(workspace.slug, agent);
  return new NextResponse(JSON.stringify(envelope, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function parseMulti<T extends string>(raw: string[], allowed: T[]): T[] {
  if (raw.length === 0) return [];
  // Tolerate ?source=a,b shorthand for hand-typed URLs in addition to
  // the canonical ?source=a&source=b that the UI emits.
  const flat = raw.flatMap((v) =>
    v.split(",").map((s) => s.trim()).filter(Boolean),
  );
  const ok = new Set<string>(allowed);
  return flat.filter((v): v is T => ok.has(v));
}

function buildFilename(slug: string, agent: string | undefined): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const safeAgent = agent ? `-${agent.replace(/[^a-zA-Z0-9_-]/g, "_")}` : "";
  return `audit-${slug}${safeAgent}-${stamp}.json`;
}

// Re-export the AuditSource type so the import-tree stays neat.
export type { AuditSource };
