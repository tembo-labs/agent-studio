import "server-only";

import type { AuthorizeApiSuccess } from "@/lib/api-auth";
import {
  detectFormat,
  parseAgentContent,
  validateAgentName,
  type AgentFileFormat,
} from "@/lib/agent-format";
import { FRAMEWORKS, type Framework } from "@/lib/agent-framework";
import { createAutomation } from "@/lib/automations-api";
import {
  buildChatEditPrompt,
  buildCreateAgentPrompt,
  createTemboTask,
  type AvailableConnectionSlots,
} from "@/lib/cap-api";
import { listConnectionsForUser } from "@/lib/composio-connections";
import {
  findMissingConnections,
  missingConnectionsMessage,
} from "@/lib/connection-checks";
import { validateCron } from "@/lib/cron";
import {
  createImprovement,
  improvementMarker,
  setImprovementCommitted,
  setImprovementTask,
} from "@/lib/improvements-api";
import { createRun } from "@/lib/runs-api";
import { suggestSlug } from "@/lib/slugify";
import {
  getWorkspaceRepo,
  getWorkspaceSecretPlaintext,
} from "@/lib/workspace";
import { getAgentByName, resolveAgentForDispatch } from "@/lib/workspace-agents";

// Shared write-action service layer for BOTH the REST API (/api/v1) and the MCP
// server (/mcp). Each function takes the resolved auth context and returns a
// discriminated union { ok: true, ... } | { ok: false, status, error }. The
// caller maps that to an HTTP status (REST) or an MCP error result (MCP). Role
// gating happens at the caller's auth boundary (REST passes minRole "operator";
// MCP checks ctx.role) — these mirror the equivalent server actions
// (runNowAction, chatSubmitAction, createFromChatAction, createAutomation form).

export type ApiCtx = AuthorizeApiSuccess;

export type ActionFailure = { ok: false; status: number; error: string };

// ── trigger a run ─────────────────────────────────────────────────────

export type TriggerRunInput = {
  agent: string;
  message?: string;
  preferDraft?: boolean;
};

export async function triggerRun(
  ctx: ApiCtx,
  input: TriggerRunInput,
): Promise<{ ok: true; runId: string } | ActionFailure> {
  const dispatch = await resolveAgentForDispatch(ctx.workspace.id, input.agent, {
    preferDraft: input.preferDraft ?? false,
  });
  if (!dispatch.ok) {
    const status = dispatch.error.kind === "not-found" ? 404 : 422;
    return { ok: false, status, error: dispatch.error.message };
  }
  const r = dispatch.resolved;

  // Same pre-flight the UI's Run-now uses: block a run the acting user can't
  // complete (a declared connection they haven't authorized) with an
  // actionable message rather than a mid-run traceback.
  const missing = await findMissingConnections(
    ctx.workspace.id,
    ctx.userId,
    r.connections,
  );
  if (missing.length > 0) {
    return { ok: false, status: 422, error: missingConnectionsMessage(missing, true) };
  }

  try {
    const res = await createRun({
      workspaceId: ctx.workspace.id,
      userId: ctx.userId,
      agentName: r.agentName,
      agentPath: r.agentPath,
      model: r.model,
      framework: r.framework,
      specContent: r.specContent,
      specFormat: r.specFormat,
      toolsModuleContent: r.toolsModuleContent,
      skillsContent: r.skillsContent,
      userMessage: input.message ?? "",
      trigger: "manual",
      agentVersionId: r.versionId,
      agentVersionLabel: r.versionLabel,
    });
    return { ok: true, runId: res.runId };
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error: err instanceof Error ? err.message : "Couldn't queue the run.",
    };
  }
}

// ── validate a spec ───────────────────────────────────────────────────

export type ValidateSpecInput = {
  content: string;
  format?: AgentFileFormat;
  filename?: string;
};

export type ValidateSpecResult =
  | { valid: true; framework: Framework; name: string; format: AgentFileFormat }
  | { valid: false; error: string; detail?: string };

