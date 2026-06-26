"use client";

import { useLayoutEffect, useRef, useState } from "react";

// A tool call's error message in the step timeline. Collapsed to two lines by
// default and click-to-expand — only when the text actually overflows that
// clamp (short errors show no affordance). Errors can be long (API bodies,
// validation dumps, short tracebacks); the full stored text is shown when
// expanded, with newlines preserved.
export function ExpandableError({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Measure against the collapsed clamp: if the content is taller than the
    // 2-line box, the toggle is meaningful. (Re-measures when collapsed.)
    if (!expanded) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded]);

  return (
    <div className="pl-[1.375rem]">
      <p
        ref={ref}
        className={`text-sentiment-negative font-mono text-xs leading-4 break-words ${
          expanded ? "whitespace-pre-wrap" : "line-clamp-2"
        }`}
      >
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-foreground-muted hover:text-foreground-weak mt-0.5 text-xs"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
