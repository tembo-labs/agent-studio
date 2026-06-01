import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { FRAMEWORK_LABELS } from "@/lib/agent-framework";
import { scanImprovementsForPRs } from "@/lib/improvement-scan";
import { listPendingCreatesForWorkspace } from "@/lib/improvements-api";
import { meetsMinRole } from "@/lib/rbac";
import { listAgentSummaries30d } from "@/lib/runs-db";
import { getServerSession } from "@/lib/session";
import { listAgents } from "@/lib/workspace-agents";
import {
  getWorkspaceBySlug,
  getWorkspaceRepo,
  getWorkspaceRole,
  getWorkspaceSecretPreview,
} from "@/lib/workspace";

import { AgentsInventory, type InventoryAgent } from "./agents-inventory";

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

  const [apiKeyPreview, agentsResult, pendingStored, currentUserRole] =
    await Promise.all([
      getWorkspaceSecretPreview(workspace.id, "tembo_api_key"),
      listAgents(workspace.id),
      listPendingCreatesForWorkspace(workspace.id),
      getWorkspaceRole(workspace.id, session.user.id),
    ]);
  const canEdit = meetsMinRole(currentUserRole, "operator");

  const validNames = agentsResult.ok
    ? agentsResult.agents.filter((a) => a.ok).map((a) => a.spec.name)
    : [];
  const summaries = await listAgentSummaries30d(workspace.id, validNames);

  // Refresh pending creates' PR status (submitted → pr_opened → merged)
  // so the inventory reflects reality without a separate poll. The
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
  // drop the pending row so we don't double-render.
  const liveNames = new Set(validNames);

  const inventoryAgents: InventoryAgent[] = agentsResult.ok
    ? agentsResult.agents
        // Defensive filter against the GitHub fetch cache returning
        // a just-deleted file. ?deleted=<name> arrives via the post-
        // delete redirect (see deleteAgentAction); even if the next
        // listAgents call hasn't picked up the deletion yet, we hide
        // the row so the user gets immediate visual confirmation.
        .filter((a) =>
          deletedAgentName && a.ok ? a.spec.name !== deletedAgentName : true,
        )
        .map((a): InventoryAgent => {
          if (!a.ok) {
            return {
              kind: "invalid",
              path: a.path,
              filename: a.filename,
              error: a.error,
              detail: a.detail,
            };
          }
          const s = summaries.get(a.spec.name);
          return {
            kind: "live",
            path: a.path,
            filename: a.filename,
            name: a.spec.name,
            detailHref: `/${workspace.slug}/agents/${encodeURIComponent(a.spec.name)}`,
            frameworkLabel: FRAMEWORK_LABELS[a.spec.framework],
            model: a.spec.model ?? null,
            runs30d: s?.totalRuns30d ?? 0,
            succeeded30d: s?.succeeded30d ?? 0,
            failed30d: s?.failed30d ?? 0,
            lastRun:
              s?.lastRunStatus && s.lastRunAt
                ? {
                    status: s.lastRunStatus,
                    createdAtIso: s.lastRunAt.toISOString(),
                  }
                : null,
          };
        })
    : [];

  // Append pending creates so the inventory sees them. The default
  // sort surfaces them above idle agents (Pending sorts before Active
  // / Idle in STATUS_META).
  for (const p of pending) {
    if (liveNames.has(p.agentName)) continue;
    const framework = p.agentPath.startsWith("agents/cargo-ai/")
      ? "cargo-ai"
      : "pydantic-agentspec";
    inventoryAgents.push({
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
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
            <code className="bg-surface rounded px-1 py-0.5 text-sm">
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
          <p className="text-foreground-weak text-base">
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
        <AgentsInventory
          agents={inventoryAgents}
          newAgentHref={`/${workspace.slug}/agents/new`}
          canCreate={canEdit && Boolean(apiKeyPreview)}
        />
      )}
    </div>
  );
}
