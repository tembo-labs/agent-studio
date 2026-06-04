"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { writeAuditEvent } from "@/lib/audit-db";
import {
  authorizeWorkspace as authorizeWorkspaceShared,
  DENIED_MESSAGE,
} from "@/lib/auth-server";
import { deleteRemoteConnection } from "@/lib/composio";
import {
  deleteComposioConnection,
  getComposioConnectionById,
  renameComposioConnection,
} from "@/lib/composio-connections";
import { fetchComposioToolkitTools } from "@/lib/composio-tools";
import {
  deleteToolsForConnection,
  replaceToolsForConnection,
} from "@/lib/mcp-tools";
import { isWorkspaceRole, type WorkspaceRole } from "@/lib/rbac";
import {
  refreshAllGuidanceFiles,
  restoreAgent,
  type RestoreAgentError,
} from "@/lib/workspace-agents";
import { getPublicOrigin } from "@/lib/config";
import { getInstanceName } from "@/lib/instance-settings";
import { createInvitation, revokeInvitation } from "@/lib/invitations";
import {
  changeMemberRole,
  DEFAULT_FAVICON_KINDS,
  deleteWorkspace,
  disconnectWorkspaceRepo,
  getWorkspaceSecretPlaintext,
  getWorkspaceSecretPreview,
  removeWorkspaceMember,
  removeWorkspaceSecret,
  setFaviconCustom,
  setFaviconDefault,
  setWorkspaceSecret,
  type FaviconKind,
  type SetFaviconError,
  type SetWorkspaceSecretError,
  type WorkspaceSecretKind,
} from "@/lib/workspace";

// Keep the union narrow — only kinds the settings UI lets you manage
// land here. The repo-connect flow writes github_pat; the runtime stores
// keys through this surface only.
type SettingsKind = Extract<
  WorkspaceSecretKind,
  | "tembo_api_key"
  | "anthropic_api_key"
  | "openai_api_key"
  | "composio_api_key"
  | "composio_webhook_secret"
>;

const SETTINGS_KIND_LABELS: Record<SettingsKind, string> = {
  tembo_api_key: "Tembo API key",
  anthropic_api_key: "Anthropic API key",
  openai_api_key: "OpenAI API key",
  composio_api_key: "Composio API key",
  composio_webhook_secret: "Composio webhook secret",
};

function isSettingsKind(v: string): v is SettingsKind {
  return (
    v === "tembo_api_key" ||
    v === "anthropic_api_key" ||
    v === "openai_api_key" ||
    v === "composio_api_key" ||
    v === "composio_webhook_secret"
  );
}

export type SecretFormState = {
  message?: string;
  error?: string;
};

function saveErrorMessage(
  kind: SettingsKind,
  err: SetWorkspaceSecretError,
): string {
  const label = SETTINGS_KIND_LABELS[kind];
  switch (err) {
    case "empty":
      return `Please paste your ${label}.`;
    case "too-short":
      return `That key looks too short to be a ${label}.`;
    case "too-long":
      return `That key is longer than we expected. Double-check what you pasted.`;
    case "bad-prefix":
      return `That doesn't look like a ${label} — check that you copied the whole key from the provider's developer console.`;
  }
}

// Authorize for a settings mutation. Default minRole is
// workspace_admin — every operation in this file touches workspace
// configuration. Operator-tier surfaces (own-connection rename /
// disconnect, agent restore) override at the call site.
//
// Returns the workspace + actor on success. On no-session /
// no-workspace we 404 (don't leak existence). On denial the caller
// surfaces DENIED_MESSAGE in its form state — never silent.
async function authorizeWorkspace(
  slug: string,
  minRole: WorkspaceRole = "workspace_admin",
) {
  const auth = await authorizeWorkspaceShared(slug, minRole);
  if (!auth.ok) {
    if (auth.reason === "denied") return { denied: true as const };
    notFound();
  }
  return {
    denied: false as const,
    workspace: auth.workspace,
    userId: auth.userId,
    role: auth.role,
  };
}

