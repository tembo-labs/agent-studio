import { notFound } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import { getApiHealth } from "@/lib/api";
import { getInstanceName } from "@/lib/config";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug, userIsMember } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;

  const session = await getServerSession();
  if (!session) {
    // Unauthenticated visitor — let the root page render the login screen
    // rather than leaking the existence of the workspace.
    notFound();
  }

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    notFound();
  }

  const isMember = await userIsMember(workspace.id, session.user.id);
  if (!isMember) {
    notFound();
  }

  const [health] = await Promise.all([getApiHealth()]);
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
        <SignOutButton />
      </header>

      <section className="space-y-3">
        <h2 className="text-foreground-weak text-sm font-medium uppercase tracking-wider">
          Agents
        </h2>
        <div className="bg-surface-raised border-border text-foreground-weak rounded-lg border p-8 text-center text-sm">
          No agents yet. Repo wiring + agent creation land in the next slice.
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-foreground-weak text-sm font-medium uppercase tracking-wider">
          API health
        </h2>
        <pre className="bg-surface-raised border-border text-foreground overflow-x-auto rounded-lg border p-4 text-sm leading-6">
          {JSON.stringify(health, null, 2)}
        </pre>
      </section>
    </main>
  );
}
