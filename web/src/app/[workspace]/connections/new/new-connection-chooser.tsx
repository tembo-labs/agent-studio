"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { IconApiConnection } from "central-icons";

import { McpProviderLogo } from "@/components/mcp-provider-logo";
import { Input } from "@/components/ui/input";

// Landing chooser for Connections → New. Search jumps straight to a provider
// (native MCP / manual credential); empty query shows the type cards.

export type SearchableProvider = {
  slug: string;
  displayName: string;
  authLabel: string;
  categoryLabel: string;
  /** native-mcp | manual-credential */
  kind: "native" | "manual";
  href: string;
};

export function NewConnectionChooser({
  workspaceSlug,
  providers,
  showManual,
  showSecret,
}: {
  workspaceSlug: string;
  providers: SearchableProvider[];
  showManual: boolean;
  showSecret: boolean;
}) {
  const [query, setQuery] = useState("");
  const newHref = `/${workspaceSlug}/connections/new`;

  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!needle) return [];
    return providers
      .filter(
        (p) =>
          p.displayName.toLowerCase().includes(needle) ||
          p.slug.toLowerCase().includes(needle) ||
          p.authLabel.toLowerCase().includes(needle) ||
          p.categoryLabel.toLowerCase().includes(needle) ||
          p.kind.includes(needle),
      )
      .slice(0, 40);
  }, [providers, needle]);

  const typeMatches = useMemo(() => {
    if (!needle) return [];
    const types: Array<{
      href: string;
      title: string;
      sublabel: string;
      logo: ReactNode;
    }> = [];
    if (
      "native mcp".includes(needle) ||
      needle.includes("native") ||
      needle === "mcp" ||
      needle.includes("oauth")
    ) {
      types.push({
        href: `${newHref}?type=native`,
        title: "Native MCP",
        sublabel: "Browse all official provider MCP servers",
        logo: (
          <IconApiConnection size={24} className="text-foreground-muted" />
        ),
      });
    }
    if (needle.includes("composio") || needle.includes("toolkit")) {
      types.push({
        href: `${newHref}?type=composio`,
        title: "Composio",
        sublabel: "300+ apps via Composio",
        logo: (
          <IconApiConnection size={24} className="text-foreground-muted" />
        ),
      });
    }
    if (
      showManual &&
      (needle.includes("manual") ||
        needle.includes("credential") ||
        needle.includes("linkedin"))
    ) {
      types.push({
        href: `${newHref}?type=manual`,
        title: "Manual credential",
        sublabel: "Paste credentials (e.g. LinkedIn)",
        logo: <Glyph />,
      });
    }
    if (
      showSecret &&
      (needle.includes("secret") ||
        needle.includes("api key") ||
        needle.includes("apikey"))
    ) {
      types.push({
        href: `${newHref}?type=secret`,
        title: "Secret / API key",
        sublabel: "Static key for custom tools",
        logo: <Glyph />,
      });
    }
    return types;
  }, [needle, newHref, showManual, showSecret]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="new-conn-search"
          className="text-foreground-weak text-sm font-medium uppercase tracking-wide"
        >
          Search
        </label>
        <Input
          id="new-conn-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search providers (e.g. zoom, slack, stripe)…"
          autoFocus
          aria-label="Search providers"
        />
      </div>

      {needle ? (
        <div className="flex flex-col gap-4">
          {typeMatches.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-foreground-weak text-sm font-medium uppercase tracking-wide">
                Connection types
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {typeMatches.map((t) => (
                  <OptionCard
                    key={t.href}
                    href={t.href}
                    logo={t.logo}
                    title={t.title}
                    sublabel={t.sublabel}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <h2 className="text-foreground-weak text-sm font-medium uppercase tracking-wide">
              Providers
              {matches.length > 0 && (
                <span className="text-foreground-muted normal-case tracking-normal">
                  {" "}
                  · {matches.length}
                  {matches.length === 40 ? "+" : ""}
                </span>
              )}
            </h2>
            {matches.length === 0 ? (
              <p className="text-foreground-muted text-sm">
                No providers match &ldquo;{query.trim()}&rdquo;. Try a slug or
                browse{" "}
                <Link
                  href={`${newHref}?type=native`}
                  className="text-foreground underline underline-offset-2"
                >
                  Native MCP
                </Link>
                {" / "}
                <Link
                  href={`${newHref}?type=composio`}
                  className="text-foreground underline underline-offset-2"
                >
                  Composio
                </Link>
                .
              </p>
            ) : (
              <ul className="border-border divide-border bg-surface overflow-hidden rounded-lg border divide-y">
                {matches.map((p) => (
                  <li key={`${p.kind}:${p.slug}`}>
                    <Link
                      href={p.href}
                      className="hover:bg-interactive-state-hover flex items-center gap-3 px-3 py-2.5 transition-colors"
                    >
                      <McpProviderLogo
                        slug={p.slug}
                        label={p.displayName}
                        size={20}
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-foreground font-medium">
                          {p.displayName}
                        </span>
                        <span className="text-foreground-muted truncate text-xs">
                          <code>{p.slug}</code>
                          {p.categoryLabel ? ` · ${p.categoryLabel}` : ""}
                          {" · "}
                          {p.authLabel}
                          {p.kind === "manual" ? " · Manual credential" : ""}
                        </span>
                      </span>
                      <span className="text-foreground-weak shrink-0 text-sm font-medium whitespace-nowrap">
                        Connect →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <h2 className="text-foreground-weak text-sm font-medium uppercase tracking-wide">
            Or pick a type
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <OptionCard
              href={`${newHref}?type=native`}
              logo={
                <IconApiConnection
                  size={24}
                  className="text-foreground-muted"
                />
              }
              title="Native MCP"
              sublabel="Official provider MCP servers (OAuth)"
            />
            <OptionCard
              href={`${newHref}?type=composio`}
              logo={
                <IconApiConnection
                  size={24}
                  className="text-foreground-muted"
                />
              }
              title="Composio"
              sublabel="300+ apps via Composio"
            />
            {showManual && (
              <OptionCard
                href={`${newHref}?type=manual`}
                logo={<Glyph />}
                title="Manual credential"
                sublabel="Paste credentials (e.g. LinkedIn)"
              />
            )}
            {showSecret && (
              <OptionCard
                href={`${newHref}?type=secret`}
                logo={<Glyph />}
                title="Secret / API key"
                sublabel="Static key for custom tools"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OptionCard({
  href,
  logo,
  title,
  sublabel,
}: {
  href: string;
  logo: ReactNode;
  title: string;
  sublabel: string;
}) {
  return (
    <Link
      href={href}
      className="border-border bg-surface hover:bg-surface-secondary group flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">
        {logo}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-foreground group-hover:underline font-medium">
          {title}
        </span>
        <span className="text-foreground-muted truncate text-sm">
          {sublabel}
        </span>
      </span>
    </Link>
  );
}

function Glyph() {
  return (
    <span
      className="bg-surface-secondary text-foreground-muted inline-flex h-6 w-6 items-center justify-center rounded text-sm"
      aria-hidden
    >
      ⚿
    </span>
  );
}
