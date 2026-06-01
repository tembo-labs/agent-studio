"use server";

import { revalidatePath } from "next/cache";

import { authorizeInstance } from "@/lib/instance";
import { isFirstRun, setInstanceName } from "@/lib/instance-settings";

export type InstanceSettingsState = {
  ok: boolean;
  error?: string;
  saved?: boolean;
};

const MAX_NAME = 120;

export async function updateInstanceNameAction(
  _prev: InstanceSettingsState,
  formData: FormData,
): Promise<InstanceSettingsState> {
  // Re-check the gate here — never trust the client; the page render
  // gate isn't a substitute for action-level enforcement.
  const auth = await authorizeInstance();
  if (!auth.ok) {
    return {
      ok: false,
      error: "You don't have permission to change instance settings.",
    };
  }

  const name = String(formData.get("instanceName") ?? "").trim();
  if (name.length > MAX_NAME) {
    return { ok: false, error: `Name must be ${MAX_NAME} characters or fewer.` };
  }

  await setInstanceName(name, auth.userId);

  // The name renders on the login screen + app header; bust those.
  revalidatePath("/settings");
  revalidatePath("/", "layout");

  return { ok: true, saved: true };
}

// First-run setup: set the instance name before any account exists
// (the pre-sign-in setup screen). Gated on first-run only — once a user
// exists, the name is managed via Instance settings (admin-gated above).
export async function setupInstanceNameAction(
  _prev: InstanceSettingsState,
  formData: FormData,
): Promise<InstanceSettingsState> {
  if (!(await isFirstRun())) {
    return {
      ok: false,
      error: "Setup is closed — sign in and edit Instance settings.",
    };
  }

  const name = String(formData.get("instanceName") ?? "").trim();
  if (name.length > MAX_NAME) {
    return { ok: false, error: `Name must be ${MAX_NAME} characters or fewer.` };
  }

  await setInstanceName(name, null);
  revalidatePath("/", "layout");
  return { ok: true, saved: true };
}