export async function saveSecretAction(
  _prev: SecretFormState,
  formData: FormData,
): Promise<SecretFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const kindRaw = String(formData.get("kind") ?? "");
  const apiKey = String(formData.get("apiKey") ?? "");

  if (!isSettingsKind(kindRaw)) {
    return { error: "Unsupported secret kind." };
  }
  const kind: SettingsKind = kindRaw;

  const auth = await authorizeWorkspace(slug, "workspace_admin");
  if (auth.denied) return { error: DENIED_MESSAGE };
  const { workspace, userId } = auth;
  const existing = await getWorkspaceSecretPreview(workspace.id, kind);
  const result = await setWorkspaceSecret(workspace.id, kind, apiKey);
  if (!result.ok) {
    return { error: saveErrorMessage(kind, result.error) };
  }

  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "human_action",
    kind: existing ? "secret.rotated" : "secret.set",
    targetType: "secret",
    targetId: kind,
    agentName: null,
    payload: { secretKind: kind },
  });

  revalidatePath(`/${slug}/settings`);
  // Layout-level so the sidebar's "Action needed" LLM-key CTA toggles
  // without a manual refresh — it lives in the workspace layout, which
  // a page-only revalidate wouldn't re-render.
  revalidatePath(`/${slug}`, "layout");
  return { message: `${SETTINGS_KIND_LABELS[kind]} saved.` };
}

export async function removeSecretAction(
  _prev: SecretFormState,
  formData: FormData,
): Promise<SecretFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const kindRaw = String(formData.get("kind") ?? "");

  if (!isSettingsKind(kindRaw)) {
    return { error: "Unsupported secret kind." };
  }
  const kind: SettingsKind = kindRaw;

  const auth = await authorizeWorkspace(slug, "workspace_admin");
  if (auth.denied) return { error: DENIED_MESSAGE };
  const { workspace, userId } = auth;
  await removeWorkspaceSecret(workspace.id, kind);

  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "human_action",
    kind: "secret.removed",
    targetType: "secret",
    targetId: kind,
    agentName: null,
    payload: { secretKind: kind },
  });

  revalidatePath(`/${slug}/settings`);
  // Layout-level so the sidebar's "Action needed" LLM-key CTA appears
  // immediately after the last provider key is removed.
  revalidatePath(`/${slug}`, "layout");
  return { message: `${SETTINGS_KIND_LABELS[kind]} removed.` };
}

export type DisconnectRepoFormState = {
  message?: string;
};

export type RestoreAgentFormState = {
  message?: string;
  error?: string;
};

const RESTORE_ERROR_MESSAGES: Record<RestoreAgentError, string> = {
  "no-repo": "Connect a Git repository before restoring an agent.",
  "not-found": "That deletion record no longer exists.",
  "already-restored": "Already restored.",
  "invalid-token":
    "The workspace's stored GitHub token is no longer valid. Reconnect the repo in Settings.",
  "path-exists":
    "An agent with the same filename exists. Delete or rename the live one first.",
  "branch-protected":
    "The default branch is protected. Ask an admin to relax protections or use v0.2's chat-to-PR flow.",
  "rate-limited":
    "GitHub rate-limited that request. Try again in a few minutes.",
  network: "Couldn't reach GitHub. Try again in a moment.",
};

export async function restoreAgentAction(
  _prev: RestoreAgentFormState,
  formData: FormData,
): Promise<RestoreAgentFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const deletionId = String(formData.get("deletionId") ?? "");

  const auth = await authorizeWorkspace(slug, "operator");
  if (auth.denied) return { error: DENIED_MESSAGE };
  const { workspace, userId } = auth;
  const result = await restoreAgent(workspace.id, userId, deletionId);
  if (!result.ok) {
    return { error: RESTORE_ERROR_MESSAGES[result.error] };
  }
  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "human_action",
    kind: "agent.restored",
    targetType: "agent",
    targetId: result.agentName,
    agentName: result.agentName,
    payload: { deletionId },
  });
  revalidatePath(`/${slug}/settings`);
  revalidatePath(`/${slug}`);
  return { message: `Restored ${result.agentName}.` };
}

export type FaviconFormState = {
  message?: string;
  error?: string;
};

