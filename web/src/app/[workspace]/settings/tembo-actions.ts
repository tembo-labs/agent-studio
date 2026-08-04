"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { writeAuditEvent } from "@/lib/audit-db";
import { authorizeWorkspace, DENIED_MESSAGE } from "@/lib/auth-server";
import { validateTemboApiKey } from "@/lib/cap-api";
import {
  removePersonalTemboCredential,
  setPersonalTemboCredential,
} from "@/lib/tembo-credentials";
import {
  getWorkspaceSecretPlaintext,
  getWorkspaceSecretPreview,
} from "@/lib/workspace";

export type PersonalTemboFormState = {
  message?: string;
  error?: string;
};

export async function savePersonalTemboKeyAction(
  _previous: PersonalTemboFormState,
  formData: FormData,
): Promise<PersonalTemboFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const auth = await authorizeWorkspace(slug);
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  if (apiKey.length < 16 || apiKey.length > 512) {
    return { error: "Paste a complete Tembo API key." };
  }

  const identity = await validateTemboApiKey(apiKey);
  if (!identity.ok) {
    return {
      error:
        identity.error === "invalid"
          ? "Tembo rejected that API key. Check that it is active and try again."
          : "Could not validate that key with Tembo. Try again in a moment.",
    };
  }

  const fallbackPreview = await getWorkspaceSecretPreview(
    auth.workspace.id,
    "tembo_api_key",
  );
  if (fallbackPreview) {
    const fallbackKey = await getWorkspaceSecretPlaintext(
      auth.workspace.id,
      "tembo_api_key",
    );
    const fallbackIdentity = await validateTemboApiKey(fallbackKey);
    if (fallbackIdentity.ok && fallbackIdentity.orgId !== identity.orgId) {
      return {
        error:
          "That Tembo account belongs to a different organization than this workspace's fallback account.",
      };
    }
  }

  await setPersonalTemboCredential(auth.workspace.id, auth.userId, apiKey, {
    userId: identity.userId,
    orgId: identity.orgId,
  });
  await writeAuditEvent({
    workspaceId: auth.workspace.id,
    actorUserId: auth.userId,
    source: "human_action",
    kind: "tembo.personal_connected",
    targetType: "user",
    targetId: auth.userId,
    agentName: null,
    payload: {},
  });
  revalidatePath(`/${slug}/settings/tembo`);
  revalidatePath(`/${slug}`, "layout");
  return { message: "Personal Tembo account connected." };
}

export async function removePersonalTemboKeyAction(
  _previous: PersonalTemboFormState,
  formData: FormData,
): Promise<PersonalTemboFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const auth = await authorizeWorkspace(slug);
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  await removePersonalTemboCredential(auth.workspace.id, auth.userId);
  await writeAuditEvent({
    workspaceId: auth.workspace.id,
    actorUserId: auth.userId,
    source: "human_action",
    kind: "tembo.personal_disconnected",
    targetType: "user",
    targetId: auth.userId,
    agentName: null,
    payload: {},
  });
  revalidatePath(`/${slug}/settings/tembo`);
  revalidatePath(`/${slug}`, "layout");
  return { message: "Personal Tembo account disconnected." };
}
