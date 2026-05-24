"use client";

import { useEffect, useState } from "react";

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
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {mounted ? formatIso(iso, style) : ""}
    </time>
  );
}

function formatIso(iso: string, style: Style): string {
  return new Date(iso).toLocaleString(undefined, STYLES[style]);
}