const FAVICON_ERROR_MESSAGES: Record<SetFaviconError, string> = {
  "no-workspace": "Workspace not found.",
  empty: "Pick a file to upload.",
  "too-large":
    "Favicons must be 200 KB or smaller. Compress the image and try again.",
  "unsupported-mime":
    "Use PNG, SVG, or ICO. Other formats aren't supported for favicons.",
};

function isDefaultFaviconKind(
  v: string,
): v is Exclude<FaviconKind, "custom"> {
  return (DEFAULT_FAVICON_KINDS as readonly string[]).includes(v);
}

export async function setFaviconDefaultAction(
  _prev: FaviconFormState,
  formData: FormData,
): Promise<FaviconFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const kindRaw = String(formData.get("kind") ?? "");
  if (!isDefaultFaviconKind(kindRaw)) {
    return { error: "Unknown favicon kind." };
  }

  const auth = await authorizeWorkspace(slug, "workspace_admin");
  if (auth.denied) return { error: DENIED_MESSAGE };
  const { workspace } = auth;
  const result = await setFaviconDefault(workspace.id, kindRaw);
  if (!result.ok) {
    return { error: FAVICON_ERROR_MESSAGES[result.error] };
  }
  revalidatePath(`/${slug}/settings`);
  revalidatePath(`/${slug}`);
  return { message: "Favicon updated." };
}

export async function uploadFaviconAction(
  _prev: FaviconFormState,
  formData: FormData,
): Promise<FaviconFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: FAVICON_ERROR_MESSAGES.empty };
  }

  const auth = await authorizeWorkspace(slug, "workspace_admin");
  if (auth.denied) return { error: DENIED_MESSAGE };
  const { workspace } = auth;
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await setFaviconCustom(workspace.id, {
    bytes: buffer,
    mime: file.type || "application/octet-stream",
  });
  if (!result.ok) {
    return { error: FAVICON_ERROR_MESSAGES[result.error] };
  }
  revalidatePath(`/${slug}/settings`);
  revalidatePath(`/${slug}`);
  return { message: "Custom favicon uploaded." };
}

export async function disconnectRepoAction(
  _prev: DisconnectRepoFormState,
  formData: FormData,
): Promise<DisconnectRepoFormState & { error?: string }> {
  const slug = String(formData.get("workspace") ?? "");
  const auth = await authorizeWorkspace(slug, "workspace_admin");
  if (auth.denied) return { message: undefined, error: DENIED_MESSAGE };
  const { workspace, userId } = auth;
  await disconnectWorkspaceRepo(workspace.id);

  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "human_action",
    kind: "repo.disconnected",
    targetType: "workspace",
    targetId: null,
    agentName: null,
    payload: {},
  });

  revalidatePath(`/${slug}/settings`);
  revalidatePath(`/${slug}`);
  return { message: "Repository disconnected." };
}

export type DisconnectComposioConnectionFormState = {
  message?: string;
  error?: string;
};

/**
 * Disconnect a Composio-managed connection. We try to revoke it
 * on Composio's side first, then drop the local cache row. If the
 * remote revoke fails (key removed, Composio down, etc.) we still
 * drop the local row — a stale orphan in Composio is harmless; the
 * user expects the in-app state to reflect what they just clicked.
 */
export async function disconnectComposioConnectionAction(
  _prev: DisconnectComposioConnectionFormState,
  formData: FormData,
): Promise<DisconnectComposioConnectionFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const connectionId = String(formData.get("connectionId") ?? "");
  if (!connectionId) {
    return { error: "Missing connection id." };
  }

  const auth = await authorizeWorkspace(slug, "operator");
  if (auth.denied) return { error: DENIED_MESSAGE };
  const { workspace, userId } = auth;
  const row = await getComposioConnectionById(workspace.id, connectionId);
  if (!row) {
    return { error: "Connection not found." };
  }

  // Best-effort remote revoke. Needs the workspace's Composio key;
  // if the workspace already removed it we skip the remote step and
  // just clean up locally.
  const preview = await getWorkspaceSecretPreview(workspace.id, "composio_api_key");
  if (preview) {
    const apiKey = await getWorkspaceSecretPlaintext(
      workspace.id,
      "composio_api_key",
    );
    await deleteRemoteConnection({
      apiKey,
      connectedAccountId: row.composioConnectionId,
    });
  }
  await deleteComposioConnection(workspace.id, connectionId);

  // Drop the cached tool catalog for this slot too — a future
  // reconnect under the same (toolkit, name) starts fresh.
  await deleteToolsForConnection({
    workspaceId: workspace.id,
    userId: row.userId,
    source: "composio",
    provider: row.toolkit,
    connectionName: row.name,
  });

  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "human_action",
    kind: "connection.disconnected",
    targetType: "connection",
    targetId: connectionId,
    agentName: null,
    payload: { toolkit: row.toolkit, name: row.name },
  });

  revalidatePath(`/${slug}/settings`);
  revalidatePath(`/${slug}/connections`, "layout");
  return { message: "Connection removed." };
}

