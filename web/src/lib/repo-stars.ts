import "server-only";

import { POWERED_BY_HREF } from "@/lib/config";

// The project repo (same URL the login footer links to).
export const REPO_URL = POWERED_BY_HREF;

// Star count for the docs footer. Cached for an hour so we don't hit GitHub on
// every render; null on any failure (rate limit, network) so the UI just shows
// the link without a count.
export async function getRepoStars(): Promise<number | null> {
  const m = REPO_URL.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!m) return null;
  try {
    const res = await fetch(`https://api.github.com/repos/${m[1]}/${m[2]}`, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { stargazers_count?: number };
    return typeof json.stargazers_count === "number"
      ? json.stargazers_count
      : null;
  } catch {
    return null;
  }
}
