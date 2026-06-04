import { notFound } from "next/navigation";

import { Section } from "@/components/section";
import { getPublicOrigin } from "@/lib/config";
import { getServerSession } from "@/lib/session";
import { listSlackApps } from "@/lib/slack-apps";
import {
  getWorkspaceBySlug,
  getWorkspaceRole,
  listWorkspaceMembers,
} from "@/lib/workspace";

import { SlackAppsManager } from "./slack-apps-manager";

export const dynamic = "force-dynamic";

// Slack apps: TAS-managed bots that launch a label-scoped subset of this
// workspace's agents from Slack (slash command + picker). Admin-only —
// each app holds credentials and an install. Setup is "coach the admin":
// the page hands them a manifest + request URLs to create the Slack app,
// then "Add to Slack" completes the OAuth install.
export default async function SlackSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ slack?: string; detail?: string }>;
}) {
  const { workspace: slug } = await params;
  const { slack: installResult, detail: installDetail } = await searchParams;
  const session = await getServerSession();
  if (!session) notFound();
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const role = await getWorkspaceRole(workspace.id, session.user.id);
  if (role !== "workspace_admin") {
    return (
      <Section
        title="Slack apps"
        description="Launch agents from Slack via a TAS-managed bot."
      >
        <p className="text-foreground-weak text-sm">
          Only workspace admins can manage Slack apps.
        </p>
      </Section>
    );
  }

  const [apps, members] = await Promise.all([
    listSlackApps(workspace.id),
    listWorkspaceMembers(workspace.id),
  ]);

  // Disambiguate the owner picker: append the email only when a display
  // name is shared by more than one member (so two "John Smith"s are
  // distinguishable); otherwise just the name, or the email when unnamed.
  const nameCounts = new Map<string, number>();
  for (const m of members) {
    if (m.name) nameCounts.set(m.name, (nameCounts.get(m.name) ?? 0) + 1);
  }
  const memberOptions = members.map((m) => ({
    userId: m.userId,
    label: m.name
      ? (nameCounts.get(m.name) ?? 0) > 1
        ? `${m.name} (${m.email})`
        : m.name
      : m.email,
  }));

  return (
    <div className="flex flex-col gap-4">
      {installResult === "installed" && (
        <div className="border-sentiment-positive rounded-lg border bg-[var(--color-sentiment-positive-subtle)] px-3 py-2 text-sm">
          <span className="text-foreground">Slack app installed.</span>
        </div>
      )}
      {installResult === "error" && (
        <div className="border-sentiment-negative rounded-lg border bg-[var(--color-input-error)] px-3 py-2 text-sm">
          <span className="text-foreground">
            Install failed{installDetail ? `: ${installDetail}` : "."}
          </span>
        </div>
      )}
      <SlackAppsManager
        workspaceSlug={workspace.slug}
        origin={getPublicOrigin()}
        apps={apps}
        members={memberOptions}
      />
    </div>
  );
}
