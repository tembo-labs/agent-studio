import { notFound } from "next/navigation";
import Link from "next/link";

import { IconPlusLarge } from "central-icons";

import { Button } from "@/components/ui/button";
import { listAutomations } from "@/lib/automations-api";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/workspace";

import { AutomationsShell } from "./automations-shell";
import { SchedulesList } from "./schedules-list";

export const dynamic = "force-dynamic";

export default async function AutomationsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const automations = await listAutomations(workspace.id);

  return (
    <AutomationsShell workspaceSlug={workspace.slug}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-foreground-title text-base font-bold">Schedules</h2>
        <Button asChild>
          <Link href={`/${slug}/automations/new`}>
            <IconPlusLarge size={16} />
            <span>New schedule</span>
          </Link>
        </Button>
      </div>
      <SchedulesList automations={automations} workspaceSlug={slug} />
    </AutomationsShell>
  );
}
