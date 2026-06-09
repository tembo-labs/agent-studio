"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { IconBook } from "central-icons";

// Docs link pinned just above the user menu in the sidebar footer. Active on
// any /docs path (the index redirects to a sub-page, so an exact match alone
// would never light up).
export function DocsSidebarLink({ href }: { href: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-interactive-state-active text-foreground"
          : "text-foreground-weak hover:bg-interactive-state-hover hover:text-foreground",
      )}
    >
      <span className="flex h-4 w-4 items-center justify-center [&_svg]:h-4 [&_svg]:w-4">
        <IconBook />
      </span>
      <span>Docs</span>
    </Link>
  );
}
