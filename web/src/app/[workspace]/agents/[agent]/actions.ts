"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { writeAuditEvent } from "@/lib/audit-db";
import {
  authorizeWorkspace,
  DENIED_MESSAGE,
} from "@/lib/auth-server";
import {
  createTrigger,
  deleteTrigger as deleteTriggerRemote,
  setTriggerEnabledRemote,
} from "@/lib/composio";
import { getComposioConnectionById } from "@/lib/composio-connections";
import { createRun } from "@/lib/runs-api";
import {
  deleteTriggerLocal,
  getTriggerById,
  saveTrigger,
  setTriggerEnabled,
} from "@/lib/triggers-db";
import {
  deleteAgent,
  getAgentByName,
  type DeleteAgentError,
} from "@/lib/workspace-agents";
import {
  getWorkspaceRole,
  getWorkspaceSecretPlaintext,
  getWorkspaceSecretPreview,
} from "@/lib/workspace";

export type DeleteAgentFormState = {
  error?: string;
};

const ERROR_MESSAGES: Record<DeleteAgentError, string> = {
  "no-repo": "Connect a Git repository before deleting an agent.",
  "not-found": "Agent file no longer exists in the repo.",
  "invalid-token":
    "The workspace's stored GitHub token is no longer valid. Reconnect the repo in Settings.",
  "path-exists":
    "Couldn't delete — GitHub reported a conflict. Try again.",
  "branch-protected":
    "The default branch is protected. Ask an admin to relax protections, or use v0.2's chat-to-PR flow.",
  "sha-mismatch":
    "The file changed since this page loaded. Refresh and try again.",
  "rate-limited":
    "GitHub rate-limited that request. Try again in a few minutes.",
  network: "Couldn't reach GitHub. Try again in a moment.",
};

export async function deleteAgentAction(
  _prev: DeleteAgentFormState,
  formData: FormData,
): Promise<DeleteAgentFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const agentName = String(formData.get("agent") ?? "");

  const auth = await authorizeWorkspace(slug, "operator");
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId } = auth;

  const result = await deleteAgent(workspace.id, userId, agentName);
  if (!result.ok) {
    return { error: ERROR_MESSAGES[result.error] };
  }
  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "human_action",
    kind: "agent.deleted",
    targetType: "agent",
    targetId: agentName,
    agentName,
    payload: {},
  });
  revalidatePath(`/${slug}`);
  revalidatePath(`/${slug}/settings`);
  // ?deleted=<name> gives the agents grid two affordances: render a
  // "Deleted {name}" confirmation banner, and defensively filter
  // the named agent out of the listing in case the GitHub fetch
  // cache hasn't propagated the deletion yet (60s TTL on listAgents
  // reads — fine for normal usage, jarring for a just-deleted row).
  redirect(`/${slug}?deleted=${encodeURIComponent(agentName)}`);
}

export type RunNowFormState = {
  error?: string;
};

export async function runNowAction(
  _prev: RunNowFormState,
  formData: FormData,
): Promise<RunNowFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const agentName = String(formData.get("agent") ?? "");
  // Optional user input. Empty preserves the prior behavior (a "no
  // input" run that just exercises the agent's instructions).
  const userMessage = String(formData.get("user_message") ?? "");
  const runAsRaw = String(formData.get("run_as") ?? "").trim();

  const auth = await authorizeWorkspace(slug, "operator");
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId, role } = auth;

  // Admins may run AS another member so the run executes against that
  // member's connections (Composio / Native MCP). Everyone else runs as
  // themselves.
  let actingUserId = userId;
  if (runAsRaw && runAsRaw !== userId) {
    if (role !== "workspace_admin") {
      return { error: "Only workspace admins can run as another member." };
    }
    const targetRole = await getWorkspaceRole(workspace.id, runAsRaw);
    if (!targetRole) {
      return { error: "That user isn't a member of this workspace." };
    }
    actingUserId = runAsRaw;
  }

  // Pull the current agent definition off the repo. Both frameworks
  // are now passthrough — the runner gets the raw file bytes plus
  // the format so the right subprocess wrapper can parse them.
  const found = await getAgentByName(workspace.id, agentName);
  if (!found || !found.agent.ok) {
    return {
      error: found
        ? "This agent's definition file is invalid; fix it before running."
        : "Agent no longer exists in the connected repo.",
    };
  }
  const spec = found.agent.spec;
  const fileFormat = found.agent.format;

  const framework: "pydantic-agentspec" | "cargo-ai" =
    spec.framework === "pydantic-agentspec" ? "pydantic-agentspec" : "cargo-ai";

  if (framework === "cargo-ai" && !spec.model) {
    return {
      error:
        "This Cargo AI agent has no model declared. Add `runtime_vars.model` (e.g. `openai:gpt-4o-mini`) and try again.",
    };
  }

  const model = spec.model ?? "";

  let runId: string;
  try {
    const res = await createRun({
      workspaceId: workspace.id,
      userId: actingUserId,
      agentName: spec.name,
      agentPath: found.agent.path,
      model,
      framework,
      specContent: found.raw,
      specFormat: fileFormat,
      userMessage,
    });
    runId = res.runId;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Couldn't queue the run.",
    };
  }

  revalidatePath(`/${slug}/agents/${encodeURIComponent(spec.name)}`);
  redirect(
    `/${slug}/agents/${encodeURIComponent(spec.name)}/runs/${encodeURIComponent(runId)}`,
  );
}

