import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { getServerSession } from "@/lib/session";
import { getSlackApp } from "@/lib/slack-apps";
import {
  getWorkspaceBySlug,
  getWorkspaceRole,
  listWorkspaceMembers,
} from "@/lib/workspace";

import { toMemberOptions } from "../../manifest";
import { EditSlackAppForm } from "./edit-slack-app-form";

export const dynamic = "force-dynamic";

export default async function EditSlackAppPage({
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
  if (role !== "workspace_admin") notFound();

  const app = await getSlackApp(workspace.id, id);
  if (!app) notFound();
  const members = toMemberOptions(await listWorkspaceMembers(workspace.id));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <BackLink
          href={`/${workspace.slug}/slack-apps/${app.id}`}
          label={app.name}
        />
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          Edit {app.name}
        </h1>
        <p className="text-foreground-weak text-base">
          Credentials come from the Slack app&apos;s{" "}
          <span className="text-foreground font-medium">Basic Information</span>{" "}
          page. Secrets left blank stay unchanged.
        </p>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      <EditSlackAppForm
        workspaceSlug={workspace.slug}
        app={app}
        members={members}
      />
    </div>
  );
}
