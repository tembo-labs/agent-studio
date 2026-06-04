"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { authorizeWorkspace, DENIED_MESSAGE } from "@/lib/auth-server";
import {
  createSlackApp,
  deleteSlackApp,
  updateSlackApp,
} from "@/lib/slack-apps";

// Slack-app admin actions. All workspace_admin-only (managing a Slack app
// is a privileged, instance-affecting operation).

export type SlackAppFormState = { error?: string; message?: string };

function parseLabels(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export async function createSlackAppAction(
  _prev: SlackAppFormState,
  formData: FormData,
): Promise<SlackAppFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const defaultOwner = String(formData.get("default_owner") ?? "").trim();
  const agentLabels = parseLabels(String(formData.get("agent_labels") ?? ""));

  if (!name) return { error: "Give the app a name." };
  // Spaces are fine — it's the bot's display name, not a slug. Cap at
  // Slack's app-name limit so the generated manifest stays valid.
  if (name.length > 35) {
    return { error: "Keep the name under 35 characters (Slack's limit)." };
  }
  if (!defaultOwner) return { error: "Pick a default owner." };

  const auth = await authorizeWorkspace(slug, "workspace_admin");
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }
  try {
    await createSlackApp(
      auth.workspace.id,
      { name, defaultOwnerUserId: defaultOwner, agentLabels },
      auth.userId,
    );
  } catch (e) {
    const dup = e instanceof Error && /unique|duplicate/i.test(e.message);
    return {
      error: dup
        ? "A Slack app with that name already exists in this workspace."
        : "Couldn't create the Slack app.",
    };
  }
  revalidatePath(`/${slug}/settings/slack`);
  return { message: `Created "${name}".` };
}

export async function updateSlackAppAction(
  _prev: SlackAppFormState,
  formData: FormData,
): Promise<SlackAppFormState> {
  const slug = String(formData.get("workspace") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing app id." };

  const auth = await authorizeWorkspace(slug, "workspace_admin");
  if (!auth.ok) {
    if (auth.reason === "denied") return { error: DENIED_MESSAGE };
    notFound();
  }

  // Only fields actually present in the submitted form are touched; secrets
  // are written only when a non-empty value is supplied.
  const name = formData.get("name");
  const defaultOwner = formData.get("default_owner");
  const labels = formData.get("agent_labels");
  const slackAppId = formData.get("slack_app_id");
  const clientId = formData.get("client_id");
  const signingSecret = String(formData.get("signing_secret") ?? "").trim();
  const clientSecret = String(formData.get("client_secret") ?? "").trim();

  await updateSlackApp(auth.workspace.id, id, {
    ...(name !== null ? { name: String(name).trim() } : {}),
    ...(defaultOwner !== null
      ? { defaultOwnerUserId: String(defaultOwner).trim() }
      : {}),
    ...(labels !== null ? { agentLabels: parseLabels(String(labels)) } : {}),
    ...(slackAppId !== null
      ? { slackAppId: String(slackAppId).trim() || null }
      : {}),
    ...(clientId !== null ? { clientId: String(clientId).trim() || null } : {}),
    ...(signingSecret ? { signingSecret } : {}),
    ...(clientSecret ? { clientSecret } : {}),
  });

  revalidatePath(`/${slug}/settings/slack`);
  return { message: "Saved." };
}

export async function deleteSlackAppAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("workspace") ?? "");
  const id = String(formData.get("id") ?? "");
  const auth = await authorizeWorkspace(slug, "workspace_admin");
  if (!auth.ok) return;
  await deleteSlackApp(auth.workspace.id, id);
  revalidatePath(`/${slug}/settings/slack`);
}