export type RefreshComposioToolsFormState = {
  message?: string;
  error?: string;
};

const REFRESH_COMPOSIO_TOOLS_EMPTY: RefreshComposioToolsFormState = {};

/**
 * Re-fetch Composio's curated tool list for a connection and
 * replace the cached rows. Owner of the connection (operator+) can
 * refresh their own; workspace_admin can refresh anyone's. Mirrors
 * the native-MCP refresh action.
 */
export async function refreshComposioToolsAction(
  _prev: RefreshComposioToolsFormState,
  formData: FormData,
): Promise<RefreshComposioToolsFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const connectionId = String(formData.get("connectionId") ?? "");
  if (!connectionId) return { error: "Missing connection id." };

  const auth = await authorizeWorkspace(slug, "operator");
  if (auth.denied) return { error: DENIED_MESSAGE };
  const { workspace, userId, role } = auth;

  const row = await getComposioConnectionById(workspace.id, connectionId);
  if (!row) return { error: "Connection not found." };
  if (role !== "workspace_admin" && row.userId !== userId) {
    return { error: DENIED_MESSAGE };
  }

  const preview = await getWorkspaceSecretPreview(workspace.id, "composio_api_key");
  if (!preview) {
    return {
      error: "Set the workspace Composio API key in Settings first.",
    };
  }
  const apiKey = await getWorkspaceSecretPlaintext(
    workspace.id,
    "composio_api_key",
  );

  try {
    const tools = await fetchComposioToolkitTools(apiKey, row.toolkit);
    await replaceToolsForConnection({
      workspaceId: workspace.id,
      userId: row.userId,
      source: "composio",
      provider: row.toolkit,
      connectionName: row.name,
      tools: tools.map((t) => ({
        slug: t.slug,
        displayName: t.name,
        description: t.description,
      })),
    });
  } catch (e) {
    return { error: `Refresh failed: ${(e as Error).message.slice(0, 160)}` };
  }

  revalidatePath(`/${slug}/connections`, "layout");
  return { message: "Tools refreshed." };
}

export type RenameComposioConnectionFormState = {
  message?: string;
  error?: string;
};

/**
 * Rename a Composio connection slot. Updates only TAS's local
 * `name` column; Composio doesn't know about it. The caller is
 * responsible for telling the user that agent specs referencing
 * the old name need updating in lockstep.
 */
export async function renameComposioConnectionAction(
  _prev: RenameComposioConnectionFormState,
  formData: FormData,
): Promise<RenameComposioConnectionFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const connectionId = String(formData.get("connectionId") ?? "");
  const newName = String(formData.get("newName") ?? "");
  if (!connectionId) return { error: "Missing connection id." };

  const auth = await authorizeWorkspace(slug, "operator");
  if (auth.denied) return { error: DENIED_MESSAGE };
  const { workspace, userId, role } = auth;
  const existing = await getComposioConnectionById(workspace.id, connectionId);
  if (!existing) return { error: "Connection not found." };
  // Operators may only rename their own connections; workspace admins
  // may rename any member's (matches the native-MCP rename gate).
  if (role !== "workspace_admin" && existing.userId !== userId) {
    return { error: DENIED_MESSAGE };
  }
  const result = await renameComposioConnection(
    workspace.id,
    connectionId,
    newName,
  );
  if (!result.ok) {
    switch (result.error) {
      case "bad-name-shape":
        return {
          error:
            "Use lowercase letters, digits, hyphens, or underscores only (e.g. work, customer-support).",
        };
      case "name-taken":
        return {
          error:
            "You already have a connection of this toolkit with that name — pick a different one.",
        };
      case "not-found":
        return { error: "Connection not found." };
    }
  }

  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "human_action",
    kind: "connection.renamed",
    targetType: "connection",
    targetId: connectionId,
    agentName: null,
    payload: {
      toolkit: existing?.toolkit ?? null,
      oldName: existing?.name ?? null,
      newName: newName.trim().toLowerCase(),
    },
  });

  revalidatePath(`/${slug}/settings`);
  revalidatePath(`/${slug}/connections`, "layout");
  return { message: "Renamed." };
}

