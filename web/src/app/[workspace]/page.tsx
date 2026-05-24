import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { IconPlusLarge } from "central-icons";

import { Section } from "@/components/section";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { FRAMEWORK_LABELS } from "@/lib/agent-framework";
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
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const repo = await getWorkspaceRepo(workspace.id);
  if (!repo) {
    redirect(`/onboarding/repo?ws=${encodeURIComponent(workspace.slug)}`);
  }

  const [apiKeyPreview, agentsResult] = await Promise.all([
    getWorkspaceSecretPreview(workspace.id, "tembo_api_key"),
    listAgents(workspace.id),
  ]);

  // Latest run per agent, one round-trip. Only fetch for valid agents
  // — invalid files don't have a stable name to key on.
  const validNames = agentsResult.ok
    ? agentsResult.agents.filter((a) => a.ok).map((a) => a.spec.name)
    : [];
  const latestRuns = await getLatestRunPerAgent(workspace.id, validNames);

  const gridAgents: GridAgent[] = agentsResult.ok
    ? agentsResult.agents.map((a): GridAgent => {
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
            ? { status: lastRun.status, createdAtIso: lastRun.createdAt.toISOString() }
            : null,
        };
      })
    : [];

  return (
    <>
      <TopBar
        title="Agents"
        meta={
          <>
            <a
              href={`https://github.com/${repo.owner}/${repo.name}`}
              target="_blank"
              rel="noreferrer noopener"
              className="hover:underline"
            >
              github.com/{repo.owner}/{repo.name}
            </a>
            <span className="text-foreground-muted"> · </span>
            <span>default branch {repo.defaultBranch}</span>
          </>
        }
        actions={
          <Button asChild>
            <Link href={`/${workspace.slug}/agents/new`}>
              <IconPlusLarge />
              <span>New agent</span>
            </Link>
          </Button>
        }
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-6">
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
          <Section title="Agents">
            <div className="text-sentiment-negative text-sm">
              Couldn&apos;t list agents: {agentsResult.error}
              {agentsResult.detail ? ` — ${agentsResult.detail}` : ""}
            </div>
          </Section>
        ) : (
          <Section title="Agents">
            <AgentsGrid agents={gridAgents} />
          </Section>
        )}
      </div>
    </>
  );
}
