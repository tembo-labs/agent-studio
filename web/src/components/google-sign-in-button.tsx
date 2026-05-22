"use client";

import { useState, useTransition } from "react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex w-full flex-col gap-2">
      <Button
        type="button"
        variant="inverted"
        disabled={pending}
        className="w-full"
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await authClient.signIn.social({
              provider: "google",
              callbackURL: "/",
            });
            if (result.error) {
              setError(result.error.message ?? "Sign-in failed.");
              return;
            }
            // better-auth returns { redirect: true, url } — the React SDK
            // does not auto-navigate, so do it ourselves.
            if (result.data?.url) {
              window.location.href = result.data.url;
            }
          })
        }
      >
        <GoogleGlyph />
        <span>{pending ? "Redirecting…" : "Continue with Google"}</span>
      </Button>
      {error && (
        <p className="text-sentiment-negative text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M17.64 9.2c0-.638-.057-1.252-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.96H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.04l3.007-2.333Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.582C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96l3.007 2.333C4.672 5.166 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}