export type SyncGuidanceFormState = {
  message?: string;
  error?: string;
};

// Manual trigger for refreshAllGuidanceFiles. Used by the "Sync
// agent guidance" button in Settings so a workspace whose agents
// were hand-committed (and therefore never went through the agent-
// creation bootstrap) can get the guidance files written in one
// click. Idempotent — safe to click repeatedly.
export async function syncGuidanceAction(
  _prev: SyncGuidanceFormState,
  formData: FormData,
): Promise<SyncGuidanceFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const auth = await authorizeWorkspace(slug, "workspace_admin");
  if (auth.denied) return { error: DENIED_MESSAGE };
  const { workspace } = auth;
  const result = await refreshAllGuidanceFiles(workspace.id);
  if (!result.ok) {
    if (result.error === "no-repo") {
      return { error: "Connect a Git repository first." };
    }
    return { error: result.error };
  }
  return {
    message:
      "Synced agents/AGENTS.md and the per-framework AGENT_GUIDE.md files. Check the repo for new commits.",
  };
}

// ─────────────────────────────────────────────────────────────────────
// Members (US-0.4-02)

export type MemberFormState = {
  message?: string;
  error?: string;
  /** Copy-paste invite text, set after a successful invitation. */
  template?: string;
  invitedEmail?: string;
};

const MEMBER_EMPTY: MemberFormState = {};

/**
 * Add a workspace member by email. Workspace-admin only. The
 * invitee must have signed in to TAS at least once so a user row
 * exists; we don't email invitations from TAS itself today.
 */
export async function inviteMemberAction(
  _prev: MemberFormState,
  formData: FormData,
): Promise<MemberFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "").trim();

  if (!email) return { error: "Enter an email address." };
  if (!isWorkspaceRole(roleRaw)) return { error: "Pick a role." };
  const role: WorkspaceRole = roleRaw;

  const auth = await authorizeWorkspace(slug, "workspace_admin");
  if (auth.denied) return { error: DENIED_MESSAGE };
  const { workspace, userId } = auth;

  const result = await createInvitation(workspace.id, email, role, userId);
  if (!result.ok) {
    switch (result.error) {
      case "bad-email":
        return { error: "That doesn't look like a valid email address." };
      case "bad-role":
        return { error: "Pick a role." };
      case "already-member":
        return {
          error:
            "That person is already a member. Change their role on the member row instead.",
        };
      case "already-invited":
        return { error: "That email already has a pending invitation." };
    }
  }

  // Existing account → added straight to the workspace, no invite to send.
  if (result.joinedDirectly) {
    revalidatePath(`/${slug}/settings`);
    return { message: `Added ${email} to the workspace.`, invitedEmail: email };
  }

  // Build the copy-paste invite (no email infra yet — the admin sends it).
  const [instanceName] = await Promise.all([getInstanceName()]);
  const origin = getPublicOrigin();
  const template = [
    `You've been invited to the "${workspace.name}" workspace on ${instanceName}.`,
    ``,
    `To join, sign in with this email (${email}) at:`,
    origin,
    ``,
    `You'll be added automatically on your first sign-in.`,
  ].join("\n");

  revalidatePath(`/${slug}/settings`);
  return {
    message: `Invited ${email}.`,
    template,
    invitedEmail: email,
  };
}

