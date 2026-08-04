"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

// Sets a new password from an admin-minted reset link (see
// lib/password-reset.ts). better-auth validates + consumes the token
// server-side; on success we send the user to sign in fresh (the reset
// revoked their sessions).
export function ResetPasswordForm({ token }: { token: string }) {
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    startTransition(async () => {
      const res = await authClient.resetPassword({
        newPassword: next,
        token,
      });
      if (res.error) {
        setError(
          res.error.code === "INVALID_TOKEN"
            ? "This reset link is invalid or has expired. Ask a workspace admin for a new one."
            : (res.error.message ?? "Couldn't reset the password."),
        );
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-foreground text-sm">
          Password updated. Sign in with your new password.
        </p>
        <Button onClick={() => (window.location.href = "/")}>Sign in</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Input
        type="password"
        placeholder="New password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        autoComplete="new-password"
        minLength={8}
        required
        disabled={pending}
      />
      <Input
        type="password"
        placeholder="Confirm new password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="new-password"
        minLength={8}
        required
        disabled={pending}
      />

      {error && (
        <p className="text-sentiment-negative text-sm" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
