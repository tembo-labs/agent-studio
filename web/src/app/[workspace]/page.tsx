import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { FRAMEWORK_LABELS } from "@/lib/agent-framework";
import { scanImprovementsForPRs } from "@/lib/improvement-scan";
import { listPendingCreatesForWorkspace } from "@/lib/improvements-api";
import { getLatestRunPerAgent } from "@/lib/runs-db";
import { getServerSession } from "@/lib/session";
import { listAgents } from "@/lib/workspace-agents";
import {
  getWorkspaceBySlug,
  getWorkspaceRepo,
  getWorkspaceSecretPreview,
} from "@/lib/workspace";

import { AgentsGrid, type GridAgent } from "./agents-grid";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspace: slug } = await params;
  const sp = await searchParams;
  const deletedAgentName =
    typeof sp.deleted === "string" ? sp.deleted : null;

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const repo = await getWorkspaceRepo(workspace.id);
  if (!repo) {
    redirect(`/onboarding/repo?ws=${encodeURIComponent(workspace.slug)}`);
  }

  const [apiKeyPreview, agentsResult, pendingStored] = await Promise.all([
    getWorkspaceSecretPreview(workspace.id, "tembo_api_key"),
    listAgents(workspace.id),
    listPendingCreatesForWorkspace(workspace.id),
  ]);

  const validNames = agentsResult.ok
    ? agentsResult.agents.filter((a) => a.ok).map((a) => a.spec.name)
    : [];
  const latestRuns = await getLatestRunPerAgent(workspace.id, validNames);

  // Refresh pending creates' PR status (submitted → pr_opened → merged)
  // so the pending cards reflect reality without a separate poll. The
  // scanner writes back to postgres, so the in-memory array is stale
  // — re-derive `pending` from the scanner's return value and then
  // drop rows that have moved past the non-terminal window.
  const pendingScanned = await scanImprovementsForPRs(
    workspace.id,
    pendingStored,
  );
  const pending = pendingScanned.filter(
    (p) => p.status === "submitted" || p.status === "pr_opened",
  );

  // Live agents have names sourced from the parsed spec. If a pending
  // create's intended name already matches a live agent — meaning the
  // PR merged and the file landed before we caught the status change —
  // drop the pending card so we don't double-render. The scanner above
  // catches most of these; this is the belt-and-suspenders.
  const liveNames = new Set(validNames);

  const gridAgents: GridAgent[] = agentsResult.ok
    ? agentsResult.agents
        // Defensive filter against the GitHub fetch cache returning
        // a just-deleted file. ?deleted=<name> arrives via the post-
        // delete redirect (see deleteAgentAction); even if the next
        // listAgents call hasn't picked up the deletion yet, we hide
        // the row so the user gets immediate visual confirmation.
        .filter((a) =>
          deletedAgentName && a.ok ? a.spec.name !== deletedAgentName : true,
        )
        .map((a): GridAgent => {
          if (!a.ok) {
            return {
              ok: false,
              path: a.path,
              filename: a.filename,
              error: a.error,
              detail: a.detail,
            };
          }
          const lastRun = latestRuns.get(a.spec.name) ?? null;
          return {
            ok: true,
            path: a.path,
            filename: a.filename,
            name: a.spec.name,
            frameworkLabel: FRAMEWORK_LABELS[a.spec.framework],
            model: a.spec.model ?? null,
            detailHref: `/${workspace.slug}/agents/${encodeURIComponent(a.spec.name)}`,
            lastRun: lastRun
              ? {
                  status: lastRun.status,
                  createdAtIso: lastRun.createdAt.toISOString(),
                }
              : null,
          };
        })
    : [];

  // Prepend pending creates so they appear at the start of the grid —
  // they're the freshest signal in the workspace.
  for (const p of pending) {
    if (liveNames.has(p.agentName)) continue;
    const framework = p.agentPath.startsWith("agents/cargo-ai/")
      ? "cargo-ai"
      : "pydantic-agentspec";
    gridAgents.unshift({
      kind: "pending-create",
      key: p.id,
      name: p.agentName,
      path: p.agentPath,
      frameworkLabel: FRAMEWORK_LABELS[framework],
      createdAtIso: p.createdAt.toISOString(),
      status: p.status === "pr_opened" ? "pr_opened" : "submitted",
      temboTaskHtmlUrl: p.temboTaskHtmlUrl,
      prUrl: p.prUrl,
      prNumber: p.prNumber,
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          Agents
        </h1>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      {deletedAgentName && (
        <div className="border-sentiment-positive bg-[var(--color-sentiment-positive-subtle)] rounded-lg border px-3 py-2 text-sm">
          <span className="text-foreground">
            Deleted{" "}
            <code className="bg-surface rounded px-1 py-0.5 text-xs">
              {deletedAgentName}
            </code>
            . The file&apos;s gone from the repo; restore it from{" "}
            <Link
              href={`/${workspace.slug}/settings`}
              className="text-foreground underline underline-offset-2"
            >
              Settings → Deleted agents
            </Link>{" "}
            if you change your mind.
          </span>
        </div>
      )}

      {!apiKeyPreview && (
        <div className="bg-surface-raised border-border flex flex-col gap-2 rounded-lg border p-4">
          <h2 className="text-foreground text-sm font-medium">
            Add your Tembo API key
          </h2>
          <p className="text-foreground-weak text-sm">
            TAS needs a Tembo API key to invoke Tembo services on this
            workspace&apos;s behalf. Until it&apos;s set, agents can&apos;t run.
          </p>
          <div>
            <Link
              href={`/${workspace.slug}/settings`}
              className="text-foreground hover:underline text-sm font-medium"
            >
              Add it in Settings →
            </Link>
          </div>
        </div>
      )}

      {!agentsResult.ok ? (
        <div className="text-sentiment-negative text-sm">
          Couldn&apos;t list agents: {agentsResult.error}
          {agentsResult.detail ? ` — ${agentsResult.detail}` : ""}
        </div>
      ) : (
        <AgentsGrid
          agents={gridAgents}
          newAgentHref={`/${workspace.slug}/agents/new`}
        />
      )}
    </div>
  );
}
