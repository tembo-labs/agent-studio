"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

// Self-serve password change for email/password instances. Goes through
// better-auth's changePassword (verifies the current password server-side)
// and revokes every other session — if the reason for the change is a
// leaked password, the leak's sessions die with it.
export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    startTransition(async () => {
      const res = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (res.error) {
        setError(res.error.message ?? "Couldn't change the password.");
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password changed.");
    });
  }

  return (
    <form onSubmit={submit} className="flex max-w-sm flex-col gap-3">
      <Input
        type="password"
        placeholder="Current password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        autoComplete="current-password"
        required
        disabled={pending}
      />
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

      <div>
        <Button type="submit" size="small" variant="secondary" disabled={pending}>
          {pending ? "Changing…" : "Change password"}
        </Button>
      </div>
    </form>
  );
}
