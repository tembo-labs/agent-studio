import "server-only";

// Single-process cron scheduler that fires runs for due automations.
// Started by instrumentation.ts at Node.js boot; idempotent so the
// dev-server hot reload doesn't double-start it.
//
// Design notes (single-tenant, single-node — the deployment model
// memo this whole product is built around):
//   - One setInterval at TICK_MS resolution. Granularity is fine for
//     v0.2 ("basic recurring schedules"); sub-minute precision is
//     out of scope.
//   - Per-tick we list enabled automations and, for each, ask the
//     cron library "did anything fire after the last_fired_at floor?"
//     If yes, we fire exactly one run regardless of how many windows
//     were missed — no catch-up storm if the api was offline for an
//     hour.
//   - Run creation goes through the API's /internal/runs endpoint so
//     execution is identical to a manual run; the only difference is
//     the trigger='schedule' + automation_id columns on the run row.
//   - Failures (bad cron, missing agent file, parse error, network)
//     are recorded on the automation row via last_fire_error and the
//     last_fired_at floor is advanced anyway so we don't retry-storm
//     the same broken state on every tick.

import { detectFormat } from "@/lib/agent-format";
import {
  listEnabledAutomations,
  setAutomationFired,
  setAutomationSkipped,
  type Automation,
} from "@/lib/automations-api";
import { hasFiringInWindow } from "@/lib/cron";
import { getAgentByName } from "@/lib/workspace-agents";

const TICK_MS = 30_000;

let started = false;
let timer: NodeJS.Timeout | null = null;

export function startScheduler() {
  if (started) return;
  started = true;
  // Run one tick immediately so a fresh boot doesn't wait 30s before
  // catching up on anything that came due during downtime.
  void tick().catch((e) => console.error("[scheduler] initial tick threw", e));
  timer = setInterval(() => {
    void tick().catch((e) => console.error("[scheduler] tick threw", e));
  }, TICK_MS);
  console.log(`[scheduler] started, tick=${TICK_MS}ms`);
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}

async function tick() {
  const automations = await listEnabledAutomations();
  if (automations.length === 0) return;
  const now = new Date();
  for (const a of automations) {
    try {
      await maybeFire(a, now);
    } catch (e) {
      console.error("[scheduler] maybeFire threw", a.id, e);
      await setAutomationSkipped({
        id: a.id,
        firedAt: now,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

async function maybeFire(a: Automation, now: Date) {
  // Use last_fired_at as the floor; for never-fired automations,
  // anchor to created_at so we don't fire on every tick for a brand-
  // new cron whose first window is in the future.
  const floor = a.lastFiredAt ?? a.createdAt;
  if (!hasFiringInWindow(a.cron, floor, now)) return;

  // Resolve the agent. listEnabledAutomations doesn't pre-fetch this
  // because most automations don't fire on most ticks — only pay the
  // GitHub round-trip when we're actually about to fire.
  const resolved = await getAgentByName(a.workspaceId, a.agentName);
  if (!resolved) {
    await recordSkipAndAdvance(
      a,
      now,
      `Agent "${a.agentName}" is no longer in the connected repo.`,
    );
    return;
  }
  if (!resolved.agent.ok) {
    await recordSkipAndAdvance(
      a,
      now,
      `Agent file failed to parse: ${resolved.agent.error}`,
    );
    return;
  }
  const spec = resolved.agent.spec;
  const model = spec.model ?? "";
  if (!model) {
    await recordSkipAndAdvance(
      a,
      now,
      `Agent has no model declared. Add a model and try again.`,
    );
    return;
  }
  const format = detectFormat(resolved.agent.path);
  if (!format) {
    await recordSkipAndAdvance(
      a,
      now,
      `Agent file has an unrecognized extension: ${resolved.agent.path}`,
    );
    return;
  }

  // POST directly to /internal/runs with the new spec_content /
  // spec_format contract + trigger + automation_id. We don't go
  // through @/lib/runs-api because that helper still speaks the old
  // (instructions / spec_json) shape today.
  const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8080";
  const token = process.env.INTERNAL_API_TOKEN;
  if (!token) {
    await recordSkipAndAdvance(
      a,
      now,
      "INTERNAL_API_TOKEN is unset; scheduler cannot reach the run API.",
    );
    return;
  }

  const res = await fetch(`${apiUrl}/internal/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
    body: JSON.stringify({
      workspace_id: a.workspaceId,
      // Scheduled runs act as the automation's owner (per migration
      // 0023). The owner's credentials are what the Composio session
      // looks up; defaults to createdBy when an automation is
      // created and can be reassigned from the form.
      user_id: a.ownerUserId,
      agent_name: spec.name,
      agent_path: resolved.agent.path,
      model,
      user_message: a.inputMessage,
      framework: spec.framework,
      spec_content: resolved.raw,
      spec_format: format,
      trigger: "schedule",
      automation_id: a.id,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    await recordSkipAndAdvance(
      a,
      now,
      `Run API returned ${res.status}: ${body.slice(0, 300)}`,
    );
    return;
  }

  await setAutomationFired({ id: a.id, firedAt: now });
}

// Advance last_fired_at even when we couldn't actually fire, so a
// broken cron / missing agent doesn't churn the DB every 30s with
// the same error. The error is stamped onto the row so the UI can
// surface it; once the underlying problem is fixed, the next
// natural cron window fires normally and clears the error.
async function recordSkipAndAdvance(
  a: Automation,
  now: Date,
  error: string,
): Promise<void> {
  console.warn("[scheduler] skip fire", a.id, error);
  await setAutomationSkipped({ id: a.id, firedAt: now, error });
}
