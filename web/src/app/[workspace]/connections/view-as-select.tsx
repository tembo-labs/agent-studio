"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { ConnectionMember } from "@/lib/connections-view";

// Admin-only "Viewing" picker on the Connections page. Switches whose
// connections are shown via a ?user=<id> param; selecting yourself drops
// the param. Members other than admins never see this.
export function ViewAsSelect({
  members,
  currentUserId,
}: {
  members: ConnectionMember[];
  currentUserId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("user") ?? currentUserId;

  return (
    <div className="flex items-center gap-2">
      <span className="text-foreground-weak text-sm">Viewing</span>
      <select
        aria-label="View another member's connections"
        value={current}
        onChange={(e) => {
          const next = e.target.value;
          // Start fresh (drop stale OAuth-banner params) and only carry
          // the user selection.
          const params = new URLSearchParams();
          if (next !== currentUserId) params.set("user", next);
          const qs = params.toString();
          router.push(qs ? `${pathname}?${qs}` : pathname);
        }}
        className="bg-input text-foreground hover:bg-input-hover focus:bg-input-active focus-visible:shadow-focus-ring rounded-lg px-2 py-1 text-sm shadow-[0_0_0_1px_var(--color-border)] transition-[background-color,box-shadow,color] duration-150 focus:outline-none"
      >
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {(m.name ?? m.email) + (m.userId === currentUserId ? " (you)" : "")}
          </option>
        ))}
      </select>
    </div>
  );
}
