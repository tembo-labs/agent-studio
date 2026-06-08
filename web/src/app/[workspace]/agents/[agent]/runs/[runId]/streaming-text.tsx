"use client";

import { useEffect, useRef, useState } from "react";

// Reveals the streamed output progressively (whole words at a time) instead of
// letting whole line-chunks pop in on each 1s poll. The server re-renders this
// with a longer `text` every poll; we animate from however far we've revealed
// toward the new length, catching up faster the further behind we are so we
// never lag the real stream. Ends exactly at the full streamed text, which the
// final `output` then matches — so the swap on completion is seamless.
export function StreamingText({ text }: { text: string }) {
  const [shown, setShown] = useState(0);
  const targetRef = useRef(text);
  // Keep the interval's view of the target current without reading a ref
  // during render.
  useEffect(() => {
    targetRef.current = text;
  }, [text]);

  useEffect(() => {
    const id = setInterval(() => {
      setShown((n) => {
        const s = targetRef.current;
        const target = s.length;
        if (n >= target) return n;
        // A few characters per tick, scaled to the backlog, then extended to
        // the next whitespace so we always land on a word boundary.
        const stride = Math.max(6, Math.ceil((target - n) / 16));
        let next = Math.min(target, n + stride);
        while (next < target && !/\s/.test(s[next])) next++;
        return next;
      });
    }, 45);
    return () => clearInterval(id);
  }, []);

  const visible = text.slice(0, Math.min(shown, text.length));
  return (
    <>
      {visible}
      <span className="text-foreground-muted ml-0.5 animate-pulse">▋</span>
    </>
  );
}
