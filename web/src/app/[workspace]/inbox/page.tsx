import { notFound } from "next/navigation";

import { listInboxItems } from "@/lib/inbox-api";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/workspace";

import { InboxList, type InboxRow } from "./inbox-list";

export const dynamic = "force-dynamic";

// The Tasks Inbox: one queue humans and agents work. The table (search /
// filter / sort) is a client component; the same slicing is available to agents
// via the list_inbox_items MCP tool + GET /api/v1/inbox.

export default async function InboxPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  // Fetch the whole queue (single-tenant volumes are small); the client table
  // facets/filters/sorts in place. Default view shows active items.
  const items = await listInboxItems(workspace.id, {}, 1000);
  const rows: InboxRow[] = items.map((i) => ({
    id: i.id,
    title: i.title,
    source: i.source,
    itemType: i.itemType,
    status: i.status,
    createdAtIso: i.createdAt.toISOString(),
    snoozedUntilIso: i.snoozedUntil ? i.snoozedUntil.toISOString() : null,
  }));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
          Inbox
        </h1>
        <p className="text-foreground-weak text-base">
          One queue of everything your agents are waiting on you for. Each item
          carries the agent&apos;s proposed action — review, edit, and submit.
          What you change versus what it guessed trains the agent to handle more
          on its own.
        </p>
      </div>

      <hr className="border-[var(--color-border-weak)]" />

      {rows.length === 0 ? (
        <p className="text-foreground-weak text-base">
          Inbox zero. Items show up here when an agent produces one (via the
          inbox tools) or a source pushes one in.
        </p>
      ) : (
        <InboxList items={rows} workspaceSlug={workspace.slug} />
      )}
    </div>
  );
}
