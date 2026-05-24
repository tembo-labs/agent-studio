import Link from "next/link";
import { notFound } from "next/navigation";

import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/section";
import { getServerSession } from "@/lib/session";
import { listDeletedAgents } from "@/lib/workspace-agents";
import {
  getWorkspaceBySlug,
  getWorkspaceRepo,
  getWorkspaceSecretPreview,
} from "@/lib/workspace";

import { DisconnectRepoForm } from "./disconnect-repo-form";
import { FaviconPicker } from "./favicon-picker";
import { RestoreAgentForm } from "./restore-agent-form";
import { SecretKeyForm } from "./secret-key-form";

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

  const [temboPreview, anthropicPreview, repo, deletedAgents] =
    await Promise.all([
      getWorkspaceSecretPreview(workspace.id, "tembo_api_key"),
      getWorkspaceSecretPreview(workspace.id, "anthropic_api_key"),
      getWorkspaceRepo(workspace.id),
      listDeletedAgents(workspace.id),
    ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          Settings
        </h1>
        <p className="text-foreground-weak text-sm">
          Manage{" "}
          <span className="text-foreground font-medium">{workspace.name}</span>
          &apos;s repository, credentials, and branding.
        </p>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      {/* Flat layout — hr dividers between sections, no card wrapper. */}
      <div className="divide-y divide-[var(--color-border-weak)]">
        <div className="pb-5 first:pt-0">
            <Section
              title="Favicon"
              description="Shown in the browser tab for everyone using this workspace. Pick a default or upload a custom image."
            >
              <FaviconPicker
                workspaceSlug={workspace.slug}
                currentKind={workspace.faviconKind}
                cacheKey={workspace.updatedAt.getTime().toString()}
              />
            </Section>
          </div>

        <div className="pb-5 pt-8">
            <Section
              title="GitHub repository"
              description="The repo where this workspace's agent definitions live. Disconnecting drops the stored token and returns the workspace to the onboarding repo step."
            >
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
                      <LocalTime iso={repo.connectedAt.toISOString()} />
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
            </Section>
          </div>

        <div className="pb-5 pt-8">
            <Section
              title="Anthropic API key"
              description={
                <>
                  Required to run agents whose{" "}
                  <code className="bg-surface rounded px-1 py-0.5 text-xs">
                    model
                  </code>{" "}
                  field is an Anthropic model (e.g.{" "}
                  <code className="bg-surface rounded px-1 py-0.5 text-xs">
                    anthropic:claude-sonnet-4-6
                  </code>
                  ).
                </>
              }
            >
              <SecretKeyForm
                workspaceSlug={workspace.slug}
                kind="anthropic_api_key"
                label="Anthropic API key"
                placeholder="sk-ant-…"
                maskedPrefix="sk-ant-"
                preview={
                  anthropicPreview
                    ? {
                        last4: anthropicPreview.last4,
                        updatedAt: anthropicPreview.updatedAt.toISOString(),
                      }
                    : null
                }
              />
            </Section>
          </div>

        <div className="pb-5 pt-8">
            <Section
              title="Tembo API key"
              description={
                <>
                  Used by this workspace to invoke Tembo services. Scoped to{" "}
                  <span className="text-foreground font-medium">
                    {workspace.name}
                  </span>{" "}
                  only — not shared with other workspaces.
                </>
              }
            >
              <SecretKeyForm
                workspaceSlug={workspace.slug}
                kind="tembo_api_key"
                label="Tembo API key"
                placeholder="tembo_pk_…"
                maskedPrefix="tembo_"
                preview={
                  temboPreview
                    ? {
                        last4: temboPreview.last4,
                        updatedAt: temboPreview.updatedAt.toISOString(),
                      }
                    : null
                }
              />
            </Section>
          </div>

        <div className="pb-5 pt-8">
            <Section
              title="Deleted agents"
              description="Agents removed from this workspace stay listed here so you can restore them. Restore writes the file back to the connected repo with a new commit; the deletion record is preserved for audit."
            >
              {deletedAgents.length === 0 ? (
                <p className="text-foreground-weak text-sm">
                  No deleted agents.
                </p>
              ) : (
                <ul className="divide-border flex flex-col divide-y border-y border-[var(--color-border)]">
                  {deletedAgents.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-start justify-between gap-3 py-2"
                    >
                      <div className="flex flex-col">
                        <span className="text-foreground text-sm font-medium">
                          {d.agentName}
                        </span>
                        <span className="text-foreground-muted text-xs">
                          <code>{d.filePath}</code>
                          <span>
                            {" · deleted "}
                            <LocalTime iso={d.deletedAt.toISOString()} />
                          </span>
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
            </Section>
        </div>
      </div>
    </div>
  );
}
