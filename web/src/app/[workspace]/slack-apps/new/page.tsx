import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { getServerSession } from "@/lib/session";
import {
  getWorkspaceBySlug,
  getWorkspaceRole,
  listWorkspaceMembers,
} from "@/lib/workspace";

import { toMemberOptions } from "../manifest";
import { NewSlackAppForm } from "./new-slack-app-form";

export const dynamic = "force-dynamic";

export default async function NewSlackAppPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const session = await getServerSession();
  if (!session) notFound();
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const role = await getWorkspaceRole(workspace.id, session.user.id);
  if (role !== "workspace_admin") notFound();

  const members = toMemberOptions(await listWorkspaceMembers(workspace.id));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <BackLink href={`/${workspace.slug}/slack-apps`} label="Slack apps" />
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          New Slack app
        </h1>
        <p className="text-foreground-weak text-base">
          Each app is its own Slack bot with its own identity, install, and agent
          scope. Name it for the team it serves, pick a default owner, and list
          the agent labels it may launch. You&apos;ll finish setup (manifest,
          credentials, install) on the next screen.
        </p>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      <NewSlackAppForm workspaceSlug={workspace.slug} members={members} />
    </div>
  );
}
