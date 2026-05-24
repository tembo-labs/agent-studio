import { notFound, redirect } from "next/navigation";

import { Section } from "@/components/section";
import { TopBar } from "@/components/top-bar";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug, getWorkspaceRepo } from "@/lib/workspace";

import { NewAgentForm } from "./new-agent-form";

export const dynamic = "force-dynamic";

export default async function NewAgentPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const repo = await getWorkspaceRepo(workspace.id);
  if (!repo) {
    redirect(`/onboarding/repo?ws=${encodeURIComponent(workspace.slug)}`);
  }

  return (
    <>
      <TopBar
        back={{ href: `/${workspace.slug}` }}
        crumbs={[{ label: "Agents", href: `/${workspace.slug}` }]}
        title="New agent"
        meta={
          <>
            Will commit to{" "}
            <span className="text-foreground font-medium">
              github.com/{repo.owner}/{repo.name}
            </span>{" "}
            on{" "}
            <code className="bg-surface rounded px-1 py-0.5 text-[10px]">
              {repo.defaultBranch}
            </code>
          </>
        }
      />

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-6">
        <Section
          title="Create an agent"
          description="Pick a starter template (Pydantic AgentSpec or Cargo AI), or paste your own definition."
        >
          <NewAgentForm workspaceSlug={workspace.slug} />
        </Section>
      </div>
    </>
  );
}
