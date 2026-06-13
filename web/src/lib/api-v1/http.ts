import "server-only";

import { NextResponse } from "next/server";

import type { AuthorizeApiFailure } from "@/lib/api-auth";

// Shared response helpers for the /api/v1 REST surface so every handler emits
// the same error envelope `{ error, details? }` and maps an auth failure to its
// status the same way.

export function authErrorResponse(fail: AuthorizeApiFailure): NextResponse {
  return NextResponse.json({ error: fail.error }, { status: fail.status });
}

export function apiError(
  status: number,
  error: string,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    details === undefined ? { error } : { error, details },
    { status },
  );
}
