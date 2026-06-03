import { NextResponse } from "next/server";

import { getCustomFaviconBytes, getWorkspaceBySlug } from "@/lib/workspace";

// Serves the workspace's favicon. For default kinds we redirect to the
// static SVG in /public/favicons/ — keeps the response cheap and CDN-
// friendly. For 'custom', we stream the BYTEA blob with its stored MIME.
//
// Redirects use a **relative** Location (not new URL(path, request.url)):
// behind a proxy the request origin is the container's internal bind
// (e.g. https://0.0.0.0:8080), so an absolute redirect sends the browser
// to an unreachable host and the favicon comes back blank. A relative
// Location is resolved against the page's public origin.

function redirectToStatic(path: string): NextResponse {
  return new NextResponse(null, { status: 302, headers: { Location: path } });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspace: string }> },
) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return redirectToStatic("/favicons/default-tembo.svg");
  }

  if (workspace.faviconKind !== "custom") {
    return redirectToStatic(`/favicons/${workspace.faviconKind}.svg`);
  }

  const blob = await getCustomFaviconBytes(workspace.id);
  if (!blob) {
    // Fall back to the Tembo default if `custom` is set but data is
    // missing (shouldn't happen — the writer enforces both fields).
    return redirectToStatic("/favicons/default-tembo.svg");
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
