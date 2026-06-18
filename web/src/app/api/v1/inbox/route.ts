import { NextResponse, type NextRequest } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { listInboxItemsFor, produceInboxItemFor } from "@/lib/api-v1/actions";
import { apiError, authErrorResponse } from "@/lib/api-v1/http";
import { serializeInboxItem } from "@/lib/api-v1/serializers";
import type { InboxItemStatus, InboxSortKey, InboxOption } from "@/lib/inbox-api";

// GET  /api/v1/inbox — list/search the Tasks Inbox queue for the workspace.
//   ?status=open,awaiting_human  ?source=linkedin  ?itemType=connection_request
//   ?q=<free text>  ?sort=created_at|title|...  ?dir=asc|desc  ?limit=100
//   Min role viewer.
// POST /api/v1/inbox — produce an item (an agent surfacing something for a
//   human). Body: { itemType, title, source?, externalRef?, context?,
//   proposedAction?: { text?, fields? } }. Returns 201 { inbox_item }.
//   Min role operator.

export const dynamic = "force-dynamic";

const STATUSES: InboxItemStatus[] = [
  "open",
  "claimed",
  "awaiting_human",
  "done",
  "dismissed",
];
const SORT_KEYS: InboxSortKey[] = [
  "created_at",
  "updated_at",
  "title",
  "item_type",
  "source",
  "status",
];

function csv(value: string | null): string[] {
  return value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeApiRequest(request, "viewer");
  if (!auth.ok) return authErrorResponse(auth);

  const sp = request.nextUrl.searchParams;
  const statuses = csv(sp.get("status")).filter((s): s is InboxItemStatus =>
    (STATUSES as string[]).includes(s),
  );
  const source = sp.get("source") ?? undefined;
  const itemType = sp.get("itemType") ?? undefined;
  const search = sp.get("q") ?? undefined;
  const sortRaw = sp.get("sort");
  const sort = (SORT_KEYS as string[]).includes(sortRaw ?? "")
    ? (sortRaw as InboxSortKey)
    : undefined;
  const dir = sp.get("dir") === "asc" ? "asc" : sp.get("dir") === "desc" ? "desc" : undefined;

  const limitRaw = sp.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  if (limitRaw && (!Number.isFinite(limit) || (limit as number) < 1)) {
    return apiError(400, "limit must be a positive integer");
  }

  const res = await listInboxItemsFor(
    auth,
    {
      ...(statuses.length ? { statuses } : {}),
      ...(source ? { source } : {}),
      ...(itemType ? { itemType } : {}),
      ...(search ? { search } : {}),
      ...(sort ? { sort } : {}),
      ...(dir ? { dir } : {}),
    },
    limit,
  );
  return NextResponse.json({ inbox_items: res.items.map(serializeInboxItem) });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeApiRequest(request, "operator");
  if (!auth.ok) return authErrorResponse(auth);

  let body: {
    itemType?: unknown;
    title?: unknown;
    source?: unknown;
    externalRef?: unknown;
    context?: unknown;
    proposedAction?: { text?: unknown; fields?: unknown };
    options?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return apiError(400, "request body must be JSON");
  }
  if (typeof body.itemType !== "string" || !body.itemType.trim()) {
    return apiError(400, "`itemType` (string) is required");
  }
  if (typeof body.title !== "string" || !body.title.trim()) {
    return apiError(400, "`title` (string) is required");
  }

  const proposed = body.proposedAction;
  const proposedAction =
    proposed && (typeof proposed.text === "string" || proposed.fields)
      ? {
          ...(typeof proposed.text === "string" ? { text: proposed.text } : {}),
          ...(proposed.fields && typeof proposed.fields === "object"
            ? { fields: proposed.fields as Record<string, unknown> }
            : {}),
        }
      : undefined;

  const res = await produceInboxItemFor(auth, {
    itemType: body.itemType,
    title: body.title,
    source: typeof body.source === "string" ? body.source : undefined,
    externalRef: typeof body.externalRef === "string" ? body.externalRef : undefined,
    context:
      body.context && typeof body.context === "object"
        ? (body.context as Record<string, unknown>)
        : undefined,
    proposedAction,
    options: Array.isArray(body.options)
      ? (body.options as InboxOption[])
      : undefined,
  });
  if (!res.ok) return apiError(res.status, res.error);

  return NextResponse.json(
    { inbox_item: serializeInboxItem(res.item) },
    { status: 201 },
  );
}
