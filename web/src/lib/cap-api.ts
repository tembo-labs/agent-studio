import "server-only";

import {
  GUIDANCE_CARGO_AI_PATH,
  GUIDANCE_INDEX_PATH,
  GUIDANCE_PYDANTIC_PATH,
  TAS_APP_VERSION,
  TAS_GUIDANCE_VERSION,
  guidanceFilesFor,
  type GuidanceFile,
} from "@/lib/agent-guidance";
import type { Framework } from "@/lib/agent-framework";

// Thin client for the Tembo Coding Agent Platform task API. The
// hosted docs at https://docs.tembo.io/api/create-session call it
// "session" but the live API (and the @tembo-io/sdk) use "task" —
// POST /task/create. POSTs a free-text prompt + repo URL and returns
// a task record with an htmlUrl the user can follow to track the
// change. The task is what eventually opens the PR.

const DEFAULT_TEMBO_API_URL = "https://api.tembo.io";

export interface CreateTaskInput {
  // The plain-English prompt describing what should change in the
  // agent file. We build this from the run context + the user's
  // improvement request. CAP supports file tagging in the prompt.
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

export interface CreateTaskResult {
  taskId: string;
  title: string;
  status: string;
  htmlUrl: string;
}

export type CapError =
  | { kind: "missing_tembo_key" }
  | { kind: "http"; status: number; body: string; url: string }
  | { kind: "network"; message: string };

export async function createTemboTask(args: {
  apiKey: string;
  input: CreateTaskInput;
}): Promise<{ ok: true; result: CreateTaskResult } | { ok: false; error: CapError }> {
  const baseUrl = process.env.TEMBO_API_URL ?? DEFAULT_TEMBO_API_URL;

  const body = {
    prompt: args.input.prompt,
    repositories: [args.input.repositoryUrl],
    ...(args.input.targetBranch ? { targetBranch: args.input.targetBranch } : {}),
    ...(args.input.branchName ? { branchName: args.input.branchName } : {}),
    queueRightAway: true,
  };

  const url = `${baseUrl}/task/create`;
  // Log the outbound payload so the docker logs make it obvious what
  // we sent when CAP rejects us. v0.2 integration is brittle by
  // design until we settle the contract.
  console.log("[cap] POST", url, "payload=", JSON.stringify(body));

  let res: Response;
  try {
    res = await fetch(url, {
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
    console.log("[cap] ←", res.status, text);
    return { ok: false, error: { kind: "http", status: res.status, body: text, url } };
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
      taskId: json.id,
      title: json.title,
      status: json.status,
      htmlUrl: json.htmlUrl,
    },
  };
}

// Derive framework from the agent's repo path. Both callers
// (chat-edit, run-improve) only have agentPath at the call site; the
// framework is implicit in the directory. Falls back to pydantic for
// any path we don't recognize — wrong guidance shipping is worse than
// missing guidance, but pydantic is the canonical authoring format so
// it's the safer default.
function frameworkFromAgentPath(path: string): Framework {
  if (path.startsWith("agents/cargo-ai/")) return "cargo-ai";
  return "pydantic-agentspec";
}

// Step-0 block that the coding agent applies BEFORE the requested
// change: refresh the per-framework guidance files in the repo to
// match what TAS is shipping right now. The block carries both
// version stamps + the canonical content for each guidance file so
// the coding agent can diff against the on-disk version marker and
// overwrite stale copies in the same PR. We only include the index
// + the relevant framework's guide — the other framework's guide
// stays out to save tokens, since these prompts target a specific
// agent file.
function buildGuidanceRefreshBlock(framework: Framework): string {
  const files = guidanceFilesFor(framework);
  const otherFrameworkPath =
    framework === "cargo-ai" ? GUIDANCE_PYDANTIC_PATH : GUIDANCE_CARGO_AI_PATH;

  return [
    "# Step 0 — Refresh agent guidance (do this first)",
    "",
    `Tembo Agent Studio version: ${TAS_APP_VERSION}`,
    `Guidance version (this prompt): ${TAS_GUIDANCE_VERSION}`,
    "",
    "The studio ships agent-authoring guidance into the customer's repo",
    "under `agents/`. Each guidance file's first line is an HTML comment",
    "of the form `<!-- tas-guidance-version: <hash> -->`.",
    "",
    "Before doing the requested change:",
    "",
    `1. Read the first line of each of these files (if they exist):`,
    `   - \`${GUIDANCE_INDEX_PATH}\``,
    `   - \`${files[1].path}\``,
    `2. If a file is missing, or its version marker is not exactly`,
    `   \`<!-- tas-guidance-version: ${TAS_GUIDANCE_VERSION} -->\`,`,
    `   replace the file (or create it) with the canonical content`,
    `   quoted below. Include the refresh in the same PR.`,
    `3. If both files already match, skip the refresh and move on.`,
    "",
    `Leave \`${otherFrameworkPath}\` alone — this PR targets a`,
    `${framework} agent and shouldn't touch the other framework's guide.`,
    "",
    ...files.flatMap((f) => formatGuidanceFile(f)),
  ].join("\n");
}

function formatGuidanceFile(f: GuidanceFile): string[] {
  // Fenced with backticks; the marker comment is part of the content
  // string, so the canonical version-marker line appears at the top
  // of the fence. The coding agent should write exactly what's
  // inside the fence, marker line included, with no transformation.
  return [
    `## Canonical contents of \`${f.path}\``,
    "",
    "```",
    f.content,
    "```",
    "",
  ];
}

// Build a chat-to-edit prompt. No specific run is anchored; this is
// the agent-level "I want to change X about this agent" path. Same
// marker contract as the run-anchored variant so the same scanner
// works for both.
export function buildChatEditPrompt(args: {
  agentPath: string;
  improvement: string;
  improvementMarker: string;
}): string {
  const framework = frameworkFromAgentPath(args.agentPath);
  return [
    buildGuidanceRefreshBlock(framework),
    "",
    "# Step 1 — Requested change",
    "",
    `Improve the agent defined at @${args.agentPath}.`,
    "",
    "Open a pull request with the targeted change (and any guidance",
    "refresh from Step 0).",
    "",
    "IMPORTANT: Include this exact line on its own at the end of the pull",
    "request description so the Tembo Agent Studio can correlate the PR",
    "with the user's improvement request:",
    "",
    args.improvementMarker,
    "",
    "## Requested change",
    args.improvement.trim(),
  ].join("\n");
}

// Build the prompt we send to CAP from the run context + the user's
// freeform improvement request. We tag the agent file path so CAP
// knows which file to edit; the run input/output give it the concrete
// failure to fix; the improvement marker is what lets us later
// correlate the merged PR back to the improvement row that triggered
// it.
export function buildImprovePrompt(args: {
  agentPath: string;
  model: string;
  userMessage: string;
  output: string;
  improvement: string;
  improvementMarker: string;
}): string {
  const framework = frameworkFromAgentPath(args.agentPath);
  const trimmedOutput = args.output.length > 4000
    ? args.output.slice(0, 4000) + "\n…[truncated]"
    : args.output;

  return [
    buildGuidanceRefreshBlock(framework),
    "",
    "# Step 1 — Requested change",
    "",
    `Improve the agent defined at @${args.agentPath}.`,
    "",
    "Open a pull request with the targeted change (and any guidance",
    "refresh from Step 0).",
    "",
    "IMPORTANT: Include this exact line on its own at the end of the pull",
    "request description so the Tembo Agent Studio can correlate the PR",
    "with the user's improvement request:",
    "",
    args.improvementMarker,
    "",
    "## Improvement requested by the user",
    args.improvement.trim(),
    "",
    "## Context: the run that prompted this request",
    `- Model: ${args.model}`,
    `- User message: ${args.userMessage || "(empty)"}`,
    "",
    "### Agent output",
    "```",
    trimmedOutput,
    "```",
  ].join("\n");
}
