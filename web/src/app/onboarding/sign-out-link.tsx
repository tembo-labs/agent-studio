"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

// Escape hatch on the onboarding screen: someone who signed in with the
// wrong Google account needs a way back to the sign-in page without an
// app shell to hang a user menu off of. Renders as a quiet text link.
export function SignOutLink({ email }: { email: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <p className="text-foreground-weak text-sm">
      Signed in as {email}. Not you?{" "}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await authClient.signOut();
            router.push("/");
            router.refresh();
          })
        }
        className="text-foreground-weak hover:text-foreground underline underline-offset-2 disabled:opacity-60"
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </p>
  );
}
