"use server";

import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/session";
import { createWorkspace, type CreateWorkspaceError } from "@/lib/workspace";

export type OnboardingFormState = {
  error?: string;
};

const ERROR_MESSAGES: Record<CreateWorkspaceError, string> = {
  "name-required": "Please enter a workspace name.",
  "slug-too-short": "Workspace URL must be at least 2 characters.",
  "slug-too-long": "Workspace URL must be 32 characters or fewer.",
  "slug-invalid-chars":
    "Workspace URL may contain only lowercase letters, numbers, and hyphens.",
  "slug-reserved": "That workspace URL is reserved. Try a different name.",
  "slug-taken": "That workspace URL is taken. Try a different name.",
};

export async function createWorkspaceAction(
  _prev: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const session = await getServerSession();
  if (!session) {
    redirect("/");
  }

  const name = String(formData.get("name") ?? "").trim();
  const result = await createWorkspace(session.user.id, { name });

  if (!result.ok) {
    return { error: ERROR_MESSAGES[result.error] };
  }

  redirect(`/${result.workspace.slug}`);
}
