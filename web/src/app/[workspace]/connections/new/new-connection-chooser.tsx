"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { IconApiConnection } from "central-icons";

import { McpProviderLogo } from "@/components/mcp-provider-logo";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Landing chooser for Connections → New. Search jumps straight to a provider
// across Native MCP, Manual credential, and Composio; empty query shows type cards.
// Composio is always ranked and styled as last resort when a native option exists.

export type SearchableProvider = {
  slug: string;
  displayName: string;
  authLabel: string;
  categoryLabel: string;
  kind: "native" | "manual" | "composio";
  href: string;
};

const KIND_LABEL: Record<SearchableProvider["kind"], string> = {
  native: "Native MCP",
  manual: "Manual credential",
  composio: "Composio",
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

  // Slugs that have a native (or manual) hit for this query — used to mark
  // overlapping Composio toolkits as fallbacks.
  const preferredSlugs = useMemo(() => {
    if (!needle) return new Set<string>();
    const set = new Set<string>();
    for (const p of providers) {
      if (p.kind === "composio") continue;
      const name = p.displayName.toLowerCase();
      const slug = p.slug.toLowerCase();
      if (
        slug.includes(needle) ||
        name.includes(needle) ||
        p.authLabel.toLowerCase().includes(needle) ||
        p.categoryLabel.toLowerCase().includes(needle)
      ) {
        set.add(slug);
      }
    }
    return set;
  }, [providers, needle]);

  const { preferred, fallback } = useMemo(() => {
    if (!needle) return { preferred: [] as SearchableProvider[], fallback: [] as SearchableProvider[] };

    const scored = providers
      .map((p) => {
        const name = p.displayName.toLowerCase();
        const slug = p.slug.toLowerCase();
        const hay =
          `${name} ${slug} ${p.authLabel} ${p.categoryLabel} ${p.kind} ${KIND_LABEL[p.kind]}`.toLowerCase();
        if (
          !hay.includes(needle) &&
          !slug.includes(needle) &&
          !name.includes(needle)
        ) {
          return null;
        }
        // Strong preference for native/manual over Composio (not just +3).
        let score = 0;
        if (slug === needle) score = 100;
        else if (slug.startsWith(needle)) score = 80;
        else if (name.startsWith(needle)) score = 60;
        else if (name.includes(needle) || slug.includes(needle)) score = 40;
        else score = 20;
        if (p.kind === "native") score += 50;
        else if (p.kind === "manual") score += 40;
        else score += 0; // composio last within same text match
        return { p, score };
      })
      .filter((x): x is { p: SearchableProvider; score: number } => x !== null)
      .sort(
        (a, b) =>
          b.score - a.score || a.p.displayName.localeCompare(b.p.displayName),
      )
      .map((x) => x.p);

    const preferredList = scored
      .filter((p) => p.kind !== "composio")
      .slice(0, 40);
    // Cap fallbacks; demote further when a preferred option shares the slug.
    const fallbackList = scored
      .filter((p) => p.kind === "composio")
      .slice(0, 25);

    return { preferred: preferredList, fallback: fallbackList };
  }, [providers, needle]);

  const typeMatches = useMemo(() => {
    if (!needle) return [];
    const types: Array<{
      href: string;
      title: string;
      sublabel: string;
      logo: ReactNode;
      secondary?: boolean;
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
        sublabel: "Preferred — official provider MCP servers",
        logo: (
          <IconApiConnection size={24} className="text-foreground-muted" />
        ),
      });
    }
    if (needle.includes("composio") || needle.includes("toolkit")) {
      types.push({
        href: `${newHref}?type=composio`,
        title: "Composio",
        sublabel: "Last resort — when no native MCP exists",
        logo: (
          <IconApiConnection size={24} className="text-foreground-muted" />
        ),
        secondary: true,
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

  const totalCount = preferred.length + fallback.length;

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
        <div className="flex flex-col gap-5">
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
                    secondary={t.secondary}
                  />
                ))}
              </div>
            </div>
          )}

          {totalCount === 0 ? (
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
            <>
              {preferred.length > 0 && (
                <ResultSection
                  title="Recommended"
                  hint="Native MCP and manual credentials"
                  count={preferred.length}
                >
                  {preferred.map((p) => (
                    <ProviderRow
                      key={`${p.kind}:${p.slug}`}
                      provider={p}
                      variant="preferred"
                    />
                  ))}
                </ResultSection>
              )}

              {fallback.length > 0 && (
                <ResultSection
                  title="Composio"
                  hint="Use only when no native option fits"
                  count={fallback.length}
                  muted
                >
                  {fallback.map((p) => (
                    <ProviderRow
                      key={`${p.kind}:${p.slug}`}
                      provider={p}
                      variant="fallback"
                      hasNativeTwin={preferredSlugs.has(p.slug.toLowerCase())}
                    />
                  ))}
                </ResultSection>
              )}
            </>
          )}
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
              sublabel="Preferred — official provider MCP servers"
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
              sublabel="Last resort — when no native MCP exists"
              secondary
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

