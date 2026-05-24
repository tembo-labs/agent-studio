import Link from "next/link";
import { notFound } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import { getInstanceName } from "@/lib/config";
import { getServerSession } from "@/lib/session";
import {
  getWorkspaceBySlug,
  getWorkspaceSecretPreview,
  userIsMember,
} from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({
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

  const [apiKeyPreview] = await Promise.all([
    getWorkspaceSecretPreview(workspace.id, "tembo_api_key"),
  ]);
  const instanceName = getInstanceName();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-12 px-8 py-16">
      <header className="flex items-start justify-between gap-6">
        <div className="space-y-2">
          <p className="text-foreground-weak text-xs font-medium uppercase tracking-widest">
            {instanceName}
          </p>
          <h1 className="text-foreground-title text-3xl font-semibold tracking-tight">
            {workspace.name}
          </h1>
          <p className="text-foreground-weak text-sm">
            Signed in as{" "}
            <span className="text-foreground font-medium">
              {session.user.email}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${workspace.slug}/settings`}
            className="text-foreground-weak hover:text-foreground text-sm"
          >
            Settings
          </Link>
          <SignOutButton />
        </div>
      </header>

      {!apiKeyPreview && (
        <section className="bg-surface-raised border-border flex flex-col gap-2 rounded-lg border p-4">
          <h2 className="text-foreground text-sm font-medium">
            Add your Tembo API key
          </h2>
          <p className="text-foreground-weak text-sm">
            TAS needs a Tembo API key to invoke Tembo services on this
            workspace&apos;s behalf. Until it&apos;s set, agents can&apos;t run.
          </p>
          <div>
            <Link
              href={`/${workspace.slug}/settings`}
              className="text-foreground hover:underline text-sm font-medium"
            >
              Add it in Settings →
            </Link>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-foreground-weak text-sm font-medium uppercase tracking-wider">
          Agents
        </h2>
        <div className="bg-surface-raised border-border text-foreground-weak rounded-lg border p-8 text-center text-sm">
          No agents yet. Repo wiring + agent creation land in the next slice.
        </div>
      </section>
    </main>
  );
}
