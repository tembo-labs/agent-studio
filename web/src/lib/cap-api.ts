import "server-only";

import {
  GUIDANCE_ADDITIONAL_PATH,
  GUIDANCE_CARGO_AI_PATH,
  GUIDANCE_EVE_PATH,
  GUIDANCE_INDEX_PATH,
  GUIDANCE_PYDANTIC_PATH,
  GUIDANCE_ROOT_PATH,
} from "@/lib/agent-guidance";
import type { Framework } from "@/lib/agent-framework";

/** The per-framework guide path for prompt pointers. */
function frameworkGuidePath(framework: Framework): string {
  if (framework === "eve") return GUIDANCE_EVE_PATH;
  if (framework === "cargo-ai") return GUIDANCE_CARGO_AI_PATH;
  return GUIDANCE_PYDANTIC_PATH;
}
import type { CommitMode } from "@/lib/commit-mode-constants";

// Thin client for the Tembo Coding Agent Platform task API. The task
// endpoints live under the **/public-api** namespace and authenticate
// with the workspace's Tembo API key as `Authorization: Bearer` — the
// bare `/task/create` path hits a different internal auth gate that
// rejects the public key ("Invalid token"). POSTs a free-text prompt +
// repo URL to POST /public-api/task/create and returns a task record
// with an htmlUrl the user can follow; the task is what opens the PR.

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

  const url = `${baseUrl}/public-api/task/create`;
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
  if (path.startsWith("agents/eve/")) return "eve";
  return "pydantic-agentspec";
}

// Step-0 block that the coding agent applies BEFORE the requested
// change: refresh the per-framework guidance files in the repo to
// Point Tembo CAP at the guidance files already committed in the
// customer's repo, instead of embedding the full canonical content
// in every prompt. Trades the prior auto-refresh-on-drift guarantee
// for a much smaller prompt; the customer keeps guidance current by
// running "Sync agent guidance" from Settings (or on a schedule, see
// the backlog). We still scope the pointer list to the framework
// this PR touches so Tembo doesn't waste tokens reading the other
// framework's guide.
function buildGuidancePointerBlock(framework: Framework): string {
  const frameworkGuide = frameworkGuidePath(framework);
  return [
    "**Step 1 — Read the agent guidance first**",
    "",
    "The TAS-managed guidance for this repo is committed and treated as",
    "current. Before making the change, read:",
    "",
    `- \`${GUIDANCE_ROOT_PATH}\` — repo entry point`,
    `- \`${GUIDANCE_INDEX_PATH}\` — agent authoring overview`,
    `- \`${frameworkGuide}\` — framework-specific shape and patterns`,
    `- \`${GUIDANCE_ADDITIONAL_PATH}\` — project-specific overrides (read if present)`,
    "",
    "Trust the on-disk content. Don't refresh or overwrite these files;",
    "they're maintained out-of-band.",
  ].join("\n");
}

