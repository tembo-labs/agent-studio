import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { toolkitLabel } from "@/lib/composio-label";
import type { McpTool } from "@/lib/mcp-tools";
import { listToolsForUser, listToolsForWorkspace } from "@/lib/mcp-tools";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug, getWorkspaceRole } from "@/lib/workspace";

import { CopyableSlug } from "../copyable-slug";

export const dynamic = "force-dynamic";

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>;
}) {
  const { workspace: slug, id } = await params;

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const role = await getWorkspaceRole(workspace.id, session.user.id);
  const isAdmin = role === "workspace_admin";
  const tools = isAdmin
    ? await listToolsForWorkspace(workspace.id)
    : await listToolsForUser(workspace.id, session.user.id);

  const tool = tools.find((t) => t.id === id);
  if (!tool) notFound();

  const providerLabel =
    tool.source === "composio" ? toolkitLabel(tool.provider) : tool.provider;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <Link
          href={`/${workspace.slug}/tools`}
          className="text-foreground-weak hover:text-foreground text-sm underline underline-offset-2"
        >
          ← Back to Tools
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        <CopyableSlug
          slug={tool.slug}
          className="text-foreground break-all text-xl font-semibold"
        />
        {tool.displayName && tool.displayName !== tool.slug && (
          <p className="text-foreground-weak text-base">{tool.displayName}</p>
        )}
      </div>

      <div className="flex flex-wrap items-baseline gap-2">
        <Badge variant={tool.source === "composio" ? "blue" : "gray"} size="small">
          {tool.source === "composio" ? "Composio" : "Native MCP"}
        </Badge>
        <span className="text-foreground-weak text-sm">{providerLabel}</span>
        <code className="text-foreground-muted text-sm">
          · {tool.connectionName}
        </code>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      {tool.description ? (
        <div className="flex flex-col gap-1">
          <div className="text-foreground-weak text-sm font-medium uppercase tracking-widest">
            Description
          </div>
          <p className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">
            {tool.description}
          </p>
        </div>
      ) : (
        <p className="text-foreground-weak text-sm">
          No description provided by the upstream catalog.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <div className="text-foreground-weak text-sm font-medium uppercase tracking-widest">
          Use this tool in an agent
        </div>
        <pre className="bg-surface-secondary text-foreground overflow-x-auto rounded-md p-3 text-sm leading-relaxed">
          {snippetFor(tool)}
        </pre>
        <p className="text-foreground-weak text-sm">
          Paste into the agent&apos;s{" "}
          <code className="bg-surface rounded px-1 py-0.5 text-sm">
            connections:
          </code>{" "}
          list. The slug is verbatim — copy from above if you need it elsewhere.
        </p>
      </div>
    </div>
  );
}

function snippetFor(tool: McpTool): string {
  if (tool.source === "native-mcp") {
    return `connections:
  - { type: ${tool.provider}, source: native-mcp, name: ${tool.connectionName}, tools: [${tool.slug}] }`;
  }
  return `connections:
  - ${tool.provider}:
      name: ${tool.connectionName}
      tools: [${tool.slug}]`;
}
