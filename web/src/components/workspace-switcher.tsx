"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  IconCheckmark1Small,
  IconChevronDownSmall,
  IconPlusSmall,
} from "central-icons";

// Sidebar-header switcher. Click the workspace name to open a dropdown
// listing every workspace the signed-in user belongs to, with a
// "Create workspace" item at the bottom that routes through the
// existing onboarding flow. Mirrors the popup/dismiss behavior of
// @/components/user-menu — kept independent because the layouts
// differ (this opens *below* its trigger, user-menu opens above).

type WorkspaceOption = {
  slug: string;
  name: string;
};

type Props = {
  current: WorkspaceOption;
  workspaces: WorkspaceOption[];
};

export function WorkspaceSwitcher({ current, workspaces }: Props) {
  const [open, setOpen] = useState(false);
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

  function handleSelect(slug: string) {
    setOpen(false);
    if (slug !== current.slug) {
      router.push(`/${slug}`);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="hover:bg-interactive-state-hover -mx-1 flex w-[calc(100%+0.5rem)] items-center justify-between gap-1 rounded-md px-1 py-0.5 text-left transition-colors"
      >
        <span className="text-foreground-title hover:text-foreground truncate text-sm font-semibold leading-tight">
          {current.name}
        </span>
        <IconChevronDownSmall
          size={14}
          className="text-foreground-muted shrink-0"
        />
      </button>

      {open && (
        <div
          role="menu"
          className="bg-surface-raised border-border absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border p-1 shadow-[0_8px_24px_0_rgba(0,0,0,0.12)]"
        >
          {workspaces.map((ws) => {
            const isCurrent = ws.slug === current.slug;
            return (
              <button
                key={ws.slug}
                type="button"
                role="menuitem"
                onClick={() => handleSelect(ws.slug)}
                className="hover:bg-interactive-state-hover text-foreground flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors"
              >
                <span className="truncate">{ws.name}</span>
                {isCurrent && (
                  <IconCheckmark1Small
                    size={14}
                    className="text-foreground-muted shrink-0"
                  />
                )}
              </button>
            );
          })}
          <div className="border-border my-1 border-t" />
          <Link
            href="/onboarding"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="hover:bg-interactive-state-hover text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors"
          >
            <IconPlusSmall size={14} className="text-foreground-muted shrink-0" />
            <span>Create workspace</span>
          </Link>
        </div>
      )}
    </div>
  );
}
