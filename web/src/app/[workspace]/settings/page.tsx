import Link from "next/link";
import { notFound } from "next/navigation";

import { LocalTime } from "@/components/local-time";
import { Section } from "@/components/section";
import { getPublicOrigin } from "@/lib/config";
import { getServerSession } from "@/lib/session";
import { listDeletedAgents } from "@/lib/workspace-agents";
import {
  getWorkspaceBySlug,
  getWorkspaceRepo,
  getWorkspaceRole,
  getWorkspaceSecretPreview,
  listWorkspaceMembers,
} from "@/lib/workspace";

import { ChangeModeSetting } from "./change-mode-setting";
import { DisconnectRepoForm } from "./disconnect-repo-form";
import { FaviconPicker } from "./favicon-picker";
import { MembersSection } from "./members-section";
import { RestoreAgentForm } from "./restore-agent-form";
import { SecretKeyForm } from "./secret-key-form";
import { SyncGuidanceForm } from "./sync-guidance-form";
import { ThemeSettings } from "./theme-settings";

// Per-user Composio Connections live at /<workspace>/connections —
// they're a personal action surface, not workspace config. The
// workspace-level Composio API key form below stays in Settings
// because it's a workspace credential like Tembo/Anthropic/OpenAI.
//
// Phase A's TAS-owned ConnectionsSection (./connections-section.tsx,
// ./disconnect-connection-form.tsx, lib/connections.ts, and the
// /api/connections/{slack,google} OAuth route handlers) is kept in
// the repo for the future "advanced mode" but intentionally not
// imported here — v0.3 ships only the Composio-backed basic mode.

export const dynamic = "force-dynamic";

