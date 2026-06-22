"use client";

import { useState, type ReactNode } from "react";

import { Select } from "@/components/ui/select";

// Lets the Definition tab switch between the live draft and each stable
// version's snapshotted spec. The blocks are rendered server-side (syntax
// highlighting stays on the server) and passed in as ReactNodes; this just
// picks which one to show. Defaults to the first item (the draft).

export type SpecVersionItem = { id: string; label: string; block: ReactNode };

export function SpecVersionViewer({ items }: { items: SpecVersionItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const current = items.find((i) => i.id === active) ?? items[0];

  return (
    <div className="flex flex-col gap-3">
      {items.length > 1 && (
        <label className="text-foreground-weak flex items-center gap-2 text-sm">
          <span>Showing</span>
          <Select
            value={active}
            onValueChange={setActive}
            options={items.map((i) => ({ value: i.id, label: i.label }))}
            ariaLabel="Spec version"
            className="min-w-[180px]"
          />
        </label>
      )}
      {current?.block}
    </div>
  );
}
