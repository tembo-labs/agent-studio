// Minimal line-level diff for rendering "what changed" between two agent
// spec versions. We hold both blobs (snapshots in Postgres, or stable vs
// live draft), so no GitHub compare API is needed. Classic LCS over lines;
// good enough for human-readable spec diffs (tens-to-hundreds of lines).

export type DiffLine = {
  type: "context" | "add" | "remove";
  text: string;
};

export type DiffStats = { added: number; removed: number };

export type TextDiff = {
  lines: DiffLine[];
  stats: DiffStats;
  /** True when the two inputs are identical. */
  unchanged: boolean;
};

export function diffLines(before: string, after: string): TextDiff {
  const a = before.length === 0 ? [] : before.split("\n");
  const b = after.length === 0 ? [] : after.split("\n");

  // LCS table over lines.
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const lines: DiffLine[] = [];
  let added = 0;
  let removed = 0;
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      lines.push({ type: "context", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      lines.push({ type: "remove", text: a[i] });
      removed++;
      i++;
    } else {
      lines.push({ type: "add", text: b[j] });
      added++;
      j++;
    }
  }
  while (i < n) {
    lines.push({ type: "remove", text: a[i] });
    removed++;
    i++;
  }
  while (j < m) {
    lines.push({ type: "add", text: b[j] });
    added++;
    j++;
  }

  return { lines, stats: { added, removed }, unchanged: added === 0 && removed === 0 };
}
