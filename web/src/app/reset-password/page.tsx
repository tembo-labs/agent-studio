import Link from "next/link";

import { ResetPasswordForm } from "@/components/reset-password-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { emailPasswordEnabled } from "@/lib/auth-providers";
import { getInstanceName } from "@/lib/instance-settings";

export const dynamic = "force-dynamic";

// Public landing for admin-minted password reset links
// (/reset-password?token=…). Unauthenticated by design — the person
// arriving here is locked out. The token is only judged server-side
// when the form submits; a bad token fails there with a clear message.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token: raw } = await searchParams;
  const token = Array.isArray(raw) ? raw[0] : raw;
  const instanceName = await getInstanceName();

  return (
    <main className="bg-surface relative flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <h1 className="text-foreground-title text-center text-lg font-medium">
          {instanceName}
        </h1>

        <Card className="w-full max-w-md p-3">
          <CardHeader className="px-1 pb-3 pt-1">
            <CardTitle className="text-foreground-title text-base">
              Reset your password
            </CardTitle>
          </CardHeader>
          <CardContent className="px-1 pb-1">
            {!emailPasswordEnabled() ? (
              <p className="text-foreground-weak text-sm">
                This instance signs in through an identity provider — reset
                your password there instead.{" "}
                <Link href="/" className="text-foreground underline">
                  Back to sign in
                </Link>
                .
              </p>
            ) : !token ? (
              <p className="text-foreground-weak text-sm">
                This reset link is missing its token. Ask a workspace admin to
                generate a new one, and open the full link they send you.
              </p>
            ) : (
              <ResetPasswordForm token={token} />
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
