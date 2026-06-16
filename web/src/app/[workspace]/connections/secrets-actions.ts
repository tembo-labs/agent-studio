"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { writeAuditEvent } from "@/lib/audit-db";
import { authorizeWorkspace, DENIED_MESSAGE } from "@/lib/auth-server";
import {
  deleteSecretConnection,
  isValidSecretSlug,
  listSecretConnections,
  upsertSecretConnection,
} from "@/lib/secret-connections";

// Server actions for Secrets — the 3rd connection substrate (free-form,
// per-workspace API keys). Writes are workspace_admin-only: a Secret is a
// shared org credential, not a per-user authorization.

export type SecretActionState = {
  message?: string;
  error?: string;
};

/** Add a new Secret or rotate an existing one (set its value). */
export async function setSecretConnectionAction(
  _prev: SecretActionState,
  formData: FormData,
): Promise<SecretActionState> {
  const slugRaw = String(formData.get("workspace") ?? "");
  const name = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();
  const value = String(formData.get("value") ?? "");
  const description = String(formData.get("description") ?? "");

  const auth = await authorizeWorkspace(slugRaw, "workspace_admin");
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId } = auth;

  if (!isValidSecretSlug(name)) {
    return {
      error:
        "Name must be 2–64 chars: lowercase letters, digits, hyphens, or underscores.",
    };
  }
  if (!value.trim()) return { error: "Enter the secret value." };

  const existing = (await listSecretConnections(workspace.id)).some(
    (s) => s.slug === name,
  );

  const result = await upsertSecretConnection({
    workspaceId: workspace.id,
    slug: name,
    value,
    description: description.trim() || null,
    userId,
  });
  if (!result.ok) {
    return {
      error:
        result.error === "bad-slug"
          ? "Invalid secret name."
          : "Enter the secret value.",
    };
  }

  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "human_action",
    kind: existing ? "secret_connection.rotated" : "secret_connection.set",
    targetType: "connection",
    targetId: name,
    agentName: null,
    payload: { slug: name, source: "secret" },
  });

  revalidatePath(`/${slugRaw}/connections`, "layout");
  revalidatePath(`/${slugRaw}`, "layout");
  // Land on the secret's connection view (works for both add and rotate).
  redirect(`/${slugRaw}/connections/secret:${name}`);
}

/** Remove a Secret entirely. */
export async function removeSecretConnectionAction(
  _prev: SecretActionState,
  formData: FormData,
): Promise<SecretActionState> {
  const slugRaw = String(formData.get("workspace") ?? "");
  const name = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();

  const auth = await authorizeWorkspace(slugRaw, "workspace_admin");
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  const { workspace, userId } = auth;

  const ok = await deleteSecretConnection(workspace.id, name);
  if (!ok) return { error: "Secret no longer exists." };

  await writeAuditEvent({
    workspaceId: workspace.id,
    actorUserId: userId,
    source: "human_action",
    kind: "secret_connection.removed",
    targetType: "connection",
    targetId: name,
    agentName: null,
    payload: { slug: name, source: "secret" },
  });

  revalidatePath(`/${slugRaw}/connections`, "layout");
  revalidatePath(`/${slugRaw}`, "layout");
  redirect(`/${slugRaw}/connections`);
}
