import "server-only";

// Thin client for the Tembo Coding Agent Platform create-session API.
// See https://docs.tembo.io/api/create-session — POSTs a free-text
// prompt + repo handle and returns a session record with an htmlUrl
// the user can follow to track the change. The session is what
// eventually opens the PR against the repo.

const DEFAULT_TEMBO_API_URL = "https://api.tembo.io";

export interface CreateSessionInput {
  // The plain-English prompt describing what should change in the
  // agent file. We build this from the run context + the user's
  // feedback. CAP supports file tagging in the prompt.
  prompt: string;
  // Public GitHub URL of the workspace repo, e.g.
  // "https://github.com/owner/name". CAP locates the repo by URL.
  repositoryUrl: string;
  // Default branch to open the PR against (typically "main").
  targetBranch?: string;
  // Optional explicit branch name to use for the work; omitted
  // lets CAP pick one.
  branchName?: string;
}

export interface CreateSessionResult {
  sessionId: string;
  title: string;
  status: string;
  htmlUrl: string;
}

export type CapError =
  | { kind: "missing_tembo_key" }
  | { kind: "http"; status: number; body: string }
  | { kind: "network"; message: string };

export async function createTemboSession(args: {
  apiKey: string;
  input: CreateSessionInput;
}): Promise<{ ok: true; result: CreateSessionResult } | { ok: false; error: CapError }> {
  const baseUrl = process.env.TEMBO_API_URL ?? DEFAULT_TEMBO_API_URL;

  const body = {
    prompt: args.input.prompt,
    repositories: [args.input.repositoryUrl],
    ...(args.input.targetBranch ? { targetBranch: args.input.targetBranch } : {}),
    ...(args.input.branchName ? { branchName: args.input.branchName } : {}),
    queueRightAway: true,
  };

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/session/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.apiKey}`,
      },
      cache: "no-store",
      body: JSON.stringify(body),
    });
  } catch (e) {
    return {
      ok: false,
      error: {
        kind: "network",
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: { kind: "http", status: res.status, body: text } };
  }

  const json = (await res.json()) as {
    id: string;
    title: string;
    status: string;
    htmlUrl: string;
  };
  return {
    ok: true,
    result: {
      sessionId: json.id,
      title: json.title,
      status: json.status,
      htmlUrl: json.htmlUrl,
    },
  };
}

// Build the prompt we send to CAP from the run context + the user's
// freeform feedback. We tag the agent file path so CAP knows which
// file to edit; the run input/output give it the concrete failure to
// fix.
export function buildImprovePrompt(args: {
  agentPath: string;
  model: string;
  userMessage: string;
  output: string;
  feedback: string;
}): string {
  const trimmedOutput = args.output.length > 4000
    ? args.output.slice(0, 4000) + "\n…[truncated]"
    : args.output;

  return [
    `Improve the agent defined at @${args.agentPath}.`,
    "",
    "Open a pull request with the targeted change.",
    "",
    "## Feedback from the user",
    args.feedback.trim(),
    "",
    "## Context: the run that prompted this feedback",
    `- Model: ${args.model}`,
    `- User message: ${args.userMessage || "(empty)"}`,
    "",
    "### Agent output",
    "```",
    trimmedOutput,
    "```",
  ].join("\n");
}
