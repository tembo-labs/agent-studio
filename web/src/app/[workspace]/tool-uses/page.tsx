import { notFound } from "next/navigation";

import {
  listAgentNamesWithRunsForWorkspace,
  listToolCallsForWorkspace,
  listToolNamesForWorkspace,
  type ToolCallOutcome,
} from "@/lib/runs-db";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/workspace";

import { toLoaded } from "./shape";
import { ToolUsesList } from "./tool-uses-list";

export const dynamic = "force-dynamic";

const VALID_OUTCOMES: ToolCallOutcome[] = ["ok", "failed", "no-result"];

export default async function ToolUsesPage({
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

  // Deep-link filters (e.g. ?tool=SLACK_SEND_MESSAGE&outcome=failed).
  const outcomes = parseMultiParam(sp.outcome, VALID_OUTCOMES);
  const agentName =
    typeof sp.agent === "string" ? sp.agent.trim() || undefined : undefined;
  const toolName =
    typeof sp.tool === "string" ? sp.tool.trim() || undefined : undefined;
  const search =
    typeof sp.q === "string" ? sp.q.slice(0, 200) || undefined : undefined;

  const [initial, agentNames, toolNames] = await Promise.all([
    listToolCallsForWorkspace(workspace.id, {
      agentName,
      toolName,
      outcomes: outcomes.length ? outcomes : undefined,
      search,
    }),
    listAgentNamesWithRunsForWorkspace(workspace.id),
    listToolNamesForWorkspace(workspace.id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          Tool uses
        </h1>
        <p className="text-foreground-weak text-base">
          Every tool an agent called in{" "}
          <span className="text-foreground font-medium">{workspace.name}</span>.
          Filter by outcome, agent, or tool, or search tool names and errors.
          Captured for Pydantic agents.
        </p>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      <ToolUsesList
        workspaceSlug={slug}
        agentNames={agentNames}
        toolNames={toolNames}
        initial={initial.map(toLoaded)}
        initialFilters={{
          agentName: agentName ?? "",
          toolName: toolName ?? "",
          outcomes,
          search: search ?? "",
        }}
      />
    </div>
  );
}

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