export function validateSpec(
  input: ValidateSpecInput,
): { ok: true; result: ValidateSpecResult } | ActionFailure {
  const format =
    input.format ?? (input.filename ? detectFormat(input.filename) : null);
  if (!format) {
    return {
      ok: false,
      status: 400,
      error: "provide `format` (yaml|json) or a `filename` with a known extension",
    };
  }
  const parsed = parseAgentContent(input.content, format);
  if (!parsed.ok) {
    return { ok: true, result: { valid: false, error: parsed.error, detail: parsed.detail } };
  }
  return {
    ok: true,
    result: {
      valid: true,
      framework: parsed.spec.framework,
      name: parsed.spec.name,
      format: parsed.format,
    },
  };
}

// ── create an automation ──────────────────────────────────────────────

export type CreateAutomationInput = {
  name: string;
  agent: string;
  cron: string;
  inputMessage?: string;
  enabled?: boolean;
  useDraft?: boolean;
};

export async function createAutomationFor(
  ctx: ApiCtx,
  input: CreateAutomationInput,
): Promise<{ ok: true; automation: Awaited<ReturnType<typeof createAutomation>> } | ActionFailure> {
  if (!input.name.trim()) return { ok: false, status: 400, error: "name is required" };
  if (!input.agent.trim()) return { ok: false, status: 400, error: "agent is required" };

  const cron = validateCron(input.cron);
  if (!cron.ok) return { ok: false, status: 400, error: cron.error };

  // The agent must exist so we don't schedule a run that can never resolve.
  const agent = await getAgentByName(ctx.workspace.id, input.agent);
  if (!agent) return { ok: false, status: 404, error: `agent "${input.agent}" not found` };

  const automation = await createAutomation({
    workspaceId: ctx.workspace.id,
    name: input.name.trim(),
    agentName: input.agent,
    cron: input.cron,
    inputMessage: input.inputMessage ?? "",
    enabled: input.enabled ?? true,
    userId: ctx.userId,
    useDraft: input.useDraft ?? false,
  });
  return { ok: true, automation };
}

// ── request an agent change via the Tembo Coding Agent ────────────────

export type RequestAgentChangeInput = {
  /** Existing agent to edit (its declared name). Omit to create a new agent. */
  agent?: string;
  /** New agent display name (free text). Required when `agent` is omitted. */
  name?: string;
  /** Framework for a new agent. Defaults to pydantic-agentspec. */
  framework?: Framework;
  /** What to change / what the new agent should do. */
  description: string;
};

export type RequestAgentChangeResult = {
  improvementId: string;
  taskId: string;
  htmlUrl: string;
  status: string;
  kind: "edit" | "create";
  agentPath: string;
};

const FRAMEWORK_PATH: Record<Framework, { dir: string; ext: AgentFileFormat }> = {
  "pydantic-agentspec": { dir: "pydantic-agentspec", ext: "yaml" },
  "cargo-ai": { dir: "cargo-ai", ext: "json" },
};

