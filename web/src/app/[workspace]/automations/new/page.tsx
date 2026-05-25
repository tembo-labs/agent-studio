import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/workspace";
import { listAgents } from "@/lib/workspace-agents";

import { AutomationForm } from "../automation-form";

export const dynamic = "force-dynamic";

export default async function NewAutomationPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ agent?: string }>;
}) {
  const [{ workspace: slug }, { agent: prefillAgent }] = await Promise.all([
    params,
    searchParams,
  ]);

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const result = await listAgents(workspace.id);
  // Only valid, parsed agents can be scheduled — broken files can't
  // describe a runnable model.
  const agents = result.ok
    ? result.agents.filter((a) => a.ok).map((a) => ({ name: a.spec.name }))
    : [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <BackLink href={`/${slug}/automations`} label="Automations" />
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          New automation
        </h1>
        <p className="text-foreground-weak text-sm">
          Schedule an agent to run on a recurring cadence. The cron is
          interpreted in UTC; all displayed times use your local timezone.
        </p>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      <AutomationForm
        workspaceSlug={slug}
        agents={agents}
        defaults={prefillAgent ? { agentName: prefillAgent } : undefined}
        mode="create"
      />
    </div>
  );
}
