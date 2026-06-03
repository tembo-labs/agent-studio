"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

// The server renders Date.toLocaleString in the container's UTC, so
// SSR'd date text would briefly flash UTC before hydration swaps it
// to local. To eliminate the flash we render nothing until the
// component mounts on the client — only then is `Intl.DateTimeFormat`
// guaranteed to use the user's browser-side time zone.

type Style = "datetime" | "date" | "time" | "relative";

const STYLES: Record<Exclude<Style, "relative">, Intl.DateTimeFormatOptions> = {
  datetime: { dateStyle: "medium", timeStyle: "short" },
  date: { dateStyle: "medium" },
  time: { timeStyle: "short" },
};

function subscribeMounted() {
  return () => {};
}

function getMountedSnapshot() {
  return true;
}

function getServerMountedSnapshot() {
  return false;
}

type Props = {
  iso: string;
  /** "relative" renders "3 min ago" / "yesterday" / "Mar 12"; the
   *  full absolute timestamp lives on hover. Better for dense lists
   *  (audit timeline, runs list, connection rows) where the exact
   *  second rarely matters. */
  style?: Style;
  className?: string;
};

export function LocalTime({ iso, style = "datetime", className }: Props) {
  const mounted = useSyncExternalStore(
    subscribeMounted,
    getMountedSnapshot,
    getServerMountedSnapshot,
  );
  const [hovering, setHovering] = useState(false);
  // Tick once a minute so "3 min ago" advances without a remount.
  // Cheap (one component-local setInterval) and bounded by mount
  // lifecycle; only active in relative mode.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (style !== "relative") return;
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [style]);

  if (style === "relative") {
    const absolute = mounted
      ? formatInZone(iso, "datetime", undefined)
      : "";
    return (
      <time
        dateTime={iso}
        title={absolute}
        className={cn("align-baseline", className)}
        suppressHydrationWarning
      >
        {mounted ? formatRelative(iso) : ""}
      </time>
    );
  }

  // Default = local; hover = UTC (canonical, what logs/API records
  // use). Dates without a time component don't switch since the
  // tz hint is meaningless there.
  const interactive = style !== "date";
  // After the relative-mode early return above, only the absolute
  // styles reach here, so the cast is safe.
  const absoluteStyle = style as Exclude<Style, "relative">;
  const local = mounted ? formatInZone(iso, absoluteStyle, undefined) : "";
  const utc =
    mounted && interactive ? formatInZone(iso, absoluteStyle, "UTC") : "";
  const showUtc = hovering && interactive;

  return (
    <time
      dateTime={iso}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
      tabIndex={interactive ? 0 : undefined}
      // inline-grid lets both children share the same grid cell so
      // they're stacked at the same position; the cell sizes to the
      // wider of the two, which keeps surrounding text from jumping
      // when local and UTC strings have different widths.
      className={cn(
        "inline-grid align-baseline outline-none",
        className,
      )}
      suppressHydrationWarning
    >
      <span
        className="col-start-1 row-start-1 transition-opacity duration-500 ease-in-out"
        style={{ opacity: showUtc ? 0 : 1 }}
      >
        {local}
      </span>
      {interactive && (
        <span
          aria-hidden
          className="col-start-1 row-start-1 transition-opacity duration-500 ease-in-out"
          style={{ opacity: showUtc ? 1 : 0 }}
        >
          {utc}
        </span>
      )}
    </time>
  );
}

// Format `iso` in the user's locale, optionally pinned to a
// specific timeZone (e.g. "UTC"). dateStyle/timeStyle are mutually
// exclusive with timeZoneName per the Intl spec, so we render the
// base text with the shorthand and append the tz abbreviation from
// a second formatter. The tz suffix only renders for datetime/time
// styles — bare dates are tz-agnostic.
function formatInZone(
  iso: string,
  style: Exclude<Style, "relative">,
  timeZone: string | undefined,
): string {
  const d = new Date(iso);
  const baseOptions: Intl.DateTimeFormatOptions = {
    ...STYLES[style],
    ...(timeZone ? { timeZone } : {}),
  };
  const base = d.toLocaleString(undefined, baseOptions);
  if (style === "date") return base;
  try {
    const tz = new Intl.DateTimeFormat(undefined, {
      ...(timeZone ? { timeZone } : {}),
      timeZoneName: "short",
    })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName")?.value;
    return tz ? `${base} ${tz}` : base;
  } catch {
    return base;
  }
}

// "just now" / "3 min ago" / "2h ago" / "yesterday" / "Mar 12" / "Mar
// 12, 2024" depending on how far in the past `iso` is. Anything in
// the future falls back to the absolute date — TAS shouldn't be
// rendering future timestamps in lists, but if it does, "in 3 min"
// confused-counting is worse than the absolute date.
function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return formatInZone(iso, "date", undefined);

  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;

  // Day-aware comparisons after 24h so "yesterday" actually lines
  // up with a calendar yesterday in the user's tz, not "24 hours
  // ago" exactly.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDay = new Date(then);
  startOfDay.setHours(0, 0, 0, 0);
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfDay.getTime()) / (24 * 3600_000),
  );
  if (dayDiff === 1) return "yesterday";
  if (dayDiff < 7) return `${dayDiff}d ago`;

  // Beyond a week, switch to a compact absolute date. Same-year
  // dates drop the year; older ones keep it.
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
