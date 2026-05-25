import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getServerSession } from "@/lib/session";
import {
  getWorkspaceBySlug,
  listWorkspacesForUser,
  userIsMember,
} from "@/lib/workspace";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspace: string }>;
}): Promise<Metadata> {
  const { workspace: slug } = await params;
  // Point at our favicon route handler — the handler resolves the
  // workspace's chosen default or streams the custom blob. We deliberately
  // don't await getWorkspaceBySlug here just to read favicon_kind because
  // the handler does that for itself; this keeps metadata generation fast.
  const href = `/api/workspaces/${encodeURIComponent(slug)}/favicon`;
  return {
    icons: { icon: href, shortcut: href, apple: href },
  };
}

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const isMember = await userIsMember(workspace.id, session.user.id);
  if (!isMember) notFound();

  const workspaces = await listWorkspacesForUser(session.user.id);
  const switcherList = workspaces.map((w) => ({ slug: w.slug, name: w.name }));

  return (
    <AppShell
      workspace={workspace}
      workspaces={switcherList}
      user={session.user}
    >
      {children}
    </AppShell>
  );
}
