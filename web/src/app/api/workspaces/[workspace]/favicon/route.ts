import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/session";
import {
  getCustomFaviconBytes,
  getWorkspaceBySlug,
  getWorkspaceRole,
} from "@/lib/workspace";

// Serves the workspace's favicon. For default kinds we redirect to the
// static SVG in /public/favicons/ — keeps the response cheap and CDN-
// friendly. For 'custom', we stream the BYTEA blob with its stored MIME.
//
// Redirects use a **relative** Location (not new URL(path, request.url)):
// behind a proxy the request origin is the container's internal bind
// (e.g. https://0.0.0.0:8080), so an absolute redirect sends the browser
// to an unreachable host and the favicon comes back blank. A relative
// Location is resolved against the page's public origin.
//
// Existence-probe hardening (#50): outsiders — no session, an unknown slug,
// or a non-member — all get the identical generic Tembo default, so this
// route can't confirm a workspace exists or leak its chosen/custom favicon.
// Only members get the real one. This route is referenced only from the
// authenticated [workspace] layout; pre-auth pages render the static
// default-tembo from the root layout, so gating here costs nothing there.

const GENERIC_DEFAULT = "/favicons/default-tembo.svg";

function redirectToStatic(path: string): NextResponse {
  return new NextResponse(null, { status: 302, headers: { Location: path } });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspace: string }> },
) {
  const { workspace: slug } = await params;

  const session = await getServerSession();
  if (!session) return redirectToStatic(GENERIC_DEFAULT);

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) return redirectToStatic(GENERIC_DEFAULT);

  const role = await getWorkspaceRole(workspace.id, session.user.id);
  if (!role) return redirectToStatic(GENERIC_DEFAULT);

  if (workspace.faviconKind !== "custom") {
    return redirectToStatic(`/favicons/${workspace.faviconKind}.svg`);
  }

  const blob = await getCustomFaviconBytes(workspace.id);
  if (!blob) {
    // Fall back to the Tembo default if `custom` is set but data is
    // missing (shouldn't happen — the writer enforces both fields).
    return redirectToStatic(GENERIC_DEFAULT);
  }

  // Cast Buffer → Uint8Array for the Response body. Tag with the
  // updated_at so clients can revalidate when the favicon changes.
  return new NextResponse(new Uint8Array(blob.bytes), {
    status: 200,
    headers: {
      "Content-Type": blob.mime,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
