import "server-only";

import {
  GUIDANCE_ADDITIONAL_PATH,
  GUIDANCE_CARGO_AI_PATH,
  GUIDANCE_INDEX_PATH,
  GUIDANCE_PYDANTIC_PATH,
  GUIDANCE_ROOT_PATH,
  TAS_APP_VERSION,
  TAS_GUIDANCE_VERSION,
  additionalInstructionsFile,
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
  // guidanceFilesFor returns [root AGENTS.md, agents/AGENTS.md, framework guide]
  // in that order. All three are TAS-managed and refresh on drift.
  const tasManaged = guidanceFilesFor(framework);
  const additional = additionalInstructionsFile();
  const frameworkGuide = tasManaged[2];
  const otherFrameworkPath =
    framework === "cargo-ai" ? GUIDANCE_PYDANTIC_PATH : GUIDANCE_CARGO_AI_PATH;

  return [
    "# Step 0 — Refresh agent guidance (do this first)",
    "",
    `Tembo Agent Studio version: ${TAS_APP_VERSION}`,
    `Guidance version (this prompt): ${TAS_GUIDANCE_VERSION}`,
    "",
    "The studio ships agent-authoring guidance into the customer's repo.",
    "TAS-managed files start their first line with an HTML comment of",
    "the form `<!-- tas-guidance-version: <hash> -->`.",
    "",
    "Before doing the requested change:",
    "",
    "**TAS-managed files (refresh on drift — overwrite if marker is",
    "missing or stale):**",
    "",
    `- \`${GUIDANCE_ROOT_PATH}\``,
    `- \`${GUIDANCE_INDEX_PATH}\``,
    `- \`${frameworkGuide.path}\``,
    "",
    `For each: if missing, or the version marker on its first line is`,
    `not exactly \`<!-- tas-guidance-version: ${TAS_GUIDANCE_VERSION} -->\`,`,
    `replace the file with the canonical content quoted below.`,
    "",
    "**Customer-managed file (create only if missing — never overwrite):**",
    "",
    `- \`${GUIDANCE_ADDITIONAL_PATH}\``,
    "",
    `If \`${GUIDANCE_ADDITIONAL_PATH}\` does not exist, create it from`,
    `the canonical starter quoted below. If it already exists, leave`,
    `it alone — this file is the customer's project-specific override`,
    `slot. Read its current contents and respect any instructions it`,
    `contains when authoring the requested change.`,
    "",
    `Any guidance file change lands in the same PR as the requested`,
    `change.`,
    "",
    `Leave \`${otherFrameworkPath}\` alone — this PR targets a`,
    `${framework} agent and shouldn't touch the other framework's guide.`,
    "",
    ...tasManaged.flatMap((f) => formatGuidanceFile(f)),
    ...formatGuidanceFile(additional),
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

// Build a chat-to-create prompt. Pass the user's description through
// verbatim and point Tembo CAP at the repo's checked-in guides for
// path/shape conventions. We assume external-service connections
// already exist — TAS bootstraps those separately, so the coding
// agent shouldn't scaffold provider config in the same PR. The
// marker line is the one piece of TAS scaffolding kept — without
// it the PR scanner can't correlate the merged PR back to the
// improvement row.
export type AvailableConnectionSlots = Record<string, string[]>;

export function buildCreateAgentPrompt(args: {
  framework: Framework;
  agentName: string;
  agentPath: string;
  description: string;
  improvementMarker: string;
  /**
   * Toolkit → authorized slot names for the user creating this
   * agent. When present, the prompt tells Tembo to prefer these
   * concrete slot names over `default`. Empty/missing = none
   * authorized yet, so the prompt falls back to `default`.
   */
  availableSlots?: AvailableConnectionSlots;
}): string {
  const frameworkGuide =
    args.framework === "cargo-ai" ? GUIDANCE_CARGO_AI_PATH : GUIDANCE_PYDANTIC_PATH;
  return [
    `Create an agent at \`${args.agentPath}\` named \`${args.agentName}\` using these docs in the connected repo as your guide:`,
    "",
    `- \`${GUIDANCE_ROOT_PATH}\` — repo conventions`,
    `- \`${GUIDANCE_INDEX_PATH}\` — agent layout and per-framework directories`,
    `- \`${frameworkGuide}\` — framework-specific shape and patterns`,
    `- \`${GUIDANCE_ADDITIONAL_PATH}\` — any customer-specific overrides (read if present)`,
    "",
    `The agent's \`name:\` field must be exactly \`${args.agentName}\` (matching the filename). Don't put the file anywhere other than \`${args.agentPath}\`.`,
    "",
    ...renderAvailableSlots(args.availableSlots),
    "If the agent needs to call external services (Slack, Gmail, Google",
    "Sheets, Notion, GitHub, Linear, HubSpot, etc.), declare them via the",
    "`connections:` field. The slug is whatever Composio uses (lowercase,",
    "no spaces) — see https://composio.dev/toolkits for the full catalog.",
    "Don't restrict yourself to a hand-curated list; if the user's task",
    "needs Gmail, declare it and TAS will surface a Connect button for",
    "it. Don't scaffold provider SDK config, environment variables, or",
    "credential plumbing in the agent file — the runtime injects the",
    "tools once the user authorizes the toolkit in Settings → Connections.",
    "",
    "**Always use the named-slot + narrow-tools form for connections.**",
    "Pick a short name and list the exact tool slugs the agent uses.",
    "If the user has already authorized a slot in this workspace, use",
    "that name (the prompt header above lists them). Use `default` only",
    "when no slot exists for the toolkit yet. Example:",
    "",
    "```yaml",
    "connections:",
    "  - gmail:",
    "      name: default",
    "      tools: [GMAIL_SEND_EMAIL]",
    "  - googlesheets:",
    "      name: default",
    "      tools: [GOOGLESHEETS_BATCH_GET]",
    "```",
    "",
    "Why the named + narrow form is the default:",
    "",
    "- Naming the slot lets users hold multiple accounts of the same",
    "  toolkit (e.g. work + personal Gmail) and have the agent target",
    "  a specific one. Even when the agent uses just one account today,",
    "  declaring `name: default` makes future multi-account refactors",
    "  trivial (rename one slot, add another, agent file stays clean).",
    "- Narrowing tools turns on the DIRECT_TOOLS preset at run time,",
    "  which preloads only the listed tools instead of every action",
    "  Composio supports for that toolkit. That drops input token cost",
    "  by ~10× per run and keeps the model focused on actions you",
    "  actually want it to call.",
    "",
    "Pick the tool slugs from https://composio.dev/toolkits — each",
    "toolkit's page lists the action slugs (UPPER_SNAKE_CASE).",
    "",
    "Connections are per-user: manual runs use the requesting user's",
    "credentials, scheduled runs use the automation's `Run as` owner",
    "(set on the automation form).",
    "",
    "For the agent's `model:` field, prefer `anthropic:claude-opus-4-7`",
    "when the agent declares `connections:` (tool-using agents tend to",
    "hedge on lower-tier models — easier to prove the agent works on",
    "Opus first, then downgrade to Sonnet later as a cost optimisation).",
    "For agents with no tools, `anthropic:claude-sonnet-4-6` is the",
    "right default. See the guide's \"Choosing a model\" section for the",
    "full reasoning.",
    "",
    "---",
    "",
    args.description.trim(),
    "",
    "---",
    "",
    "IMPORTANT: Include this exact line on its own at the end of the pull",
    "request description so the Tembo Agent Studio can correlate the PR",
    "with the user's request:",
    "",
    args.improvementMarker,
  ].join("\n");
}

// Format the "available slots" preamble for the create-agent prompt.
// Returns the prompt-line array (caller spreads it in). Empty input
// returns []  so the prompt falls back to the generic "use `default`"
// guidance further down.
function renderAvailableSlots(
  slots: AvailableConnectionSlots | undefined,
): string[] {
  if (!slots) return [];
  const entries = Object.entries(slots).filter(
    ([, names]) => names.length > 0,
  );
  if (entries.length === 0) return [];
  entries.sort(([a], [b]) => a.localeCompare(b));
  const lines: string[] = [
    "**Connection slots already authorized in this workspace:**",
    "",
  ];
  for (const [toolkit, names] of entries) {
    lines.push(`- \`${toolkit}\`: ${names.map((n) => `\`${n}\``).join(", ")}`);
  }
  lines.push("");
  lines.push(
    "When the agent declares a `connections:` entry for one of these",
  );
  lines.push(
    "toolkits, use the existing slot name (not `default`) so the user",
  );
  lines.push(
    "doesn't have to re-authorize. For a toolkit not listed above, use",
  );
  lines.push("`default` and TAS will surface a Connect button.");
  lines.push("");
  return lines;
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