function ResultSection({
  title,
  hint,
  count,
  muted,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2
          className={cn(
            "text-sm font-medium uppercase tracking-wide",
            muted ? "text-foreground-muted" : "text-foreground-weak",
          )}
        >
          {title}
          <span className="text-foreground-muted normal-case tracking-normal">
            {" "}
            · {count}
          </span>
        </h2>
        <span className="text-foreground-muted text-xs">{hint}</span>
      </div>
      <ul
        className={cn(
          "divide-border overflow-hidden rounded-lg border divide-y",
          muted
            ? "border-border/70 bg-surface-secondary/40"
            : "border-border bg-surface",
        )}
      >
        {children}
      </ul>
    </div>
  );
}

function ProviderRow({
  provider: p,
  variant,
  hasNativeTwin,
}: {
  provider: SearchableProvider;
  variant: "preferred" | "fallback";
  /** Composio toolkit that also has a native/manual match for this slug. */
  hasNativeTwin?: boolean;
}) {
  const isFallback = variant === "fallback";
  return (
    <li>
      <Link
        href={p.href}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 transition-colors",
          isFallback
            ? "hover:bg-surface-secondary/80 text-foreground-weak"
            : "hover:bg-interactive-state-hover",
        )}
      >
        <span className={cn(isFallback && "opacity-60")}>
          <McpProviderLogo slug={p.slug} label={p.displayName} size={20} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              "flex flex-wrap items-center gap-1.5 font-medium",
              isFallback ? "text-foreground-weak" : "text-foreground",
            )}
          >
            {p.displayName}
            {isFallback && (
              <Badge variant="gray" size="small">
                Fallback
              </Badge>
            )}
            {p.kind === "native" && (
              <Badge variant="green" size="small">
                Recommended
              </Badge>
            )}
          </span>
          <span
            className={cn(
              "truncate text-xs",
              isFallback ? "text-foreground-muted" : "text-foreground-muted",
            )}
          >
            <code>{p.slug}</code>
            {" · "}
            {KIND_LABEL[p.kind]}
            {p.categoryLabel ? ` · ${p.categoryLabel}` : ""}
            {p.authLabel && p.kind !== "composio" ? ` · ${p.authLabel}` : ""}
            {hasNativeTwin
              ? " · Prefer the Native MCP option above"
              : isFallback
                ? " · When no native MCP exists"
                : ""}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 text-sm font-medium whitespace-nowrap",
            isFallback ? "text-foreground-muted" : "text-foreground-weak",
          )}
        >
          Connect →
        </span>
      </Link>
    </li>
  );
}

function OptionCard({
  href,
  logo,
  title,
  sublabel,
  secondary,
}: {
  href: string;
  logo: ReactNode;
  title: string;
  sublabel: string;
  /** Visually quieter card (Composio type). */
  secondary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors",
        secondary
          ? "border-border/70 bg-surface-secondary/30 hover:bg-surface-secondary text-foreground-weak"
          : "border-border bg-surface hover:bg-surface-secondary",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center",
          secondary && "opacity-70",
        )}
      >
        {logo}
      </span>
      <span className="flex min-w-0 flex-col">
        <span
          className={cn(
            "font-medium group-hover:underline",
            secondary ? "text-foreground-weak" : "text-foreground",
          )}
        >
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