export async function requestAgentChange(
  ctx: ApiCtx,
  input: RequestAgentChangeInput,
): Promise<{ ok: true; result: RequestAgentChangeResult } | ActionFailure> {
  const description = input.description.trim();
  if (!description) {
    return { ok: false, status: 400, error: "description is required" };
  }

  const repo = await getWorkspaceRepo(ctx.workspace.id);
  if (!repo) {
    return { ok: false, status: 409, error: "no repository connected to this workspace" };
  }
  const apiKey = await getWorkspaceSecretPlaintext(ctx.workspace.id, "tembo_api_key");
  if (!apiKey) {
    return {
      ok: false,
      status: 409,
      error: "no Tembo API key set for this workspace (Settings → Tembo Coding Agent)",
    };
  }
  const repositoryUrl = `https://github.com/${repo.owner}/${repo.name}`;

  let kind: "edit" | "create";
  let agentName: string;
  let agentPath: string;
  let prompt: string;

  if (input.agent) {
    // Edit an existing agent.
    const found = await getAgentByName(ctx.workspace.id, input.agent);
    if (!found) return { ok: false, status: 404, error: `agent "${input.agent}" not found` };
    if (!found.agent.ok) {
      return {
        ok: false,
        status: 422,
        error: `agent file failed to parse: ${found.agent.error}`,
      };
    }
    kind = "edit";
    agentName = found.agent.spec.name;
    agentPath = found.agent.path;
    const row = await createImprovement({
      workspaceId: ctx.workspace.id,
      runId: null,
      agentName,
      agentPath,
      improvementText: description,
      delivery: ctx.workspace.commitMode,
      userId: ctx.userId,
    });
    prompt = buildChatEditPrompt({
      agentPath,
      improvement: description,
      improvementMarker: improvementMarker(row.id),
      commitMode: ctx.workspace.commitMode,
      defaultBranch: repo.defaultBranch,
    });
    return finishTask({ ctx, apiKey, repositoryUrl, repo, rowId: row.id, prompt, kind, agentPath });
  }

  // Create a new agent.
  const displayName = (input.name ?? "").trim();
  if (!displayName) {
    return { ok: false, status: 400, error: "name is required to create a new agent" };
  }
  const framework: Framework = input.framework ?? "pydantic-agentspec";
  if (!(FRAMEWORKS as readonly string[]).includes(framework)) {
    return { ok: false, status: 400, error: `unknown framework "${framework}"` };
  }
  const agentSlug = suggestSlug(displayName);
  if (!validateAgentName(agentSlug)) {
    return { ok: false, status: 400, error: "name must yield a valid slug (2+ alphanumerics)" };
  }
  const collision = await getAgentByName(ctx.workspace.id, agentSlug);
  if (collision) {
    return { ok: false, status: 409, error: `an agent named "${agentSlug}" already exists` };
  }

  const { dir, ext } = FRAMEWORK_PATH[framework];
  kind = "create";
  agentName = agentSlug;
  agentPath = `agents/${dir}/${agentSlug}.${ext}`;

  const row = await createImprovement({
    workspaceId: ctx.workspace.id,
    runId: null,
    agentName: agentSlug,
    agentPath,
    improvementText: description,
    kind: "create",
    delivery: ctx.workspace.commitMode,
    userId: ctx.userId,
  });

  // Surface the user's authorized connection slots so the coding agent writes
  // real slot names instead of `default` (it reads the repo, not the TAS DB).
  const myConnections = await listConnectionsForUser(ctx.workspace.id, ctx.userId);
  const availableSlots: AvailableConnectionSlots = {};
  for (const c of myConnections) {
    if (c.status !== "ACTIVE") continue;
    (availableSlots[c.toolkit] ??= []).push(c.name);
  }

  prompt = buildCreateAgentPrompt({
    framework,
    agentName: agentSlug,
    title: displayName,
    agentPath,
    description,
    improvementMarker: improvementMarker(row.id),
    commitMode: ctx.workspace.commitMode,
    defaultBranch: repo.defaultBranch,
    availableSlots,
  });
  return finishTask({ ctx, apiKey, repositoryUrl, repo, rowId: row.id, prompt, kind, agentPath });
}

/** Shared tail: POST the task to CAP, record it on the improvement row, return. */
async function finishTask(args: {
  ctx: ApiCtx;
  apiKey: string;
  repositoryUrl: string;
  repo: { defaultBranch: string };
  rowId: string;
  prompt: string;
  kind: "edit" | "create";
  agentPath: string;
}): Promise<{ ok: true; result: RequestAgentChangeResult } | ActionFailure> {
  const res = await createTemboTask({
    apiKey: args.apiKey,
    input: {
      prompt: args.prompt,
      repositoryUrl: args.repositoryUrl,
      targetBranch: args.repo.defaultBranch,
    },
  });
  if (!res.ok) {
    const status = res.error.kind === "http" && (res.error.status === 401 || res.error.status === 403)
      ? 502
      : 502;
    return { ok: false, status, error: `Tembo Coding Agent rejected the request (${res.error.kind})` };
  }

  if (args.ctx.workspace.commitMode === "direct") {
    await setImprovementCommitted({
      id: args.rowId,
      temboTaskId: res.result.taskId,
      temboTaskHtmlUrl: res.result.htmlUrl,
    });
  } else {
    await setImprovementTask({
      id: args.rowId,
      temboTaskId: res.result.taskId,
      temboTaskHtmlUrl: res.result.htmlUrl,
    });
  }

  return {
    ok: true,
    result: {
      improvementId: args.rowId,
      taskId: res.result.taskId,
      htmlUrl: res.result.htmlUrl,
      status: res.result.status,
      kind: args.kind,
      agentPath: args.agentPath,
    },
  };
}