// ────────────────────────────────────────────────────────────────────
// Triggers (event-driven runs via Composio)
//
// Each action follows the same shape as automation actions: validate
// membership, validate inputs, call Composio + DB, revalidate the
// agent page. Composio is the source of truth for "is this trigger
// subscribed" — we keep our row in lockstep so that disconnecting
// locally always implies a remote delete attempt and vice versa.

export type TriggerFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"connection" | "triggerType" | "config", string>>;
};

const TRIGGER_FORM_EMPTY: TriggerFormState = {};

// Composio's trigger slugs are SCREAMING_SNAKE_CASE (e.g.
// GMAIL_NEW_GMAIL_MESSAGE, SLACKBOT_NEW_MESSAGE). Reject obviously
// malformed input before we round-trip to their API.
const TRIGGER_SLUG_RE = /^[A-Z][A-Z0-9_]*$/;

export async function createTriggerAction(
  _prev: TriggerFormState,
  formData: FormData,
): Promise<TriggerFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const agentName = String(formData.get("agent") ?? "");
  const connectionId = String(formData.get("connection_id") ?? "").trim();
  const triggerType = String(formData.get("trigger_type") ?? "")
    .trim()
    .toUpperCase();
  const configRaw = String(formData.get("trigger_config") ?? "").trim();

  const auth = await authorizeWorkspace(slug, "operator");
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId } = auth;

  const fieldErrors: TriggerFormState["fieldErrors"] = {};
  if (!connectionId) fieldErrors.connection = "Pick a connection.";
  if (!triggerType) {
    fieldErrors.triggerType = "Enter a Composio trigger slug.";
  } else if (!TRIGGER_SLUG_RE.test(triggerType)) {
    fieldErrors.triggerType =
      "Slug must be SCREAMING_SNAKE_CASE (letters, digits, underscores).";
  }
  let parsedConfig: Record<string, unknown> = {};
  if (configRaw.length > 0) {
    try {
      const obj = JSON.parse(configRaw);
      if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
        fieldErrors.config = "Config must be a JSON object (use {} for none).";
      } else {
        parsedConfig = obj as Record<string, unknown>;
      }
    } catch {
      fieldErrors.config = "Config isn't valid JSON.";
    }
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const connection = await getComposioConnectionById(workspace.id, connectionId);
  if (!connection || connection.userId !== userId) {
    return {
      fieldErrors: { connection: "Pick one of your own connections." },
    };
  }

  // Composio API key has to be present — the trigger create call
  // hits their API. The webhook signing secret check happens in the
  // webhook handler (we'd rather create the trigger and let the user
  // realize the secret is missing when an event arrives than block
  // the form here, since the secret can be added later).
  const apiKeyPreview = await getWorkspaceSecretPreview(
    workspace.id,
    "composio_api_key",
  );
  if (!apiKeyPreview) {
    return {
      error:
        "Set a Composio API key in Settings before creating event triggers.",
    };
  }
  const apiKey = await getWorkspaceSecretPlaintext(
    workspace.id,
    "composio_api_key",
  );

  let composioTriggerId: string;
  try {
    const res = await createTrigger({
      apiKey,
      workspaceId: workspace.id,
      userId,
      triggerType,
      connectedAccountId: connection.composioConnectionId,
      triggerConfig: parsedConfig,
    });
    composioTriggerId = res.triggerId;
  } catch (e) {
    const err = e as Error;
    return { error: `Composio rejected the trigger: ${err.message}` };
  }

  const saved = await saveTrigger({
    workspaceId: workspace.id,
    userId,
    agentName,
    composioTriggerId,
    toolkitSlug: connection.toolkit,
    triggerType,
    connectionId: connection.id,
    triggerConfig: parsedConfig,
    createdBy: userId,
  });

  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "human_action",
    kind: "trigger.created",
    targetType: "trigger",
    targetId: saved.id,
    agentName,
    payload: {
      triggerType,
      toolkit: connection.toolkit,
      connectionName: connection.name,
    },
  });

  revalidatePath(`/${slug}/agents/${encodeURIComponent(agentName)}`);
  return TRIGGER_FORM_EMPTY;
}

