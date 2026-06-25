import { NextResponse, type NextRequest } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { apiError, authErrorResponse } from "@/lib/api-v1/http";
import { cancelRun, getRun } from "@/lib/runs-api";

// POST /api/v1/runs/[id]/cancel — kill an in-flight run, the scriptable
// equivalent of the run page's Stop button: it transitions the run to
// 'cancelled' and SIGKILLs the agent's subprocess. Min role operator (a
// mutation), scoped to the key's workspace so one workspace can't cancel
// another's run. Returns { cancelled } — true if this call stopped a running
// run, false if it was already terminal (idempotent / nothing to do).

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ id: string }>;

export async function POST(
  request: NextRequest,
  { params }: { params: RouteParams },
): Promise<NextResponse> {
  const auth = await authorizeApiRequest(request, "operator");
  if (!auth.ok) return authErrorResponse(auth);

  const { id } = await params;
  let run;
  try {
    run = await getRun(id, auth.workspace.id);
  } catch {
    return apiError(502, "could not reach the run service");
  }
  if (!run || run.workspaceId !== auth.workspace.id) {
    return apiError(404, "run not found");
  }

  let cancelled: boolean;
  try {
    cancelled = await cancelRun(id, auth.workspace.id);
  } catch {
    return apiError(502, "could not reach the run service");
  }
  return NextResponse.json({ cancelled });
}
