"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

// Tiny adapter between useActionState's return shape and sonner.
// Server actions in this repo overwhelmingly return one of:
//   { message?: string }   — success copy to show
//   { error?: string }     — failure copy to show
// (or both keys present, undefined). The hook fires a toast every
// time message or error changes to a new truthy value, and ignores
// the initial render so a freshly-mounted form doesn't fire
// "Connection removed" out of nowhere on page load.

type ActionState = { message?: string; error?: string };

export function useActionToast(state: ActionState | undefined) {
  const lastMessage = useRef<string | undefined>(undefined);
  const lastError = useRef<string | undefined>(undefined);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      lastMessage.current = state?.message;
      lastError.current = state?.error;
      return;
    }
    if (state?.message && state.message !== lastMessage.current) {
      toast.success(state.message);
      lastMessage.current = state.message;
    }
    if (state?.error && state.error !== lastError.current) {
      toast.error(state.error);
      lastError.current = state.error;
    }
  }, [state?.message, state?.error]);
}