// The delivery directive — how the agent should ship the change, and where to
// drop the correlation marker. PR mode (the default) opens a pull request with
// the marker in its description; direct ("YOLO") mode commits straight to the
// default branch with the marker in the commit message, so /improvements can
// still correlate the landed change back to the improvement row. Returns the
// prompt-line array; callers spread it in.
function deliveryDirective(
  commitMode: CommitMode,
  defaultBranch: string,
  marker: string,
): string[] {
  if (commitMode === "direct") {
    return [
      `Commit the change directly to the \`${defaultBranch}\` branch. Do not open a pull request.`,
      "",
      "IMPORTANT: Include this exact line on its own in the commit message so",
      "Tembo Agent Studio can correlate the commit with the user's request:",
      "",
      marker,
    ];
  }
  return [
    "Open a pull request with the change.",
    "",
    "IMPORTANT: Include this exact line on its own at the end of the pull",
    "request description so Tembo Agent Studio can correlate the PR with the",
    "user's request:",
    "",
    marker,
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
  /** Free-text display name to write as the spec's `title:`. */
  title: string;
  agentPath: string;
  description: string;
  improvementMarker: string;
  commitMode: CommitMode;
  defaultBranch: string;
  /**
   * Toolkit → authorized slot names for the user creating this
   * agent. When present, the prompt tells Tembo to prefer these
   * concrete slot names over `default`. Empty/missing = none
   * authorized yet, so the prompt falls back to `default`.
   */
  availableSlots?: AvailableConnectionSlots;
  /**
   * Native-MCP provider slug → authorized slot names for the user.
   * Rendered as a separate block from `availableSlots`: native connections
   * must be declared with `source: native-mcp`, and CAP looks up their exact
   * tool slugs at the TAS-served reference (nativeToolsBaseUrl + nativeToolsKey)
   * rather than inline.
   */
  nativeSlots?: AvailableConnectionSlots;
  /** Origin + path of this instance's /for-agents reference, e.g.
   *  "https://tas.example.com/for-agents". */
  nativeToolsBaseUrl?: string;
  /** Signed token CAP appends as `?key=` when fetching the reference. */
  nativeToolsKey?: string;
}): string {
  const frameworkGuide = frameworkGuidePath(args.framework);
  return [
    `Create an agent at \`${args.agentPath}\` named \`${args.agentName}\` using these docs in the connected repo as your guide:`,
    "",
    `- \`${GUIDANCE_ROOT_PATH}\` — repo conventions`,
    `- \`${GUIDANCE_INDEX_PATH}\` — agent layout and per-framework directories`,
    `- \`${frameworkGuide}\` — framework-specific shape and patterns`,
    `- \`${GUIDANCE_ADDITIONAL_PATH}\` — any customer-specific overrides (read if present)`,
    "",
    `The agent's \`name:\` field must be exactly \`${args.agentName}\` (it matches the filename). Also set a \`title:\` field to the human display name "${args.title}" (free text — this is what the UI shows). Don't put the file anywhere other than \`${args.agentPath}\`.`,
    "",
    ...renderAvailableSlots(args.availableSlots),
    ...renderNativeSlots(
      args.nativeSlots,
      args.nativeToolsBaseUrl,
      args.nativeToolsKey,
    ),
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
    "For the agent's `model:` field, prefer `anthropic:claude-opus-4-8`",
    "when the agent declares `connections:` (tool-using agents tend to",
    "hedge on lower-tier models — easier to prove the agent works on",
    "Opus first, then downgrade to Sonnet later as a cost optimisation).",
    "For agents with no tools, `anthropic:claude-sonnet-4-6` is the",
    "right default. For the most demanding reasoning / long-horizon",
    "agentic work, `anthropic:claude-fable-5` is the top tier (~2× Opus",
    "cost — use it only when Opus 4.8 isn't enough). See the guide's",
    "\"Choosing a model\" section for the full reasoning.",
    "",
    "---",
    "",
    args.description.trim(),
    "",
    "---",
    "",
    ...deliveryDirective(
      args.commitMode,
      args.defaultBranch,
      args.improvementMarker,
    ),
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

// Native-MCP slots block. Native connections must be declared with
// `source: native-mcp`; their tool slugs aren't inlined (the catalogs are
// large and provider-specific) — instead CAP fetches a per-provider reference
// served by this TAS instance, authorized by a signed bearer token sent in the
// `Authorization` header. Empty slots, or a missing base/token, returns [].
function renderNativeSlots(
  slots: AvailableConnectionSlots | undefined,
  baseUrl: string | undefined,
  token: string | undefined,
): string[] {
  if (!slots || !baseUrl || !token) return [];
  const entries = Object.entries(slots).filter(([, names]) => names.length > 0);
  if (entries.length === 0) return [];
  entries.sort(([a], [b]) => a.localeCompare(b));
  const [firstProvider, firstNames] = entries[0];
  const lines: string[] = [
    "**Native MCP connection slots already authorized in this workspace:**",
    "",
  ];
  for (const [provider, names] of entries) {
    lines.push(`- \`${provider}\`: ${names.map((n) => `\`${n}\``).join(", ")}`);
  }
  lines.push("");
  lines.push(
    "These talk to the provider's official MCP server. Declare them with",
  );
  lines.push(
    "`source: native-mcp` and the existing slot name above. Before writing the",
  );
  lines.push(
    "`tools:` list, fetch the provider's tool reference (it lists the exact tool",
  );
  lines.push(
    "slugs) and narrow to what you need. Each page requires this HTTP header:",
  );
  lines.push("");
  lines.push(`    Authorization: Bearer ${token}`);
  lines.push("");
  lines.push("Reference pages (one per provider):");
  lines.push("");
  for (const [provider] of entries) {
    lines.push(`- \`${provider}\` → ${baseUrl}/${provider}.md`);
  }
  lines.push("");
  lines.push(
    `e.g. \`curl -H "Authorization: Bearer ${token}" ${baseUrl}/${firstProvider}.md\``,
  );
  lines.push("");
  lines.push("Example:");
  lines.push("");
  lines.push("```yaml");
  lines.push("connections:");
  lines.push(`  - ${firstProvider}:`);
  lines.push("      source: native-mcp");
  lines.push(`      name: ${firstNames[0]}`);
  lines.push("      tools: [<slug-from-the-reference-page>]");
  lines.push("```");
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
  commitMode: CommitMode;
  defaultBranch: string;
  /** Composio toolkit → authorized slot names. Lets CAP add/reference real
   *  slots when the edit touches `connections:`. */
  availableSlots?: AvailableConnectionSlots;
  /** Native-MCP provider slug → authorized slot names. */
  nativeSlots?: AvailableConnectionSlots;
  /** Origin + path of this instance's /for-agents reference. */
  nativeToolsBaseUrl?: string;
  /** Signed token CAP sends as `Authorization: Bearer` to the reference. */
  nativeToolsKey?: string;
}): string {
  const framework = frameworkFromAgentPath(args.agentPath);
  return [
    buildGuidancePointerBlock(framework),
    "",
    "**Step 2 — Requested change**",
    "",
    `Improve the agent defined at @${args.agentPath}.`,
    "",
    ...deliveryDirective(
      args.commitMode,
      args.defaultBranch,
      args.improvementMarker,
    ),
    "",
    // If the edit adds/changes a `connections:` entry, these tell CAP the real
    // authorized slot names + where to look up native-MCP tool slugs.
    ...renderAvailableSlots(args.availableSlots),
    ...renderNativeSlots(
      args.nativeSlots,
      args.nativeToolsBaseUrl,
      args.nativeToolsKey,
    ),
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
  commitMode: CommitMode;
  defaultBranch: string;
}): string {
  const framework = frameworkFromAgentPath(args.agentPath);
  const trimmedOutput = args.output.length > 4000
    ? args.output.slice(0, 4000) + "\n…[truncated]"
    : args.output;

  return [
    buildGuidancePointerBlock(framework),
    "",
    "**Step 2 — Requested change**",
    "",
    `Improve the agent defined at @${args.agentPath}.`,
    "",
    ...deliveryDirective(
      args.commitMode,
      args.defaultBranch,
      args.improvementMarker,
    ),
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
