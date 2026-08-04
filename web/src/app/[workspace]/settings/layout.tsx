import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { emailPasswordEnabled } from "@/lib/auth-providers";
import { isInstanceAdmin as checkInstanceAdmin } from "@/lib/instance";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug, userIsMember } from "@/lib/workspace";

import { SettingsNav } from "./settings-nav";

// Two-column settings shell. The workspace sidebar from
// [workspace]/layout.tsx still wraps the page; this nested layout
// adds the per-section left rail on the right side of that
// sidebar. Sub-pages under settings/* render into `children`.
//
// Membership check lands here (rather than per-sub-page) so a
// stranger hitting a /settings/* sub-page directly hits the same
// notFound() as the workspace root. Workspace-admin gating for
// mutating actions stays at the server-action layer where it
// belongs.

export default async function SettingsLayout({
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

  const isInstanceAdmin = await checkInstanceAdmin(session.user.email);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          Workspace Settings
        </h1>
        <p className="text-foreground-weak text-base">
          Manage{" "}
          <span className="text-foreground font-medium">{workspace.name}</span>
          &apos;s repository, credentials, and branding.
        </p>
        {isInstanceAdmin && (
          <p className="text-foreground-weak text-sm">
            You&apos;re also authorized to edit{" "}
            <Link
              href="/settings"
              className="text-foreground font-medium underline underline-offset-2 hover:text-foreground-title"
            >
              Instance Settings
            </Link>
            .
          </p>
        )}
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10">
        <SettingsNav
          workspaceSlug={workspace.slug}
          showAccount={emailPasswordEnabled()}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-8">{children}</div>
      </div>
    </div>
  );
}
