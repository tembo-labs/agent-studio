import { notFound } from "next/navigation";
import Link from "next/link";

import { LocalTime } from "@/components/local-time";
import { McpProviderLogo } from "@/components/mcp-provider-logo";
import { getInboxItem, listInboxItems, type InboxItem } from "@/lib/inbox-api";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/workspace";

import { ContextView } from "./context-view";
import { ReviewForm } from "./review-form";

export const dynamic = "force-dynamic";

// Drop currently-snoozed items (snoozed_until in the future) from the triage
// queue. Module-scope so `Date.now()` stays out of the server component's render.
function unsnoozed(items: InboxItem[]): InboxItem[] {
  const now = Date.now();
  return items.filter(
    (i) => !i.snoozedUntil || i.snoozedUntil.getTime() <= now,
  );
}

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

  const item = await getInboxItem(id, workspace.id, session.user.id);
  if (!item) notFound();

  const resolved = item.status === "done" || item.status === "dismissed";

  // For an active item, find the next one to triage so resolving this one
  // advances the user through their queue (and show how many remain). "Next" is
  // the item after this one in the active list's default order (created desc),
  // skipping snoozed items. None left → back to the index.
  let nextHref = `/${workspace.slug}/inbox`;
  let remaining = 0;
  if (!resolved) {
    const active = await listInboxItems(
      workspace.id,
      session.user.id,
      { statuses: ["open", "claimed", "awaiting_human"] },
      500,
    );
    const queue = unsnoozed(active);
    const idx = queue.findIndex((i) => i.id === item.id);
    const after =
      idx >= 0 ? queue.slice(idx + 1) : queue.filter((i) => i.id !== item.id);
    const nextId = after[0]?.id ?? null;
    if (nextId) nextHref = `/${workspace.slug}/inbox/${nextId}`;
    remaining = Math.max(0, queue.length - 1);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <Link
          href={`/${workspace.slug}/inbox`}
          className="text-foreground-weak text-sm hover:underline"
        >
          ← Inbox
        </Link>
        <div className="flex items-center gap-2.5">
          <McpProviderLogo slug={item.source} label={item.source} size={24} />
          <h1 className="text-foreground-title text-xl font-bold tracking-tight">
            {item.title}
          </h1>
        </div>
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
        {!resolved && (
          <p className="text-foreground-muted text-sm">
            {remaining > 0
              ? `${remaining} more in your inbox`
              : "Last one in your inbox"}
          </p>
        )}
      </div>

      {item.links && item.links.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-foreground text-sm font-semibold uppercase tracking-wide">
            Links
          </h2>
          <ul className="bg-surface-secondary flex flex-col gap-1 rounded-lg border border-[var(--color-border-weak)] p-4">
            {item.links.map((link, i) => (
              <li key={`${link.url}-${i}`}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground inline-flex w-fit items-center gap-1 text-sm font-medium hover:underline"
                >
                  {link.label ?? link.url} ↗
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

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
          nextHref={nextHref}
        />
      )}
    </div>
  );
}