// Plain form action (fire-and-forget) so it can be used directly in a
// server-rendered <form action={...}> on each pending-invite row.
export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("workspace") ?? "");
  const invitationId = String(formData.get("invitationId") ?? "");

  const auth = await authorizeWorkspace(slug, "workspace_admin");
  if (auth.denied) return;

  await revokeInvitation(invitationId, auth.workspace.id);
  revalidatePath(`/${slug}/settings`);
}

/**
 * Change an existing member's role. Workspace-admin only. Blocks
 * demoting the last admin — the lib helper enforces this.
 */
export async function changeMemberRoleAction(
  _prev: MemberFormState,
  formData: FormData,
): Promise<MemberFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const targetUserId = String(formData.get("user_id") ?? "").trim();
  const newRoleRaw = String(formData.get("role") ?? "").trim();
  if (!targetUserId) return { error: "Missing user id." };
  if (!isWorkspaceRole(newRoleRaw)) return { error: "Pick a role." };
  const newRole: WorkspaceRole = newRoleRaw;

  const auth = await authorizeWorkspace(slug, "workspace_admin");
  if (auth.denied) return { error: DENIED_MESSAGE };
  const { workspace, userId } = auth;

  const result = await changeMemberRole(workspace.id, targetUserId, newRole);
  if (!result.ok) {
    switch (result.error) {
      case "not-found":
        return { error: "Member no longer exists in this workspace." };
      case "last-admin":
        return {
          error:
            "Can't demote the last workspace admin. Promote someone else first.",
        };
    }
  }

  if (result.previousRole !== result.newRole) {
    await writeAuditEvent({
      workspaceId: workspace.id,
      actorUserId: userId,
      source: "policy_change",
      kind: "member.role_changed",
      targetType: "member",
      targetId: targetUserId,
      agentName: null,
      payload: {
        target: result.target,
        previousRole: result.previousRole,
        newRole: result.newRole,
      },
    });
  }

  revalidatePath(`/${slug}/settings`);
  return MEMBER_EMPTY;
}

/**
 * Remove a member from a workspace. Workspace-admin only. Blocks
 * removing the last admin.
 */
export async function removeMemberAction(
  _prev: MemberFormState,
  formData: FormData,
): Promise<MemberFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const targetUserId = String(formData.get("user_id") ?? "").trim();
  if (!targetUserId) return { error: "Missing user id." };

  const auth = await authorizeWorkspace(slug, "workspace_admin");
  if (auth.denied) return { error: DENIED_MESSAGE };
  const { workspace, userId } = auth;

  const result = await removeWorkspaceMember(workspace.id, targetUserId);
  if (!result.ok) {
    switch (result.error) {
      case "not-found":
        return { error: "Member no longer exists in this workspace." };
      case "last-admin":
        return {
          error:
            "Can't remove the last workspace admin. Promote someone else first.",
        };
    }
  }

  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "policy_change",
    kind: "member.removed",
    targetType: "member",
    targetId: targetUserId,
    agentName: null,
    payload: {
      target: result.target,
      previousRole: result.previousRole,
    },
  });

  revalidatePath(`/${slug}/settings`);
  return MEMBER_EMPTY;
}

// ─────────────────────────────────────────────────────────────────────
// Danger zone — delete workspace

export type DeleteWorkspaceState = { error?: string };

/**
 * Permanently delete a workspace. Workspace-admin only, and the caller
 * must type the workspace name exactly to confirm. On success we redirect
 * to `/` — the workspace and all its data (including audit rows) are gone,
 * so there's nothing left to audit or revalidate in place.
 */
export async function deleteWorkspaceAction(
  _prev: DeleteWorkspaceState,
  formData: FormData,
): Promise<DeleteWorkspaceState> {
  const slug = String(formData.get("workspace") ?? "");
  const confirm = String(formData.get("confirm") ?? "").trim();

  const auth = await authorizeWorkspace(slug, "workspace_admin");
  if (auth.denied) return { error: DENIED_MESSAGE };
  const { workspace } = auth;

  if (confirm !== workspace.name) {
    return { error: "Type the workspace name exactly to confirm." };
  }

  await deleteWorkspace(workspace.id);
  redirect("/");
}
