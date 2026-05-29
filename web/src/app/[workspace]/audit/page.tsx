import { notFound } from "next/navigation";

import {
  ALL_AUDIT_SOURCES,
  type AuditEntry,
  type AuditSource,
  listAuditActors,
  listAuditTimeline,
} from "@/lib/audit-db";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/workspace";

import { AuditTimeline } from "./audit-timeline";
import { toLoadedAudit } from "./shape";

export const dynamic = "force-dynamic";

// Workspace-wide audit timeline (US-0.4-01). Cross-cutting policy +
// access events, plus the derived run/improvement projections, in
// one filterable feed.
//
// Filters are URL-driven so deep links land prefiltered — same
// pattern as /<workspace>/runs. The client component takes over for
// "Load more" pagination via a server action.

type SinceKey = "24h" | "7d" | "30d" | "all";

const SINCE_PRESETS: Record<SinceKey, number | null> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: null,
};

function isSinceKey(v: string): v is SinceKey {
  return v === "24h" || v === "7d" || v === "30d" || v === "all";
}

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspace: slug } = await params;
  const sp = await searchParams;

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  // URL params:
  //   ?source=human_action&source=system  → multi-select sources
  //   ?actor=<user-id>                    → filter by actor
  //   ?agent=<name>                       → filter by agent
  //   ?since=24h|7d|30d|all               → time preset (default 30d)
  const sources = parseMulti(sp.source, ALL_AUDIT_SOURCES);
  const actor = typeof sp.actor === "string" ? sp.actor.trim() || undefined : undefined;
  const agent = typeof sp.agent === "string" ? sp.agent.trim() || undefined : undefined;
  const sinceKey: SinceKey =
    typeof sp.since === "string" && isSinceKey(sp.since) ? sp.since : "30d";
  const sinceMs = SINCE_PRESETS[sinceKey];
  const since = sinceMs === null ? undefined : new Date(Date.now() - sinceMs);

  const [initial, actors] = await Promise.all([
    listAuditTimeline(
      workspace.id,
      {
        sources: sources.length ? sources : undefined,
        actorUserId: actor,
        agentName: agent,
        since,
      },
      100,
    ),
    listAuditActors(workspace.id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          Audit
        </h1>
        <p className="text-foreground-weak text-base">
          Who changed what, when, and why across{" "}
          <span className="text-foreground font-medium">{workspace.name}</span>.
          Append-only — corrections appear as new events that reference the
          original.
        </p>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      <AuditTimeline
        workspaceSlug={slug}
        actors={actors}
        initial={initial.map(toLoadedAudit)}
        initialFilters={{
          sources,
          actor: actor ?? "",
          agent: agent ?? "",
          since: sinceKey,
        }}
      />
    </div>
  );
}

function parseMulti<T extends string>(
  raw: string | string[] | undefined,
  allowed: T[],
): T[] {
  if (!raw) return [];
  const list = Array.isArray(raw)
    ? raw
    : raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  const ok = new Set<string>(allowed);
  return list.filter((v): v is T => ok.has(v));
}

// Re-exported types so other server callers can use the same surface.
export type { AuditEntry, AuditSource };
