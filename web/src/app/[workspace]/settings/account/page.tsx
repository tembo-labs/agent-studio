import { notFound } from "next/navigation";

import { Section } from "@/components/section";
import { emailPasswordEnabled } from "@/lib/auth-providers";
import { getServerSession } from "@/lib/session";

import { ChangePasswordForm } from "../change-password-form";

export const dynamic = "force-dynamic";

// Account: the signed-in user's own credentials. Only exists on
// email/password instances — with an OAuth provider configured,
// credentials live at the identity provider and there's nothing to
// manage here (the nav link is hidden too; this gate is the backstop).
export default async function AccountPage() {
  if (!emailPasswordEnabled()) notFound();
  const session = await getServerSession();
  if (!session) notFound();

  return (
    <Section
      title="Password"
      description={`Change the password for ${session.user.email}. Other sessions are signed out when it changes. Locked out instead? A workspace admin can generate a reset link from your member page.`}
    >
      <ChangePasswordForm />
    </Section>
  );
}
