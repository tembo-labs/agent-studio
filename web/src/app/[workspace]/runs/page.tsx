import { notFound } from "next/navigation";

import {
  listAgentNamesWithRunsForWorkspace,
  listRunsForWorkspace,
} from "@/lib/runs-db";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/workspace";

import { RunsList } from "./runs-list";
import { toLoaded } from "./shape";

export const dynamic = "force-dynamic";

export default async function RunsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  // Initial unfiltered page renders server-side so the first paint
  // isn't a spinner. The client component takes over on filter or
  // pagination changes.
  const [initial, agentNames] = await Promise.all([
    listRunsForWorkspace(workspace.id, {}),
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
          . Filter by status, agent, or trigger, or search input + output.
        </p>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      <RunsList
        workspaceSlug={slug}
        agentNames={agentNames}
        initial={initial.map(toLoaded)}
      />
    </div>
  );
}
