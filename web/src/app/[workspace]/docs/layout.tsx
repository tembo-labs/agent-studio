import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { getAppVersion } from "@/lib/config";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug, userIsMember } from "@/lib/workspace";

import { DocsNav } from "./docs-nav";

// In-app documentation shell — the published user manual, bundled with the app
// so it matches the running version exactly. Two-column layout like Settings /
// Connections; the audience-split nav lives on the left.
export default async function DocsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;

  const session = await getServerSession();
  if (!session) notFound();
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  if (!(await userIsMember(workspace.id, session.user.id))) notFound();

  const version = getAppVersion();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          Documentation
        </h1>
        <span className="text-foreground-muted text-sm">
          {version ? `Matches your running version ${version}` : "User manual"}
        </span>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-10">
        <DocsNav workspaceSlug={workspace.slug} />
        <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
      </div>
    </div>
  );
}
