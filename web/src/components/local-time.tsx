"use client";

import { useEffect, useState } from "react";

// Server-side renders are in the container's UTC tz; this component
// re-renders the same ISO string in the *browser's* tz on mount. The
// brief flash from UTC to local lands in <50ms in practice.
// `suppressHydrationWarning` silences React's expected mismatch.

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
  const [text, setText] = useState(() => formatIso(iso, style));

  useEffect(() => {
    setText(formatIso(iso, style));
  }, [iso, style]);

  return (
    <time
      dateTime={iso}
      className={className}
      suppressHydrationWarning
    >
      {text}
    </time>
  );
}

function formatIso(iso: string, style: Style): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, STYLES[style]);
}
