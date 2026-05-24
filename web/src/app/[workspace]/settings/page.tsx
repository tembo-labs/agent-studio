import Link from "next/link";
import { notFound } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getInstanceName } from "@/lib/config";
import { getServerSession } from "@/lib/session";
import {
  getWorkspaceBySlug,
  getWorkspaceSecretPreview,
  userIsMember,
} from "@/lib/workspace";

import { TemboApiKeyForm } from "./tembo-api-key-form";

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

  const isMember = await userIsMember(workspace.id, session.user.id);
  if (!isMember) notFound();

  const preview = await getWorkspaceSecretPreview(
    workspace.id,
    "tembo_api_key",
  );
  const instanceName = getInstanceName();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-12 px-8 py-16">
      <header className="flex items-start justify-between gap-6">
        <div className="space-y-2">
          <p className="text-foreground-weak text-xs font-medium uppercase tracking-widest">
            {instanceName}
          </p>
          <div className="flex items-baseline gap-3">
            <Link
              href={`/${workspace.slug}`}
              className="text-foreground-weak hover:text-foreground text-sm"
            >
              {workspace.name}
            </Link>
            <span className="text-foreground-muted text-sm">/</span>
            <h1 className="text-foreground-title text-3xl font-semibold tracking-tight">
              Settings
            </h1>
          </div>
          <p className="text-foreground-weak text-sm">
            Signed in as{" "}
            <span className="text-foreground font-medium">
              {session.user.email}
            </span>
          </p>
        </div>
        <SignOutButton />
      </header>

      <Card className="p-3">
        <CardHeader className="flex-col items-start gap-1 px-1 pb-3 pt-1">
          <CardTitle className="text-foreground-title text-base">
            Tembo API key
          </CardTitle>
          <CardDescription>
            Used by this workspace to invoke Tembo services. Scoped to{" "}
            <span className="text-foreground font-medium">
              {workspace.name}
            </span>{" "}
            only — not shared with other workspaces.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-1 pb-1">
          <TemboApiKeyForm
            workspaceSlug={workspace.slug}
            preview={
              preview
                ? {
                    last4: preview.last4,
                    updatedAt: preview.updatedAt.toISOString(),
                  }
                : null
            }
          />
        </CardContent>
      </Card>
    </main>
  );
}
