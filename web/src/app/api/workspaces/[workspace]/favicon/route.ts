import { NextResponse, type NextRequest } from "next/server";

import { getCustomFaviconBytes, getWorkspaceBySlug } from "@/lib/workspace";

// Serves the workspace's favicon. For default kinds we redirect to the
// static SVG in /public/favicons/ — keeps the response cheap and CDN-
// friendly. For 'custom', we stream the BYTEA blob with its stored MIME.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspace: string }> },
) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.redirect(
      new URL("/favicons/default-tembo.svg", request.url),
      302,
    );
  }

  if (workspace.faviconKind !== "custom") {
    return NextResponse.redirect(
      new URL(`/favicons/${workspace.faviconKind}.svg`, request.url),
      302,
    );
  }

  const blob = await getCustomFaviconBytes(workspace.id);
  if (!blob) {
    // Fall back to the Tembo default if `custom` is set but data is
    // missing (shouldn't happen — the writer enforces both fields).
    return NextResponse.redirect(
      new URL("/favicons/default-tembo.svg", request.url),
      302,
    );
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
