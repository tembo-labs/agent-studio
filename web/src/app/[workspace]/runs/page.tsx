import { notFound } from "next/navigation";

import {
  listAgentNamesWithRunsForWorkspace,
  listRunsForWorkspace,
  type RunSummary,
  type RunTrigger,
} from "@/lib/runs-db";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/workspace";

import { RunsList } from "./runs-list";
import { toLoaded } from "./shape";

export const dynamic = "force-dynamic";

const VALID_STATUSES: RunSummary["status"][] = [
  "queued",
  "running",
  "succeeded",
  "failed",
];
const VALID_TRIGGERS: RunTrigger[] = ["manual", "schedule", "event"];

export default async function RunsPage({
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

  // Read filters from URL search params so deep links (e.g. from a
  // failed-run "find similar" affordance) land prefiltered. Validate
  // each value against the canonical list so a malformed URL just
  // gets ignored rather than throwing.
  const statuses = parseMultiParam(sp.status, VALID_STATUSES);
  const triggers = parseMultiParam(sp.trigger, VALID_TRIGGERS);
  const agentName =
    typeof sp.agent === "string" ? sp.agent.trim() || undefined : undefined;
  const search =
    typeof sp.q === "string" ? sp.q.slice(0, 200) || undefined : undefined;

  // Initial render is server-side with filters already applied so
  // the first paint matches the URL. The client component takes over
  // on subsequent filter or pagination changes.
  const [initial, agentNames] = await Promise.all([
    listRunsForWorkspace(workspace.id, {
      statuses: statuses.length ? statuses : undefined,
      triggers: triggers.length ? triggers : undefined,
      agentName,
      search,
    }),
    listAgentNamesWithRunsForWorkspace(workspace.id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          Runs
        </h1>
        <p className="text-foreground-weak text-sm">
          Every agent run in{" "}
          <span className="text-foreground font-medium">{workspace.name}</span>
          . Filter by status, agent, or trigger, or search across input,
          output, and error messages.
        </p>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      <RunsList
        workspaceSlug={slug}
        agentNames={agentNames}
        initial={initial.map(toLoaded)}
        initialFilters={{
          statuses,
          triggers,
          agentName: agentName ?? "",
          search: search ?? "",
        }}
      />
    </div>
  );
}

// Accept either ?status=failed or ?status=failed&status=running. String
// inputs split on comma so &status=failed,running also works for
// hand-typed URLs. Unknown values silently dropped.
function parseMultiParam<T extends string>(
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
  const allowedSet = new Set<string>(allowed);
  return list.filter((v): v is T => allowedSet.has(v));
}
