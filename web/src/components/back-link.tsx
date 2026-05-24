import Link from "next/link";

import { IconChevronLeftSmall } from "central-icons";

// Small "← Label" back link rendered above the page h1 on nested pages.
// Replaces the TopBar's back chevron + breadcrumb pattern with something
// that sits inside the page content instead of in a sticky header bar.

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-foreground-weak hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
    >
      <IconChevronLeftSmall size={16} />
      <span>{label}</span>
    </Link>
  );
}
