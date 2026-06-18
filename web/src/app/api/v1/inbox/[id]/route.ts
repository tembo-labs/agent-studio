import { NextResponse, type NextRequest } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import {
  claimInboxItemFor,
  completeInboxItemFor,
  dismissInboxItemFor,
  getInboxItemFor,
  proposeInboxActionFor,
} from "@/lib/api-v1/actions";
import { apiError, authErrorResponse } from "@/lib/api-v1/http";
import { serializeInboxItem } from "@/lib/api-v1/serializers";
import type { InboxAction } from "@/lib/inbox-api";

// GET   /api/v1/inbox/[id] — one item (full context, proposed + final action).
//   Min role viewer.
// PATCH /api/v1/inbox/[id] — advance an item. Body is one of:
//   { action: "claim" }
//   { action: "propose",  proposedAction: { text?, fields? } }
//   { action: "complete", finalAction: { text?, fields? } }
//   { action: "dismiss" }
//   Min role operator.

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ id: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams },
): Promise<NextResponse> {
  const auth = await authorizeApiRequest(request, "viewer");
  if (!auth.ok) return authErrorResponse(auth);

  const { id } = await params;
  const res = await getInboxItemFor(auth, id);
  if (!res.ok) return apiError(res.status, res.error);
  return NextResponse.json({ inbox_item: serializeInboxItem(res.item) });
}

/** Coerce a JSON {text?, fields?} into an InboxAction, or null if neither. */
function toAction(raw: unknown): InboxAction | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { text?: unknown; fields?: unknown };
  const action: InboxAction = {
    ...(typeof o.text === "string" ? { text: o.text } : {}),
    ...(o.fields && typeof o.fields === "object"
      ? { fields: o.fields as Record<string, unknown> }
      : {}),
  };
  return action.text || action.fields ? action : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: RouteParams },
): Promise<NextResponse> {
  const auth = await authorizeApiRequest(request, "operator");
  if (!auth.ok) return authErrorResponse(auth);

  const { id } = await params;
  let body: { action?: unknown; proposedAction?: unknown; finalAction?: unknown };
  try {
    body = await request.json();
  } catch {
    return apiError(400, "request body must be JSON");
  }

  switch (body.action) {
    case "claim": {
      const res = await claimInboxItemFor(auth, { id });
      if (!res.ok) return apiError(res.status, res.error);
      return NextResponse.json({ inbox_item: serializeInboxItem(res.item) });
    }
    case "propose": {
      const proposedAction = toAction(body.proposedAction);
      if (!proposedAction) {
        return apiError(400, "`proposedAction` must have text or fields");
      }
      const res = await proposeInboxActionFor(auth, { id, proposedAction });
      if (!res.ok) return apiError(res.status, res.error);
      return NextResponse.json({ inbox_item: serializeInboxItem(res.item) });
    }
    case "complete": {
      const finalAction = toAction(body.finalAction);
      if (!finalAction) {
        return apiError(400, "`finalAction` must have text or fields");
      }
      const res = await completeInboxItemFor(auth, { id, finalAction });
      if (!res.ok) return apiError(res.status, res.error);
      return NextResponse.json({ inbox_item: serializeInboxItem(res.item) });
    }
    case "dismiss": {
      const res = await dismissInboxItemFor(auth, { id });
      if (!res.ok) return apiError(res.status, res.error);
      return NextResponse.json({ ok: true });
    }
    default:
      return apiError(400, "`action` must be one of: claim, propose, complete, dismiss");
  }
}
