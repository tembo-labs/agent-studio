"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { getServerSession } from "@/lib/session";
import {
  getWorkspaceBySlug,
  removeWorkspaceSecret,
  setWorkspaceSecret,
  userIsMember,
  type SetWorkspaceSecretError,
} from "@/lib/workspace";

export type TemboApiKeyFormState = {
  message?: string;
  error?: string;
};

const SAVE_ERROR_MESSAGES: Record<SetWorkspaceSecretError, string> = {
  empty: "Please paste your Tembo API key.",
  "too-short": "That key looks too short to be a Tembo API key.",
  "too-long": "That key is longer than we expected. Double-check what you pasted.",
};

async function authorizeWorkspace(slug: string) {
  const session = await getServerSession();
  if (!session) notFound();

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const ok = await userIsMember(workspace.id, session.user.id);
  if (!ok) notFound();

  return workspace;
}

export async function saveTemboApiKeyAction(
  _prev: TemboApiKeyFormState,
  formData: FormData,
): Promise<TemboApiKeyFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const apiKey = String(formData.get("apiKey") ?? "");

  const workspace = await authorizeWorkspace(slug);
  const result = await setWorkspaceSecret(
    workspace.id,
    "tembo_api_key",
    apiKey,
  );
  if (!result.ok) {
    return { error: SAVE_ERROR_MESSAGES[result.error] };
  }

  revalidatePath(`/${slug}/settings`);
  revalidatePath(`/${slug}`);
  return { message: "Tembo API key saved." };
}

export async function removeTemboApiKeyAction(
  _prev: TemboApiKeyFormState,
  formData: FormData,
): Promise<TemboApiKeyFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const workspace = await authorizeWorkspace(slug);
  await removeWorkspaceSecret(workspace.id, "tembo_api_key");

  revalidatePath(`/${slug}/settings`);
  revalidatePath(`/${slug}`);
  return { message: "Tembo API key removed." };
}
