import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getInstanceNameFromEnv } from "@/lib/config";
import { authorizeInstance } from "@/lib/instance";
import { getStoredInstanceName } from "@/lib/instance-settings";

import { InstanceNameForm } from "./instance-name-form";

export const dynamic = "force-dynamic";

// Root /settings — deployment-level (instance) settings, gated to
// instance admins (INSTANCE_ADMIN_EMAILS). Lives outside the workspace
// shell since these settings aren't workspace-scoped.
export default async function InstanceSettingsPage() {
  const auth = await authorizeInstance();
  // Don't leak the admin surface: a signed-out or non-admin user just
  // goes home.
  if (!auth.ok) redirect("/");

  const storedName = await getStoredInstanceName();
  const envFallback = getInstanceNameFromEnv();

  return (
    <main className="bg-surface min-h-screen px-6 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <Link
            href="/"
            className="text-foreground-weak hover:text-foreground w-fit text-sm"
          >
            ← Back
          </Link>
          <h1 className="text-foreground-title text-2xl font-bold tracking-tight">
            Instance settings
          </h1>
          <p className="text-foreground-weak text-base">
            Deployment-wide configuration. Visible to instance admins only.
          </p>
        </div>

        <hr className="border-[var(--color-border-weak)]" />

        <Card className="w-full p-3">
          <CardHeader className="flex-col items-start gap-1 px-1 pb-3 pt-1">
            <CardTitle className="text-foreground-title text-base">
              General
            </CardTitle>
            <CardDescription>
              Branding shown across the deployment.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-1 pb-1">
            <InstanceNameForm
              initialName={storedName ?? ""}
              envFallback={envFallback}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
