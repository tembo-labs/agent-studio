import "server-only";

// On-demand scan that asks GitHub for PRs containing our
// improvement markers, then updates each matching improvement row's
// pr_url / pr_state / status. Called when the user visits
// /<workspace>/improvements. No webhook infra required — trades
// freshness for simplicity. A real webhook can replace this without
// changing the improvement table.

import {
  setImprovementPr,
  type Improvement,
  type ImprovementStatus,
  IMPROVEMENT_MARKER_PREFIX,
  improvementMarker,
} from "@/lib/improvements-api";
import { getWorkspaceRepo, getWorkspaceSecretPlaintext } from "@/lib/workspace";

interface GhSearchResult {
  total_count: number;
  items: Array<{
    number: number;
    title: string;
    html_url: string;
    state: string;
    pull_request?: {
      merged_at: string | null;
    };
    body: string | null;
  }>;
}

export async function scanImprovementsForPRs(
  workspaceId: string,
  improvements: Improvement[],
): Promise<Improvement[]> {
  // Only improvements that haven't reached a terminal state need
  // checking. "merged" + "closed" are final.
  const open = improvements.filter(
    (i) => i.status !== "merged" && i.status !== "closed",
  );
  if (open.length === 0) return improvements;

  const repo = await getWorkspaceRepo(workspaceId);
  if (!repo) return improvements;
  const token = await getWorkspaceSecretPlaintext(workspaceId, "github_pat");
  if (!token) return improvements;

  // GitHub's search API caps `in:body` queries by length. Ask for
  // ALL PRs in the repo that mention the marker prefix; we'll match
  // by id client-side. Capped at 100 results which is fine for a
  // dev-stage app.
  const q = `repo:${repo.owner}/${repo.name} is:pr "${IMPROVEMENT_MARKER_PREFIX}" in:body`;
  const url = `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=100`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.log(
      "[improvement-scan] github search failed",
      res.status,
      body.slice(0, 300),
    );
    return improvements;
  }

  const search = (await res.json()) as GhSearchResult;

  // Build a quick lookup of improvement rows by id so we can match
  // each PR back to its source improvement.
  const byId = new Map(open.map((i) => [i.id, i]));
  const updates = new Map<string, Improvement>();

  for (const pr of search.items) {
    const body = pr.body ?? "";
    for (const id of byId.keys()) {
      if (!body.includes(improvementMarker(id))) continue;
      const status = derivePrStatus(pr.state, pr.pull_request?.merged_at ?? null);
      const newState = derivePrState(pr.state, pr.pull_request?.merged_at ?? null);
      const existing = byId.get(id);
      if (!existing) continue;
      // Skip if nothing actually changed — avoids a pointless write.
      if (
        existing.prUrl === pr.html_url &&
        existing.prNumber === pr.number &&
        existing.prState === newState &&
        existing.status === status
      ) {
        updates.set(id, existing);
        continue;
      }
      await setImprovementPr({
        id,
        prUrl: pr.html_url,
        prNumber: pr.number,
        prState: newState,
        status,
      });
      updates.set(id, {
        ...existing,
        prUrl: pr.html_url,
        prNumber: pr.number,
        prState: newState,
        status,
      });
    }
  }

  // Return improvements with updated rows folded in.
  return improvements.map((i) => updates.get(i.id) ?? i);
}

function derivePrStatus(
  ghState: string,
  mergedAt: string | null,
): ImprovementStatus {
  if (mergedAt) return "merged";
  if (ghState === "closed") return "closed";
  return "pr_opened";
}

function derivePrState(
  ghState: string,
  mergedAt: string | null,
): "merged" | "closed" | "open" {
  if (mergedAt) return "merged";
  if (ghState === "closed") return "closed";
  return "open";
}