export default async function SettingsPage({
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

  // Composio connections + the workspace's agents now live behind
  // their own route at /<workspace>/connections — no need to fetch
  // them on Settings anymore.
  const [
    temboPreview,
    anthropicPreview,
    openaiPreview,
    composioPreview,
    composioWebhookSecretPreview,
    repo,
    deletedAgents,
    members,
    currentUserRole,
  ] = await Promise.all([
    getWorkspaceSecretPreview(workspace.id, "tembo_api_key"),
    getWorkspaceSecretPreview(workspace.id, "anthropic_api_key"),
    getWorkspaceSecretPreview(workspace.id, "openai_api_key"),
    getWorkspaceSecretPreview(workspace.id, "composio_api_key"),
    getWorkspaceSecretPreview(workspace.id, "composio_webhook_secret"),
    getWorkspaceRepo(workspace.id),
    listDeletedAgents(workspace.id),
    listWorkspaceMembers(workspace.id),
    getWorkspaceRole(workspace.id, session.user.id),
  ]);
  // If the layout's membership check passed, role is non-null here.
  // notFound() is the right fallback in case of a race — same shape
  // the rest of the page uses for unexpected null state.
  if (!currentUserRole) notFound();
  const webhookUrl = `${getPublicOrigin()}/api/hooks/composio/${workspace.slug}`;
  // sp is currently unused on Settings — keep it as a typed
  // parameter so future ?banner=… style flows can land without
  // re-plumbing the page signature.
  void sp;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          Settings
        </h1>
        <p className="text-foreground-weak text-base">
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
              title="Theme"
              description="Pick a curated theme or roll your own. Changes are stored locally to your browser."
            >
              <ThemeSettings />
            </Section>
          </div>

        <div className="pb-5 pt-8">
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
                    <span className="text-foreground-muted text-sm">
                      Default branch {repo.defaultBranch} · connected{" "}
                      <LocalTime iso={repo.connectedAt.toISOString()} />
                    </span>
                  </div>
                  <DisconnectRepoForm workspaceSlug={workspace.slug} />
                </div>
              ) : (
                <p className="text-foreground-weak text-base">
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

        {repo && (
          <div className="pb-5 pt-8">
            <Section
              title="Agent guidance"
              description="Writes (or refreshes) agents/AGENTS.md and the per-framework AGENT_GUIDE.md files into the connected repo. These tell the Tembo Coding Agent how to write valid agent files. Safe to click repeatedly — it only commits when the files are missing or out of date."
            >
              <SyncGuidanceForm workspaceSlug={workspace.slug} />
            </Section>
          </div>
        )}

        <div className="pb-5 pt-8">
            <Section
              title="Improvements delivery"
              description="How edits from the Improve form ship to your repo. YOLO commits directly to the default branch and is coming in a later release."
            >
              <ChangeModeSetting />
            </Section>
          </div>

        <div className="pb-5 pt-8">
            <Section
              title="Composio API key"
              description={
                <>
                  Workspace-level credential for the{" "}
                  <Link
                    href={`/${workspace.slug}/connections`}
                    className="text-foreground underline underline-offset-2"
                  >
                    Connections
                  </Link>{" "}
                  page. Get one at{" "}
                  <a
                    href="https://dashboard.composio.dev"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-foreground underline underline-offset-2"
                  >
                    dashboard.composio.dev
                  </a>
                  .
                </>
              }
            >
              <SecretKeyForm
                workspaceSlug={workspace.slug}
                kind="composio_api_key"
                label="Composio API key"
                placeholder="ak_…"
                maskedPrefix="ak_"
                preview={
                  composioPreview
                    ? {
                        last4: composioPreview.last4,
                        updatedAt: composioPreview.updatedAt.toISOString(),
                      }
                    : null
                }
              />
            </Section>
          </div>

        <div className="pb-5 pt-8">
            <Section
              title="Composio webhook secret"
              description={
                <>
                  Signing secret for incoming Composio event webhooks.
                  Required for event-driven triggers. Set the webhook URL
                  to{" "}
                  <code className="bg-surface rounded px-1 py-0.5 text-xs">
                    {webhookUrl}
                  </code>{" "}
                  in your{" "}
                  <a
                    href="https://dashboard.composio.dev"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-foreground underline underline-offset-2"
                  >
                    Composio dashboard
                  </a>{" "}
                  and paste the secret it generates here.
                </>
              }
            >
              <SecretKeyForm
                workspaceSlug={workspace.slug}
                kind="composio_webhook_secret"
                label="Composio webhook secret"
                placeholder="whsec_…"
                maskedPrefix="••••"
                preview={
                  composioWebhookSecretPreview
                    ? {
                        last4: composioWebhookSecretPreview.last4,
                        updatedAt:
                          composioWebhookSecretPreview.updatedAt.toISOString(),
                      }
                    : null
                }
              />
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
              title="OpenAI API key"
              description={
                <>
                  Required to run agents whose{" "}
                  <code className="bg-surface rounded px-1 py-0.5 text-xs">
                    model
                  </code>{" "}
                  field is an OpenAI model (e.g.{" "}
                  <code className="bg-surface rounded px-1 py-0.5 text-xs">
                    openai:gpt-4o-mini
                  </code>
                  ).
                </>
              }
            >
              <SecretKeyForm
                workspaceSlug={workspace.slug}
                kind="openai_api_key"
                label="OpenAI API key"
                placeholder="sk-…"
                maskedPrefix="sk-"
                preview={
                  openaiPreview
                    ? {
                        last4: openaiPreview.last4,
                        updatedAt: openaiPreview.updatedAt.toISOString(),
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
            <MembersSection
              workspaceSlug={workspace.slug}
              members={members}
              currentUserRole={currentUserRole}
              currentUserId={session.user.id}
            />
          </div>

        <div className="pb-5 pt-8">
            <Section
              title="Deleted agents"
              description="Agents removed from this workspace stay listed here so you can restore them. Restore writes the file back to the connected repo with a new commit; the deletion record is preserved for audit."
            >
              {deletedAgents.length === 0 ? (
                <p className="text-foreground-weak text-base">
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
                        <span className="text-foreground-muted text-sm">
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
