import { notFound } from "next/navigation";
import Link from "next/link";

import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { getInboxItem } from "@/lib/inbox-api";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/workspace";

import { ContextView } from "./context-view";
import { ReviewForm } from "./review-form";

export const dynamic = "force-dynamic";

// Inbox item detail: the raw context to review, plus a form pre-filled with the
// agent's proposed action. The human edits and submits (or dismisses); the diff
// between proposal and submission is the learning signal.

export default async function InboxItemPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>;
}) {
  const { workspace: slug, id } = await params;

  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const item = await getInboxItem(id, workspace.id);
  if (!item) notFound();

  const resolved = item.status === "done" || item.status === "dismissed";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <Link
          href={`/${workspace.slug}/inbox`}
          className="text-foreground-weak text-sm hover:underline"
        >
          ← Inbox
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant="gray" size="small">
            {item.source}
          </Badge>
          <Badge variant="gray" size="small">
            {item.itemType}
          </Badge>
        </div>
        <h1 className="text-foreground-title text-xl font-bold tracking-tight">
          {item.title}
        </h1>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground inline-flex w-fit items-center gap-1 text-sm font-medium hover:underline"
          >
            Open in {item.source} ↗
          </a>
        )}
        <p className="text-foreground-weak text-sm">
          Created <LocalTime iso={item.createdAt.toISOString()} style="relative" />
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-foreground text-sm font-semibold uppercase tracking-wide">
          Context
        </h2>
        <div className="bg-surface-secondary rounded-lg border border-[var(--color-border-weak)] p-4">
          <ContextView context={item.context} />
        </div>
      </section>

      {resolved ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-foreground text-sm font-semibold uppercase tracking-wide">
            {item.status === "done" ? "Final action" : "Dismissed"}
          </h2>
          {item.finalAction?.text && (
            <p className="text-foreground whitespace-pre-wrap text-sm leading-6">
              {item.finalAction.text}
            </p>
          )}
        </section>
      ) : (
        <ReviewForm
          workspaceSlug={workspace.slug}
          itemId={item.id}
          proposedText={item.proposedAction?.text ?? ""}
          options={item.options}
        />
      )}
    </div>
  );
}
