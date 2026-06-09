"use client";

import { useEffect, useRef, useState } from "react";

// Reveals text progressively (whole words at a time) while a run is live, so
// each step's narration / the final answer reads as building rather than
// popping in on each 1s poll. For a finished run (`live` false) it shows the
// full text immediately — no animation when you open an old run.
export function RevealText({ text, live }: { text: string; live: boolean }) {
  const [shown, setShown] = useState(live ? 0 : text.length);
  const targetRef = useRef(text);
  useEffect(() => {
    targetRef.current = text;
  }, [text]);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      setShown((n) => {
        const s = targetRef.current;
        const target = s.length;
        if (n >= target) return n;
        const stride = Math.max(6, Math.ceil((target - n) / 16));
        let next = Math.min(target, n + stride);
        while (next < target && !/\s/.test(s[next])) next++;
        return next;
      });
    }, 45);
    return () => clearInterval(id);
  }, [live]);

  const effective = live ? Math.min(shown, text.length) : text.length;
  return (
    <>
      {text.slice(0, effective)}
      {live && effective < text.length && (
        <span className="text-foreground-muted animate-pulse">▋</span>
      )}
    </>
  );
}
