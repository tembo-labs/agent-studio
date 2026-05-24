import Link from "next/link";
import { notFound } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getInstanceName } from "@/lib/config";
import { getServerSession } from "@/lib/session";
import { listDeletedAgents } from "@/lib/workspace-agents";
import {
  getWorkspaceBySlug,
  getWorkspaceRepo,
  getWorkspaceSecretPreview,
  userIsMember,
} from "@/lib/workspace";

import { DisconnectRepoForm } from "./disconnect-repo-form";
import { RestoreAgentForm } from "./restore-agent-form";
import { TemboApiKeyForm } from "./tembo-api-key-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const isMember = await userIsMember(workspace.id, session.user.id);
  if (!isMember) notFound();

  const [preview, repo, deletedAgents] = await Promise.all([
    getWorkspaceSecretPreview(workspace.id, "tembo_api_key"),
    getWorkspaceRepo(workspace.id),
    listDeletedAgents(workspace.id),
  ]);
  const instanceName = getInstanceName();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-8 py-16">
      <header className="flex items-start justify-between gap-6">
        <div className="space-y-2">
          <p className="text-foreground-weak text-xs font-medium uppercase tracking-widest">
            {instanceName}
          </p>
          <div className="flex items-baseline gap-3">
            <Link
              href={`/${workspace.slug}`}
              className="text-foreground-weak hover:text-foreground text-sm"
            >
              {workspace.name}
            </Link>
            <span className="text-foreground-muted text-sm">/</span>
            <h1 className="text-foreground-title text-3xl font-semibold tracking-tight">
              Settings
            </h1>
          </div>
          <p className="text-foreground-weak text-sm">
            Signed in as{" "}
            <span className="text-foreground font-medium">
              {session.user.email}
            </span>
          </p>
        </div>
        <SignOutButton />
      </header>

      <Card className="p-3">
        <CardHeader className="flex-col items-start gap-1 px-1 pb-3 pt-1">
          <CardTitle className="text-foreground-title text-base">
            GitHub repository
          </CardTitle>
          <CardDescription>
            The repo where this workspace&apos;s agent definitions live.
            Disconnecting drops the stored token and returns the workspace to
            the onboarding repo step.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-1 pb-1">
          {repo ? (
            <div className="bg-surface border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <div className="flex flex-col">
                <a
                  href={`https://github.com/${repo.owner}/${repo.name}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-foreground text-sm font-medium hover:underline"
                >
                  github.com/{repo.owner}/{repo.name}
                </a>
                <span className="text-foreground-muted text-xs">
                  Default branch {repo.defaultBranch} · connected{" "}
                  {formatDate(repo.connectedAt)}
                </span>
              </div>
              <DisconnectRepoForm workspaceSlug={workspace.slug} />
            </div>
          ) : (
            <p className="text-foreground-weak text-sm">
              No repository connected.{" "}
              <Link
                href={`/onboarding/repo?ws=${encodeURIComponent(workspace.slug)}`}
                className="text-foreground hover:underline"
              >
                Connect one now →
              </Link>
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="p-3">
        <CardHeader className="flex-col items-start gap-1 px-1 pb-3 pt-1">
          <CardTitle className="text-foreground-title text-base">
            Deleted agents
          </CardTitle>
          <CardDescription>
            Agents removed from{" "}
            <span className="text-foreground font-medium">
              {workspace.name}
            </span>{" "}
            stay listed here so you can restore them. Restore writes the file
            back to the connected repo with a new commit; the deletion record
            is preserved for audit.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-1 pb-1">
          {deletedAgents.length === 0 ? (
            <p className="text-foreground-weak text-sm">
              No deleted agents.
            </p>
          ) : (
            <ul className="divide-border flex flex-col divide-y">
              {deletedAgents.map((d) => (
                <li
                  key={d.id}
                  className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-col">
                    <span className="text-foreground text-sm font-medium">
                      {d.agentName}
                    </span>
                    <span className="text-foreground-muted text-xs">
                      <code>{d.filePath}</code>
                      <span> · deleted {formatDate(d.deletedAt)}</span>
                    </span>
                  </div>
                  <RestoreAgentForm
                    workspaceSlug={workspace.slug}
                    deletionId={d.id}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="p-3">
        <CardHeader className="flex-col items-start gap-1 px-1 pb-3 pt-1">
          <CardTitle className="text-foreground-title text-base">
            Tembo API key
          </CardTitle>
          <CardDescription>
            Used by this workspace to invoke Tembo services. Scoped to{" "}
            <span className="text-foreground font-medium">
              {workspace.name}
            </span>{" "}
            only — not shared with other workspaces.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-1 pb-1">
          <TemboApiKeyForm
            workspaceSlug={workspace.slug}
            preview={
              preview
                ? {
                    last4: preview.last4,
                    updatedAt: preview.updatedAt.toISOString(),
                  }
                : null
            }
          />
        </CardContent>
      </Card>
    </main>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
