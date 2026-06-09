"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import type { WorkspaceRole } from "@/lib/rbac";

// Sidebar-footer user menu. Clicking the name/email opens a small popup
// with Sign out. Outside-click and Escape both close it; the popup sits
// above the trigger because the trigger lives at the bottom of the
// sidebar. The user's role in the current workspace shows as a badge
// under their name.

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  workspace_admin: "Workspace Admin",
  operator: "Operator",
  viewer: "Viewer",
};

type Props = {
  name: string | null;
  email: string;
  /** Role in the current workspace, for the badge. Null = not a member. */
  role?: WorkspaceRole | null;
  /** Show the instance-settings link (INSTANCE_ADMIN_EMAILS allowlist). */
  isInstanceAdmin?: boolean;
};

export function UserMenu({ name, email, role, isInstanceAdmin }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleSignOut() {
    startTransition(async () => {
      await authClient.signOut();
      // Leave the now-unauthed page — refreshing it would 404 on a
      // protected route. Land on / (the sign-in screen).
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="hover:bg-interactive-state-hover flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors"
      >
        <span className="text-foreground text-sm font-medium leading-tight">
          {name ?? email}
        </span>
        {name && (
          <span className="text-foreground-muted text-sm leading-tight">
            {email}
          </span>
        )}
        {role && (
          <span className="bg-surface-secondary text-foreground-weak mt-1 rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide">
            {ROLE_LABELS[role]}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="bg-surface-raised border-border absolute bottom-full left-0 right-0 z-20 mb-1 rounded-lg border p-1 shadow-[0_8px_24px_0_rgba(0,0,0,0.12)]"
        >
          {isInstanceAdmin && (
            <Link
              role="menuitem"
              href="/settings"
              onClick={() => setOpen(false)}
              className="hover:bg-interactive-state-hover text-foreground flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors"
            >
              Instance settings
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={pending}
            className="hover:bg-interactive-state-hover text-foreground flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
