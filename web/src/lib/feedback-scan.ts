import "server-only";

// On-demand scan that asks GitHub for PRs containing our feedback
// markers, then updates each matching feedback row's pr_url /
// pr_state / status. Called when the user visits /<workspace>/
// feedbacks. No webhook infra required — trades freshness for
// simplicity. A real webhook can replace this without changing the
// feedback table.

import {
  setFeedbackPr,
  type Feedback,
  type FeedbackStatus,
  FEEDBACK_MARKER_PREFIX,
  feedbackMarker,
} from "@/lib/feedbacks-api";
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

export async function scanFeedbacksForPRs(
  workspaceId: string,
  feedbacks: Feedback[],
): Promise<Feedback[]> {
  // Only feedbacks that haven't reached a terminal state need
  // checking. "merged" + "closed" are final.
  const open = feedbacks.filter(
    (f) => f.status !== "merged" && f.status !== "closed",
  );
  if (open.length === 0) return feedbacks;

  const repo = await getWorkspaceRepo(workspaceId);
  if (!repo) return feedbacks;
  const token = await getWorkspaceSecretPlaintext(workspaceId, "github_pat");
  if (!token) return feedbacks;

  // GitHub's search API caps `in:body` queries by length. Ask for
  // ALL PRs in the repo that mention the marker prefix; we'll match
  // by id client-side. Capped at 100 results which is fine for a
  // dev-stage app.
  const q = `repo:${repo.owner}/${repo.name} is:pr "${FEEDBACK_MARKER_PREFIX}" in:body`;
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
    console.log("[feedback-scan] github search failed", res.status, body.slice(0, 300));
    return feedbacks;
  }

  const search = (await res.json()) as GhSearchResult;

  // Build a quick lookup of feedback rows by id so we can match each
  // PR back to its source feedback.
  const byId = new Map(open.map((f) => [f.id, f]));
  const updates = new Map<string, Feedback>();

  for (const pr of search.items) {
    const body = pr.body ?? "";
    for (const id of byId.keys()) {
      if (!body.includes(feedbackMarker(id))) continue;
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
      await setFeedbackPr({
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

  // Return feedbacks with updated rows folded in.
  return feedbacks.map((f) => updates.get(f.id) ?? f);
}

function derivePrStatus(
  ghState: string,
  mergedAt: string | null,
): FeedbackStatus {
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
