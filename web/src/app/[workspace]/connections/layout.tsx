import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug, userIsMember } from "@/lib/workspace";

import { ConnectionsNav } from "./connections-nav";

// Two-column connections shell — same shape as Settings. The
// workspace sidebar from [workspace]/layout.tsx still wraps the
// page; this nested layout adds the per-substrate left rail to the
// right of that sidebar. Sub-pages render into `children`.
//
// Membership check lands here so a stranger hitting
// /connections/composio directly hits the same notFound() as the
// workspace root. Per-action role gating stays at the server-action
// layer where it belongs.

export default async function ConnectionsLayout({
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          Connections
        </h1>
        <p className="text-foreground-weak text-base">
          OAuth authorizations the agents in{" "}
          <span className="text-foreground font-medium">{workspace.name}</span>{" "}
          can use at run time. Per-user — your authorizations don&apos;t
          show up for other workspace members.
        </p>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10">
        <ConnectionsNav workspaceSlug={workspace.slug} />
        <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
      </div>
    </div>
  );
}
