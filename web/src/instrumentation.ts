// Next.js calls this `register()` hook exactly once per process at
// boot, before any request handler runs — the documented place to
// kick off background work.
//
// We use it to start the cron scheduler (single-tenant deployment,
// single process — see deployment_model memory). The dynamic import
// keeps the scheduler module out of the edge runtime bundle: edge
// has no setInterval and no GitHub fetch budget anyway.
//
// https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startScheduler } = await import("@/lib/scheduler");
  startScheduler();
}
