import { NextResponse, type NextRequest } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { validateSpec } from "@/lib/api-v1/actions";
import { apiError, authErrorResponse } from "@/lib/api-v1/http";

// POST /api/v1/agents/validate — parse an agent spec WITHOUT writing it to git,
// so a client can check a draft before committing. Body: { content, format?,
// filename? } (format inferred from filename if omitted). Returns the parse
// result: { valid: true, framework, name } or { valid: false, error, detail }.
// Min role viewer — this is a read-only check, no side effects.

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeApiRequest(request, "viewer");
  if (!auth.ok) return authErrorResponse(auth);

  let body: { content?: unknown; format?: unknown; filename?: unknown };
  try {
    body = await request.json();
  } catch {
    return apiError(400, "request body must be JSON");
  }
  if (typeof body.content !== "string") {
    return apiError(400, "`content` (string) is required");
  }
  const format =
    body.format === "yaml" || body.format === "json" ? body.format : undefined;
  const filename = typeof body.filename === "string" ? body.filename : undefined;

  const out = validateSpec({ content: body.content, format, filename });
  if (!out.ok) return apiError(out.status, out.error);

  return NextResponse.json(out.result);
}
