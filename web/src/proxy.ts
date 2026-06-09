import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Surface the request path to server components via an `x-pathname` header.
// Next doesn't expose the current pathname to a server layout otherwise, and
// the [workspace] layout needs it to redirect a renamed workspace's old slug
// to its current one while preserving the rest of the path
// (e.g. /old/agents/x → /new/agents/x). This is the only job here — no auth,
// no DB — so it stays cheap on every request. Auth + RBAC continue to live in
// the layouts and server actions.
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Run for app routes only; skip API routes, Next internals, and metadata
  // files. (API routes resolve workspaces themselves and don't need this.)
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
