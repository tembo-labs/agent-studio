import "server-only";

import { notFound, redirect } from "next/navigation";

import { getServerSession } from "@/lib/session";
import { getAgentByName, type ListedAgent } from "@/lib/workspace-agents";
import { getWorkspaceBySlug, getWorkspaceRepo } from "@/lib/workspace";
import { type Workspace } from "@/lib/workspace";

// Shared resolver for the agent layout + each tab page. Centralizes the
// session / workspace / repo / agent lookups (and the notFound/redirect gates)
// so every route in agents/[agent]/** does it the same cheap way — getAgentByName
// is backed by the GitHub readFile/listAgents cache, so repeated calls within a
// navigation are cheap.

export type AgentPageContext = {
  session: NonNullable<Awaited<ReturnType<typeof getServerSession>>>;
  workspace: Workspace;
  repo: NonNullable<Awaited<ReturnType<typeof getWorkspaceRepo>>>;
  agent: ListedAgent;
  raw: string;
  toolsModuleContent: string | undefined;
  /** The agent's declared name (falls back to the URL param for invalid files). */
  canonicalName: string;
};

export async function loadAgentContext(
  slug: string,
  agentName: string,
): Promise<AgentPageContext> {
  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const repo = await getWorkspaceRepo(workspace.id);
  if (!repo) {
    redirect(`/onboarding/repo?ws=${encodeURIComponent(workspace.slug)}`);
  }

  const result = await getAgentByName(workspace.id, agentName);
  if (!result) notFound();

  const { agent, raw, toolsModuleContent } = result;
  const canonicalName = agent.ok ? agent.spec.name : agentName;

  return {
    session,
    workspace,
    repo,
    agent,
    raw,
    toolsModuleContent,
    canonicalName,
  };
}
