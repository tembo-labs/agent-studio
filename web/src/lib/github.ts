import "server-only";

// Accept the forms a user is likely to paste:
//   https://github.com/owner/repo
//   https://github.com/owner/repo.git
//   git@github.com:owner/repo.git
//   owner/repo
const REPO_RE =
  /^(?:https?:\/\/github\.com\/|git@github\.com:)?([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/;

export type ParsedRepo = { owner: string; name: string };

export function parseRepoInput(input: string): ParsedRepo | null {
  const m = REPO_RE.exec(input.trim());
  if (!m) return null;
  const [, owner, name] = m;
  if (!owner || !name) return null;
  return { owner, name };
}

export type ValidateRepoError =
  | "invalid-token"
  | "not-found"
  | "no-push"
  | "network"
  | "rate-limited";

export type ValidateRepoResult =
  | {
      ok: true;
      owner: string;
      name: string;
      fullName: string;
      defaultBranch: string;
    }
  | { ok: false; error: ValidateRepoError; detail?: string };

/**
 * Confirm the PAT can both read and write the given repo. Returns a typed
 * error code rather than throwing so the UI can render a clean message.
 *
 * Implementation note: `GET /repos/{owner}/{repo}` returns the requesting
 * user's `permissions` block when authenticated. `permissions.push === true`
 * is GitHub's documented signal for write access. We do NOT actually attempt
 * a write — creating + deleting a probe branch is invasive and would leave
 * a noisy audit trail in the customer's repo.
 */
export async function validateRepo(
  token: string,
  parsed: ParsedRepo,
): Promise<ValidateRepoResult> {
  let res: Response;
  try {
    res = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.name}`,
      {
        method: "GET",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "tembo-agent-studio",
        },
        cache: "no-store",
      },
    );
  } catch (err) {
    return {
      ok: false,
      error: "network",
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  if (res.status === 401) {
    return { ok: false, error: "invalid-token" };
  }
  if (res.status === 404) {
    // GitHub does not distinguish "repo doesn't exist" from "token can't see it"
    // on purpose, to avoid leaking private-repo existence.
    return { ok: false, error: "not-found" };
  }
  if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
    return { ok: false, error: "rate-limited" };
  }
  if (!res.ok) {
    return {
      ok: false,
      error: "network",
      detail: `GitHub returned ${res.status}`,
    };
  }

  const body = (await res.json()) as {
    name: string;
    full_name: string;
    owner: { login: string };
    default_branch: string;
    permissions?: { push?: boolean };
  };

  if (!body.permissions?.push) {
    return { ok: false, error: "no-push" };
  }

  return {
    ok: true,
    owner: body.owner.login,
    name: body.name,
    fullName: body.full_name,
    defaultBranch: body.default_branch,
  };
}
