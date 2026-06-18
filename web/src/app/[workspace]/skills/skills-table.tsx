"use client";

import { DataTable, type Column } from "@/components/ui/data-table";

// Installed skills as a row-per-skill table (shared DataTable: hover + whole-row
// click to the skill's detail page). Fed plain rows by the server page.

export type SkillRow = {
  name: string;
  description: string | null;
  href: string;
};

export function SkillsTable({ rows }: { rows: SkillRow[] }) {
  const columns: Column<SkillRow>[] = [
    {
      key: "name",
      header: "Skill",
      thClassName: "w-[240px]",
      cell: (s) => (
        <code className="text-foreground text-sm font-medium">{s.name}</code>
      ),
    },
    {
      key: "description",
      header: "Description",
      tdClassName: "text-foreground-weak text-sm",
      cell: (s) =>
        s.description ? (
          <span className="line-clamp-2 leading-5">{s.description}</span>
        ) : (
          <span className="text-foreground-muted">—</span>
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(s) => s.name}
      rowHref={(s) => s.href}
    />
  );
}