export type SimpleTriggerActionState = { error?: string };
const SIMPLE_EMPTY: SimpleTriggerActionState = {};

export async function toggleTriggerAction(
  _prev: SimpleTriggerActionState,
  formData: FormData,
): Promise<SimpleTriggerActionState> {
  const slug = String(formData.get("workspace") ?? "");
  const id = String(formData.get("id") ?? "");
  const enabled = formData.get("enabled") === "true";

  const auth = await authorizeWorkspace(slug, "operator");
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId } = auth;

  const trigger = await getTriggerById(workspace.id, id);
  if (!trigger) return { error: "Trigger no longer exists." };

  const apiKey = await getWorkspaceSecretPlaintext(
    workspace.id,
    "composio_api_key",
  );
  const remoteOk = await setTriggerEnabledRemote({
    apiKey,
    triggerId: trigger.composioTriggerId,
    enabled,
  });
  // Toggle locally even on remote failure so the UI reflects intent;
  // the inconsistency is logged and surfaces next time the user
  // disconnects the agent's connection (the trigger is RESTRICTed).
  if (!remoteOk) {
    console.warn(
      `[triggers] composio enable/disable failed for ${trigger.composioTriggerId}, toggling local state anyway`,
    );
  }
  await setTriggerEnabled(workspace.id, id, enabled);
  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "human_action",
    kind: enabled ? "trigger.enabled" : "trigger.disabled",
    targetType: "trigger",
    targetId: id,
    agentName: trigger.agentName,
    payload: { triggerType: trigger.triggerType, toolkit: trigger.toolkitSlug },
  });
  revalidatePath(`/${slug}/agents/${encodeURIComponent(trigger.agentName)}`);
  return SIMPLE_EMPTY;
}

export async function deleteTriggerAction(
  _prev: SimpleTriggerActionState,
  formData: FormData,
): Promise<SimpleTriggerActionState> {
  const slug = String(formData.get("workspace") ?? "");
  const id = String(formData.get("id") ?? "");

  const auth = await authorizeWorkspace(slug, "operator");
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId } = auth;

  const trigger = await getTriggerById(workspace.id, id);
  if (!trigger) return SIMPLE_EMPTY;

  const apiKey = await getWorkspaceSecretPlaintext(
    workspace.id,
    "composio_api_key",
  );
  // Remote delete is best-effort. If it fails we still drop the local
  // row — an orphan on Composio's side is harmless (no local trigger
  // to route the inbound webhook to, so it 200s as "ignored").
  await deleteTriggerRemote({ apiKey, triggerId: trigger.composioTriggerId });
  await deleteTriggerLocal(workspace.id, id);

  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "human_action",
    kind: "trigger.deleted",
    targetType: "trigger",
    targetId: id,
    agentName: trigger.agentName,
    payload: { triggerType: trigger.triggerType, toolkit: trigger.toolkitSlug },
  });

  revalidatePath(`/${slug}/agents/${encodeURIComponent(trigger.agentName)}`);
  return SIMPLE_EMPTY;
}

