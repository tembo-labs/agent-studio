"use server";

import { redirect } from "next/navigation";

import { writeAuditEvent } from "@/lib/audit-db";
import { isInstanceAdmin } from "@/lib/instance";
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
  // Only instance admins can create workspaces.
  if (!(await isInstanceAdmin(session.user.email))) {
    return { error: "Only an instance admin can create workspaces." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const result = await createWorkspace(session.user.id, { name });

  if (!result.ok) {
    return { error: ERROR_MESSAGES[result.error] };
  }

  await writeAuditEvent({
    workspaceId: result.workspace.id,
    actorUserId: session.user.id,
    source: "human_action",
    kind: "workspace.created",
    targetType: "workspace",
    targetId: result.workspace.id,
    agentName: null,
    payload: { name: result.workspace.name, slug: result.workspace.slug },
  });

  // Repo connect is the required next step. The workspace home page also
  // enforces this — going directly to /{slug} without a repo will redirect
  // back here.
  redirect(`/onboarding/repo?ws=${encodeURIComponent(result.workspace.slug)}`);
}
