"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The page is a server component that reads the latest run row on every
// render. This client component just triggers router.refresh() while the
// run is still in flight — small, scoped, and avoids a separate polling
// endpoint.
//
// 1s while running, 2s while queued (cheaper, since "queued" usually
// flips to "running" inside one task tick).
const POLL_MS_RUNNING = 1000;
const POLL_MS_QUEUED = 2000;

export function RunPoller({ status }: { status: "queued" | "running" | "succeeded" | "failed" }) {
  const router = useRouter();

  useEffect(() => {
    if (status !== "queued" && status !== "running") return;
    const ms = status === "running" ? POLL_MS_RUNNING : POLL_MS_QUEUED;
    const interval = setInterval(() => router.refresh(), ms);
    return () => clearInterval(interval);
  }, [status, router]);

  return null;
}
