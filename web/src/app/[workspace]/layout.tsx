import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug, userIsMember } from "@/lib/workspace";

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

  return (
    <AppShell workspace={workspace} user={session.user}>
      {children}
    </AppShell>
  );
}
