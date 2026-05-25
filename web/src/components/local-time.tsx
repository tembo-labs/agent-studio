"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

// The server renders Date.toLocaleString in the container's UTC, so
// SSR'd date text would briefly flash UTC before hydration swaps it
// to local. To eliminate the flash we render nothing until the
// component mounts on the client — only then is `Intl.DateTimeFormat`
// guaranteed to use the user's browser-side time zone.

type Style = "datetime" | "date" | "time";

const STYLES: Record<Style, Intl.DateTimeFormatOptions> = {
  datetime: { dateStyle: "medium", timeStyle: "short" },
  date: { dateStyle: "medium" },
  time: { timeStyle: "short" },
};

type Props = {
  iso: string;
  style?: Style;
  className?: string;
};

export function LocalTime({ iso, style = "datetime", className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [hovering, setHovering] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Default = local; hover = UTC (canonical, what logs/API records
  // use). Dates without a time component don't switch since the
  // tz hint is meaningless there.
  const interactive = style !== "date";
  const local = mounted ? formatInZone(iso, style, undefined) : "";
  const utc = mounted && interactive ? formatInZone(iso, style, "UTC") : "";
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
  style: Style,
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
