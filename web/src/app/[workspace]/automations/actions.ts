"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import {
  createAutomation,
  deleteAutomation,
  getAutomation,
  updateAutomation,
} from "@/lib/automations-api";
import { validateCron } from "@/lib/cron";
import { getServerSession } from "@/lib/session";
import { getWorkspaceBySlug, userIsMember } from "@/lib/workspace";
import { getAgentByName } from "@/lib/workspace-agents";

export type AutomationFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "agent" | "cron", string>>;
};

const EMPTY: AutomationFormState = {};

// Both create and update share these field-level checks.
type ParsedForm = {
  workspaceSlug: string;
  name: string;
  agentName: string;
  cron: string;
  inputMessage: string;
  enabled: boolean;
};

function parseForm(formData: FormData): ParsedForm {
  return {
    workspaceSlug: String(formData.get("workspace") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    agentName: String(formData.get("agent") ?? "").trim(),
    cron: String(formData.get("cron") ?? "").trim(),
    inputMessage: String(formData.get("input_message") ?? ""),
    enabled: formData.get("enabled") === "on",
  };
}

async function validate(
  workspaceId: string,
  parsed: ParsedForm,
): Promise<AutomationFormState | null> {
  const fieldErrors: AutomationFormState["fieldErrors"] = {};
  if (!parsed.name) fieldErrors.name = "Name is required.";
  if (!parsed.agentName) fieldErrors.agent = "Pick an agent.";
  if (parsed.agentName) {
    const found = await getAgentByName(workspaceId, parsed.agentName);
    if (!found) fieldErrors.agent = "That agent isn't in this workspace.";
  }
  const cronCheck = validateCron(parsed.cron);
  if (!cronCheck.ok) fieldErrors.cron = cronCheck.error;
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return null;
}

export async function createAutomationAction(
  _prev: AutomationFormState,
  formData: FormData,
): Promise<AutomationFormState> {
  const session = await getServerSession();
  if (!session) notFound();

  const parsed = parseForm(formData);
  const workspace = await getWorkspaceBySlug(parsed.workspaceSlug);
  if (!workspace) notFound();
  const isMember = await userIsMember(workspace.id, session.user.id);
  if (!isMember) notFound();

  const invalid = await validate(workspace.id, parsed);
  if (invalid) return invalid;

  await createAutomation({
    workspaceId: workspace.id,
    name: parsed.name,
    agentName: parsed.agentName,
    cron: parsed.cron,
    inputMessage: parsed.inputMessage,
    enabled: parsed.enabled,
    userId: session.user.id,
  });

  revalidatePath(`/${parsed.workspaceSlug}/automations`);
  revalidatePath(`/${parsed.workspaceSlug}/agents/${encodeURIComponent(parsed.agentName)}`);
  redirect(`/${parsed.workspaceSlug}/automations`);
}

export async function updateAutomationAction(
  _prev: AutomationFormState,
  formData: FormData,
): Promise<AutomationFormState> {
  const session = await getServerSession();
  if (!session) notFound();

  const id = String(formData.get("id") ?? "");
  const existing = await getAutomation(id);
  if (!existing) notFound();

  const parsed = parseForm(formData);
  const workspace = await getWorkspaceBySlug(parsed.workspaceSlug);
  if (!workspace || workspace.id !== existing.workspaceId) notFound();
  const isMember = await userIsMember(workspace.id, session.user.id);
  if (!isMember) notFound();

  const invalid = await validate(workspace.id, parsed);
  if (invalid) return invalid;

  await updateAutomation({
    id,
    name: parsed.name,
    agentName: parsed.agentName,
    cron: parsed.cron,
    inputMessage: parsed.inputMessage,
    enabled: parsed.enabled,
  });

  revalidatePath(`/${parsed.workspaceSlug}/automations`);
  revalidatePath(`/${parsed.workspaceSlug}/agents/${encodeURIComponent(parsed.agentName)}`);
  if (existing.agentName !== parsed.agentName) {
    // The owning agent changed — refresh the old agent's page too so
    // its "Automations" section drops this row.
    revalidatePath(`/${parsed.workspaceSlug}/agents/${encodeURIComponent(existing.agentName)}`);
  }
  redirect(`/${parsed.workspaceSlug}/automations`);
}

export type DeleteAutomationFormState = { error?: string };
const DELETE_EMPTY: DeleteAutomationFormState = {};

export async function deleteAutomationAction(
  _prev: DeleteAutomationFormState,
  formData: FormData,
): Promise<DeleteAutomationFormState> {
  const session = await getServerSession();
  if (!session) notFound();

  const id = String(formData.get("id") ?? "");
  const workspaceSlug = String(formData.get("workspace") ?? "");
  const existing = await getAutomation(id);
  if (!existing) notFound();

  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace || workspace.id !== existing.workspaceId) notFound();
  const isMember = await userIsMember(workspace.id, session.user.id);
  if (!isMember) notFound();

  await deleteAutomation(id);
  revalidatePath(`/${workspaceSlug}/automations`);
  revalidatePath(`/${workspaceSlug}/agents/${encodeURIComponent(existing.agentName)}`);
  return DELETE_EMPTY;
}

// Quick enable/disable toggle without going through the full edit
// form. Reuses the update path; the form on the list page renders a
// single hidden enabled field + an immediate submit on change.
export async function toggleAutomationAction(formData: FormData): Promise<void> {
  const session = await getServerSession();
  if (!session) notFound();

  const id = String(formData.get("id") ?? "");
  const enabled = formData.get("enabled") === "true";
  const workspaceSlug = String(formData.get("workspace") ?? "");

  const existing = await getAutomation(id);
  if (!existing) notFound();

  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace || workspace.id !== existing.workspaceId) notFound();
  const isMember = await userIsMember(workspace.id, session.user.id);
  if (!isMember) notFound();

  await updateAutomation({
    id,
    name: existing.name,
    agentName: existing.agentName,
    cron: existing.cron,
    inputMessage: existing.inputMessage,
    enabled,
  });
  revalidatePath(`/${workspaceSlug}/automations`);
  revalidatePath(`/${workspaceSlug}/agents/${encodeURIComponent(existing.agentName)}`);
}

export const AUTOMATION_FORM_EMPTY = EMPTY;
